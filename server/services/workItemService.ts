import db from '../db/database.js';
import { 
  WorkItem, 
  WorkItemActivity, 
  CreateWorkItemInput, 
  UpdateWorkItemInput, 
  AuthUserContext, 
  WorkItemStatus,
  Role 
} from '../types/index.js';
import { hasTeamRole } from '../middleware/auth.js';
import { asyncQueue } from './asyncQueue.js';

export class ConflictError extends Error {
  public currentWorkItem: WorkItem;
  constructor(message: string, currentWorkItem: WorkItem) {
    super(message);
    this.name = 'ConflictError';
    this.currentWorkItem = currentWorkItem;
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

// Allowed state transitions map
const ALLOWED_TRANSITIONS: Record<WorkItemStatus, WorkItemStatus[]> = {
  DRAFT: ['OPEN'],
  OPEN: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['PENDING_APPROVAL', 'RESOLVED', 'OPEN'],
  PENDING_APPROVAL: ['RESOLVED', 'IN_PROGRESS'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: ['IN_PROGRESS']
};

export class WorkItemService {
  /**
   * Fetch paginated & filtered work items
   */
  static getWorkItems(filters: {
    team_id?: string;
    status?: string;
    priority?: string;
    assignee_id?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const offset = (page - 1) * limit;

    let query = `
      SELECT wi.*, 
             t.name as team_name, 
             u_assign.name as assignee_name, 
             u_rep.name as reporter_name
      FROM work_items wi
      LEFT JOIN teams t ON wi.team_id = t.id
      LEFT JOIN users u_assign ON wi.assignee_id = u_assign.id
      LEFT JOIN users u_rep ON wi.reporter_id = u_rep.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.team_id) {
      query += ' AND wi.team_id = ?';
      params.push(filters.team_id);
    }
    if (filters.status) {
      query += ' AND wi.status = ?';
      params.push(filters.status);
    }
    if (filters.priority) {
      query += ' AND wi.priority = ?';
      params.push(filters.priority);
    }
    if (filters.assignee_id) {
      query += ' AND wi.assignee_id = ?';
      params.push(filters.assignee_id);
    }
    if (filters.search) {
      query += ' AND (wi.title LIKE ? OR wi.description LIKE ? OR wi.id LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term, term);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const totalRow = db.prepare(countQuery).get(...params) as { total: number };

    // Add pagination & sorting
    query += ' ORDER BY wi.updated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const items = db.prepare(query).all(...params) as WorkItem[];

    return {
      data: items,
      meta: {
        page,
        limit,
        total: totalRow.total,
        totalPages: Math.ceil(totalRow.total / limit)
      }
    };
  }

  /**
   * Get single work item by ID
   */
  static getWorkItemById(id: string): WorkItem {
    const item = db.prepare(`
      SELECT wi.*, 
             t.name as team_name, 
             u_assign.name as assignee_name, 
             u_rep.name as reporter_name
      FROM work_items wi
      LEFT JOIN teams t ON wi.team_id = t.id
      LEFT JOIN users u_assign ON wi.assignee_id = u_assign.id
      LEFT JOIN users u_rep ON wi.reporter_id = u_rep.id
      WHERE wi.id = ?
    `).get(id) as WorkItem;

    if (!item) {
      throw new NotFoundError(`Work Item ${id} not found.`);
    }

    return item;
  }

  /**
   * Get activity timeline for a work item
   */
  static getActivities(workItemId: string): WorkItemActivity[] {
    return db.prepare(`
      SELECT act.*, u.name as user_name
      FROM work_item_activities act
      LEFT JOIN users u ON act.user_id = u.id
      WHERE act.work_item_id = ?
      ORDER BY act.created_at ASC
    `).all(workItemId) as WorkItemActivity[];
  }

  /**
   * Create new Work Item
   */
  static createWorkItem(input: CreateWorkItemInput, userContext: AuthUserContext): WorkItem {
    // Resource Auth Check: User must belong to the team or be Admin
    if (!hasTeamRole(userContext, input.team_id, ['ADMIN', 'TEAM_LEAD', 'TEAM_MEMBER'])) {
      throw new ForbiddenError(`You do not have permission to create work items for team ${input.team_id}.`);
    }

    const nextIdNum = (db.prepare('SELECT COUNT(*) as count FROM work_items').get() as any).count + 1001;
    const id = `WI-${nextIdNum}`;
    const now = new Date().toISOString();

    const insertStmt = db.prepare(`
      INSERT INTO work_items (
        id, title, description, category, status, priority, team_id, assignee_id, reporter_id, required_next_action, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'OPEN', ?, ?, ?, ?, ?, 1, ?, ?)
    `);

    insertStmt.run(
      id,
      input.title,
      input.description,
      input.category,
      input.priority,
      input.team_id,
      input.assignee_id || null,
      userContext.id,
      input.required_next_action || 'Initial triage and review.',
      now,
      now
    );

    // Log Activity
    const actId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    db.prepare(`
      INSERT INTO work_item_activities (id, work_item_id, user_id, action_type, new_values, comment, created_at)
      VALUES (?, ?, ?, 'CREATED', ?, 'Work item created.', ?)
    `).run(
      actId,
      id,
      userContext.id,
      JSON.stringify({ title: input.title, category: input.category, priority: input.priority, status: 'OPEN' }),
      now
    );

    // Trigger async job
    asyncQueue.enqueue({
      type: 'NOTIFICATION',
      workItemId: id,
      triggeredByUserId: userContext.id,
      details: { action: 'CREATED' }
    });

    return this.getWorkItemById(id);
  }

  /**
   * Update Work Item with Optimistic Locking & State Machine rules
   */
  static updateWorkItem(id: string, input: UpdateWorkItemInput, userContext: AuthUserContext): WorkItem {
    const existing = this.getWorkItemById(id);

    // 1. Resource Authorization Check
    const isAssignee = existing.assignee_id === userContext.id;
    const isLeadOrAdmin = hasTeamRole(userContext, existing.team_id, ['ADMIN', 'TEAM_LEAD']);
    const isMember = hasTeamRole(userContext, existing.team_id, ['TEAM_MEMBER']);

    if (!isAssignee && !isLeadOrAdmin && !isMember) {
      throw new ForbiddenError(`You lack required permissions to modify work item ${id}.`);
    }

    // 2. Validate Version for Optimistic Concurrency Control
    if (input.version === undefined || input.version === null) {
      throw new ValidationError('Version field is required for optimistic concurrency control.');
    }

    if (input.version !== existing.version) {
      throw new ConflictError(
        `Conflict: Work item ${id} was updated by another user. You provided version ${input.version}, but server version is ${existing.version}.`,
        existing
      );
    }

    // 3. Enforce State Machine Workflow Rules
    if (input.status && input.status !== existing.status) {
      const allowedNextStates = ALLOWED_TRANSITIONS[existing.status] || [];
      if (!allowedNextStates.includes(input.status)) {
        throw new ValidationError(
          `Invalid state transition from '${existing.status}' to '${input.status}'. Allowed transitions: ${allowedNextStates.join(', ') || 'None'}.`
        );
      }

      // Special rule: Transitioning PENDING_APPROVAL -> RESOLVED requires TEAM_LEAD or ADMIN
      if (existing.status === 'PENDING_APPROVAL' && input.status === 'RESOLVED' && !isLeadOrAdmin) {
        throw new ForbiddenError('Only Team Leads or Admins can approve work items in PENDING_APPROVAL status.');
      }
    }

    // 4. Build SQL Update
    const updates: string[] = [];
    const params: any[] = [];
    const changesOld: Record<string, any> = {};
    const changesNew: Record<string, any> = {};
    let actionType: any = 'EDITED';

    if (input.title !== undefined && input.title !== existing.title) {
      updates.push('title = ?');
      params.push(input.title);
      changesOld.title = existing.title;
      changesNew.title = input.title;
    }

    if (input.description !== undefined && input.description !== existing.description) {
      updates.push('description = ?');
      params.push(input.description);
      changesOld.description = existing.description;
      changesNew.description = input.description;
    }

    if (input.category !== undefined && input.category !== existing.category) {
      updates.push('category = ?');
      params.push(input.category);
      changesOld.category = existing.category;
      changesNew.category = input.category;
    }

    if (input.status !== undefined && input.status !== existing.status) {
      updates.push('status = ?');
      params.push(input.status);
      changesOld.status = existing.status;
      changesNew.status = input.status;

      if (input.status === 'PENDING_APPROVAL') actionType = 'APPROVAL_SUBMITTED';
      else if (existing.status === 'PENDING_APPROVAL' && input.status === 'RESOLVED') actionType = 'APPROVED';
      else if (existing.status === 'PENDING_APPROVAL' && input.status === 'IN_PROGRESS') actionType = 'REJECTED';
      else actionType = 'STATUS_CHANGE';
    }

    if (input.priority !== undefined && input.priority !== existing.priority) {
      updates.push('priority = ?');
      params.push(input.priority);
      changesOld.priority = existing.priority;
      changesNew.priority = input.priority;
      actionType = 'PRIORITY_CHANGE';
    }

    if (input.assignee_id !== undefined && input.assignee_id !== existing.assignee_id) {
      updates.push('assignee_id = ?');
      params.push(input.assignee_id);
      changesOld.assignee_id = existing.assignee_id;
      changesNew.assignee_id = input.assignee_id;
      actionType = existing.assignee_id ? 'REASSIGNED' : 'ASSIGNED';
    }

    if (input.required_next_action !== undefined && input.required_next_action !== existing.required_next_action) {
      updates.push('required_next_action = ?');
      params.push(input.required_next_action);
      changesOld.required_next_action = existing.required_next_action;
      changesNew.required_next_action = input.required_next_action;
    }

    if (updates.length === 0 && !input.comment) {
      return existing; // No fields changed
    }

    const now = new Date().toISOString();
    updates.push('version = version + 1');
    updates.push('updated_at = ?');
    params.push(now);

    // Add optimistic locking WHERE clause params
    params.push(id);
    params.push(existing.version);

    // 5. Execute Atomic SQL Update with Version Lock Check
    const sql = `UPDATE work_items SET ${updates.join(', ')} WHERE id = ? AND version = ?`;
    const result = db.prepare(sql).run(...params);

    if (result.changes === 0) {
      // Failed optimistic lock check! Another query updated version in the millisecond window
      const freshCurrent = this.getWorkItemById(id);
      throw new ConflictError(
        `Optimistic lock failure: Work item ${id} was updated concurrently by another operation.`,
        freshCurrent
      );
    }

    // 6. Record Activity
    const actId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    db.prepare(`
      INSERT INTO work_item_activities (id, work_item_id, user_id, action_type, old_values, new_values, comment, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      actId,
      id,
      userContext.id,
      input.comment && Object.keys(changesNew).length === 0 ? 'COMMENT_ADDED' : actionType,
      Object.keys(changesOld).length ? JSON.stringify(changesOld) : null,
      Object.keys(changesNew).length ? JSON.stringify(changesNew) : null,
      input.comment || null,
      now
    );

    // 7. Enqueue Async Notification Job
    asyncQueue.enqueue({
      type: 'NOTIFICATION',
      workItemId: id,
      triggeredByUserId: userContext.id,
      details: { action: actionType, changes: changesNew }
    });

    return this.getWorkItemById(id);
  }
}
