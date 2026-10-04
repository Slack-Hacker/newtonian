export type Role = 'ADMIN' | 'TEAM_LEAD' | 'TEAM_MEMBER' | 'VIEWER';

export type WorkItemCategory = 
  | 'CUSTOMER_ISSUE' 
  | 'ENGINEERING_PROBLEM' 
  | 'PAYMENT_INVESTIGATION' 
  | 'PRODUCTION_INCIDENT' 
  | 'COMPLIANCE_REQUEST' 
  | 'OPERATIONAL_APPROVAL';

export type WorkItemStatus = 
  | 'DRAFT' 
  | 'OPEN' 
  | 'IN_PROGRESS' 
  | 'PENDING_APPROVAL' 
  | 'RESOLVED' 
  | 'CLOSED';

export type WorkItemPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface UserTeam {
  user_id: string;
  team_id: string;
  role: Role;
}

export interface WorkItem {
  id: string;
  title: string;
  description: string;
  category: WorkItemCategory;
  status: WorkItemStatus;
  priority: WorkItemPriority;
  team_id: string;
  assignee_id: string | null;
  reporter_id: string;
  required_next_action: string;
  version: number;
  created_at: string;
  updated_at: string;

  // Joined optional metadata
  team_name?: string;
  assignee_name?: string;
  reporter_name?: string;
}

export type ActionType = 
  | 'CREATED' 
  | 'STATUS_CHANGE' 
  | 'ASSIGNED' 
  | 'REASSIGNED' 
  | 'PRIORITY_CHANGE' 
  | 'COMMENT_ADDED' 
  | 'APPROVAL_SUBMITTED' 
  | 'APPROVED' 
  | 'REJECTED'
  | 'EDITED';

export interface WorkItemActivity {
  id: string;
  work_item_id: string;
  user_id: string;
  user_name?: string;
  action_type: ActionType;
  old_values: string | null;
  new_values: string | null;
  comment: string | null;
  created_at: string;
}

export interface AuthUserContext {
  id: string;
  name: string;
  email: string;
  teams: {
    team_id: string;
    team_name: string;
    role: Role;
  }[];
}

export interface CreateWorkItemInput {
  title: string;
  description: string;
  category: WorkItemCategory;
  priority: WorkItemPriority;
  team_id: string;
  assignee_id?: string | null;
  required_next_action?: string;
}

export interface UpdateWorkItemInput {
  version: number; // Required for optimistic locking
  title?: string;
  description?: string;
  category?: WorkItemCategory;
  status?: WorkItemStatus;
  priority?: WorkItemPriority;
  team_id?: string;
  assignee_id?: string | null;
  required_next_action?: string;
  comment?: string;
}
