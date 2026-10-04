import React, { useState, useEffect } from 'react';
import { WorkItem, WorkItemActivity, User, Team, ConflictResponse, WorkItemStatus } from '../types/index.js';
import { TimelineHistory } from './TimelineHistory.js';
import { X, AlertTriangle, ShieldCheck, RefreshCw, Send, CheckCircle } from 'lucide-react';
import { api, ApiError } from '../api/client.js';

interface DetailModalProps {
  item: WorkItem;
  activeUser: User;
  users: User[];
  teams: Team[];
  onClose: () => void;
  onUpdateSuccess: (updated: WorkItem) => void;
  onToast: (msg: string, type: 'error' | 'success' | 'warning') => void;
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['OPEN'],
  OPEN: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['PENDING_APPROVAL', 'RESOLVED', 'OPEN'],
  PENDING_APPROVAL: ['RESOLVED', 'IN_PROGRESS'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: ['IN_PROGRESS']
};

export const WorkItemDetailModal: React.FC<DetailModalProps> = ({
  item: initialItem,
  activeUser,
  users,
  teams,
  onClose,
  onUpdateSuccess,
  onToast
}) => {
  const [item, setItem] = useState<WorkItem>(initialItem);
  const [activities, setActivities] = useState<WorkItemActivity[]>([]);
  const [conflictData, setConflictData] = useState<ConflictResponse | null>(null);

  // Form State
  const [status, setStatus] = useState<WorkItemStatus>(initialItem.status);
  const [priority, setPriority] = useState(initialItem.priority);
  const [assigneeId, setAssigneeId] = useState(initialItem.assignee_id || '');
  const [nextAction, setNextAction] = useState(initialItem.required_next_action || '');
  const [commentText, setCommentText] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'timeline'>('details');

  useEffect(() => {
    loadActivities();
  }, [item.id]);

  const loadActivities = async () => {
    try {
      const acts = await api.getActivities(item.id, activeUser.id);
      setActivities(acts);
    } catch (e) {
      console.error('Failed to load activities', e);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setConflictData(null);

    const payload: any = {
      version: item.version, // Critical for Optimistic Concurrency Control!
      status,
      priority,
      assignee_id: assigneeId || null,
      required_next_action: nextAction,
    };

    if (commentText.trim()) {
      payload.comment = commentText.trim();
    }

    try {
      const updated = await api.updateWorkItem(item.id, payload, activeUser.id);
      setItem(updated);
      setCommentText('');
      onUpdateSuccess(updated);
      onToast(`Work Item ${item.id} updated successfully (version v${updated.version})`, 'success');
      loadActivities();
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 409 && err.data?.conflict) {
        // Optimistic Concurrency Conflict!
        setConflictData(err.data as ConflictResponse);
        onToast(`Concurrency Conflict! Work item was updated by another user.`, 'error');
      } else if (err instanceof ApiError && err.status === 403) {
        onToast(`Permission Denied: ${err.message}`, 'error');
      } else if (err instanceof ApiError && err.status === 400) {
        onToast(`Validation Error: ${err.message}`, 'error');
      } else {
        onToast(err.message || 'Failed to update work item', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleResolveConflict = () => {
    if (conflictData) {
      const current = conflictData.currentWorkItem;
      setItem(current);
      setStatus(current.status);
      setPriority(current.priority);
      setAssigneeId(current.assignee_id || '');
      setNextAction(current.required_next_action || '');
      setConflictData(null);
      onToast(`Reconciled to latest server state (version v${current.version})`, 'info' as any);
      loadActivities();
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    try {
      const updated = await api.addComment(item.id, commentText.trim(), item.version, activeUser.id);
      setItem(updated);
      setCommentText('');
      onUpdateSuccess(updated);
      onToast('Comment added', 'success');
      loadActivities();
    } catch (err: any) {
      onToast(err.message || 'Failed to post comment', 'error');
    }
  };

  const allowedNextStates = ALLOWED_TRANSITIONS[item.status] || [];

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="item-id" style={{ fontSize: '1rem' }}>{item.id}</span>
              <span className="version-badge">Version {item.version}</span>
              <span className={`status-pill status-${item.status}`}>
                <span className="status-dot" />
                <span>{item.status.replace('_', ' ')}</span>
              </span>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.2rem' }}>{item.title}</h2>
          </div>

          <button className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-surface)' }}>
          <button
            style={{ padding: '0.75rem 1.25rem', background: 'transparent', border: 'none', color: activeTab === 'details' ? 'var(--accent-blue)' : 'var(--text-secondary)', borderBottom: activeTab === 'details' ? '2px solid var(--accent-blue)' : 'none', fontWeight: 600, cursor: 'pointer' }}
            onClick={() => setActiveTab('details')}
          >
            Overview & Edit
          </button>
          <button
            style={{ padding: '0.75rem 1.25rem', background: 'transparent', border: 'none', color: activeTab === 'timeline' ? 'var(--accent-blue)' : 'var(--text-secondary)', borderBottom: activeTab === 'timeline' ? '2px solid var(--accent-blue)' : 'none', fontWeight: 600, cursor: 'pointer' }}
            onClick={() => setActiveTab('timeline')}
          >
            Timeline & Audit History ({activities.length})
          </button>
        </div>

        <div className="modal-body">
          {/* Optimistic Concurrency Conflict Alert Banner */}
          {conflictData && (
            <div className="conflict-banner">
              <div className="conflict-title">
                <AlertTriangle color="#f43f5e" size={20} />
                <span>Concurrent Modification Conflict Detected (HTTP 409)</span>
              </div>
              <p style={{ fontSize: '0.85rem' }}>
                Another user updated this work item while you were editing. Server version is now <strong>v{conflictData.currentWorkItem.version}</strong> (you were editing v{item.version}).
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                <button className="btn btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} onClick={handleResolveConflict}>
                  <RefreshCw size={14} />
                  <span>Accept Latest Server Version</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'details' ? (
            <>
              {/* Description */}
              <div style={{ backgroundColor: 'var(--bg-surface)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.3rem' }}>DESCRIPTION</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{item.description}</div>
              </div>

              {/* Editable Fields Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                
                {/* Workflow Status Dropdown */}
                <div className="form-group">
                  <label className="form-label">Workflow Status</label>
                  <select
                    className="form-select"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as WorkItemStatus)}
                  >
                    <option value={item.status}>{item.status.replace('_', ' ')} (Current)</option>
                    {allowedNextStates.map((st) => (
                      <option key={st} value={st}>
                        ➔ Transition to {st.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                  {item.status === 'PENDING_APPROVAL' && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-purple)', marginTop: '0.2rem' }}>
                      ⚠️ Approval requires Team Lead or Admin role.
                    </span>
                  )}
                </div>

                {/* Priority */}
                <div className="form-group">
                  <label className="form-label">Priority Level</label>
                  <select
                    className="form-select"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical (Triggers Alert)</option>
                  </select>
                </div>

                {/* Assignee */}
                <div className="form-group">
                  <label className="form-label">Responsible Assignee</label>
                  <select
                    className="form-select"
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>

                {/* Team Ownership */}
                <div className="form-group">
                  <label className="form-label">Team Ownership</label>
                  <input
                    type="text"
                    className="form-input"
                    value={item.team_name || item.team_id}
                    disabled
                    style={{ opacity: 0.7 }}
                  />
                </div>
              </div>

              {/* Required Next Action */}
              <div className="form-group">
                <label className="form-label">What Requires Attention Next?</label>
                <input
                  type="text"
                  className="form-input"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="Specify immediate required action..."
                />
              </div>

              {/* Activity / Comment Input */}
              <div className="form-group">
                <label className="form-label">Add Note / Comment (Logged to Audit History)</label>
                <textarea
                  className="form-textarea"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add details about your investigation, action taken, or reasoning..."
                />
              </div>
            </>
          ) : (
            <TimelineHistory activities={activities} />
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <RefreshCw className="spin" size={16} /> : <CheckCircle size={16} />}
            <span>Save & Commit (v{item.version})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
