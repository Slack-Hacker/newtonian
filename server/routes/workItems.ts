import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { WorkItemService, ConflictError, ForbiddenError, ValidationError, NotFoundError } from '../services/workItemService.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';

const router = Router();

// GET /api/work-items
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { team_id, status, priority, assignee_id, search, page, limit } = req.query;
    const result = WorkItemService.getWorkItems({
      team_id: team_id as string,
      status: status as string,
      priority: priority as string,
      assignee_id: assignee_id as string,
      search: search as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20
    });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch work items', details: err.message });
  }
});

// GET /api/work-items/:id
router.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const item = WorkItemService.getWorkItemById(req.params.id);
    return res.json(item);
  } catch (err: any) {
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to fetch work item', details: err.message });
  }
});

// GET /api/work-items/:id/activities
router.get('/:id/activities', (req: AuthenticatedRequest, res: Response) => {
  try {
    const activities = WorkItemService.getActivities(req.params.id);
    return res.json(activities);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch activities', details: err.message });
  }
});

// POST /api/work-items (Create)
router.post('/', idempotencyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userContext = req.userContext!;
    const item = WorkItemService.createWorkItem(req.body, userContext);
    return res.status(201).json(item);
  } catch (err: any) {
    if (err instanceof ForbiddenError) {
      return res.status(403).json({ error: err.message });
    }
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to create work item', details: err.message });
  }
});

// PATCH /api/work-items/:id (Update with Optimistic Locking)
router.patch('/:id', idempotencyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userContext = req.userContext!;
    const updatedItem = WorkItemService.updateWorkItem(req.params.id, req.body, userContext);
    return res.json(updatedItem);
  } catch (err: any) {
    if (err instanceof ConflictError) {
      // Return HTTP 409 Conflict with fresh item payload for client reconciliation
      return res.status(409).json({
        error: err.message,
        conflict: true,
        currentWorkItem: err.currentWorkItem
      });
    }
    if (err instanceof ForbiddenError) {
      return res.status(403).json({ error: err.message });
    }
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    if (err instanceof NotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to update work item', details: err.message });
  }
});

// POST /api/work-items/:id/comments
router.post('/:id/comments', idempotencyMiddleware, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userContext = req.userContext!;
    const { comment, version } = req.body;
    if (!comment) {
      return res.status(400).json({ error: 'Comment text is required.' });
    }
    const updatedItem = WorkItemService.updateWorkItem(
      req.params.id,
      { version: version ?? WorkItemService.getWorkItemById(req.params.id).version, comment },
      userContext
    );
    return res.json(updatedItem);
  } catch (err: any) {
    if (err instanceof ConflictError) {
      return res.status(409).json({ error: err.message, currentWorkItem: err.currentWorkItem });
    }
    if (err instanceof ForbiddenError) {
      return res.status(403).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to add comment', details: err.message });
  }
});

export default router;
