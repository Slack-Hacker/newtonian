import { WorkItem, WorkItemActivity, StatsResponse, User, Team, ConflictResponse } from '../types/index.js';

const API_BASE = '/api';

export class ApiError extends Error {
  public status: number;
  public data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}, activeUserId?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (activeUserId) {
    headers['x-user-id'] = activeUserId;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error || 'An error occurred during request', res.status, data);
  }

  return data as T;
}

export function generateIdempotencyKey(): string {
  return `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export const api = {
  // Auth & Identity
  getMe: (userId: string) => request<User>('/auth/me', {}, userId),
  getUsers: () => request<User[]>('/auth/users'),
  getTeams: () => request<Team[]>('/auth/teams'),

  // Stats
  getStats: (userId: string) => request<StatsResponse>('/stats', {}, userId),

  // Work Items
  getWorkItems: (filters: Record<string, any>, userId: string) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        params.append(key, String(val));
      }
    });
    return request<{ data: WorkItem[]; meta: any }>(`/work-items?${params.toString()}`, {}, userId);
  },

  getWorkItemById: (id: string, userId: string) => request<WorkItem>(`/work-items/${id}`, {}, userId),
  
  getActivities: (id: string, userId: string) => request<WorkItemActivity[]>(`/work-items/${id}/activities`, {}, userId),

  createWorkItem: (payload: any, userId: string, idempotencyKey?: string) => 
    request<WorkItem>('/work-items', {
      method: 'POST',
      headers: {
        'x-idempotency-key': idempotencyKey || generateIdempotencyKey()
      },
      body: JSON.stringify(payload)
    }, userId),

  updateWorkItem: (id: string, payload: any, userId: string, idempotencyKey?: string) =>
    request<WorkItem>(`/work-items/${id}`, {
      method: 'PATCH',
      headers: {
        'x-idempotency-key': idempotencyKey || generateIdempotencyKey()
      },
      body: JSON.stringify(payload)
    }, userId),

  addComment: (id: string, comment: string, version: number, userId: string) =>
    request<WorkItem>(`/work-items/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ comment, version })
    }, userId)
};
