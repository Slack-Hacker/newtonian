import React, { useState } from 'react';
import { User, Team, WorkItemCategory, WorkItemPriority } from '../types/index.js';
import { X, Plus, AlertCircle } from 'lucide-react';
import { api, generateIdempotencyKey } from '../api/client.js';

interface CreateModalProps {
  activeUser: User;
  users: User[];
  teams: Team[];
  onClose: () => void;
  onSuccess: () => void;
  onToast: (msg: string, type: 'error' | 'success' | 'warning') => void;
}

export const CreateWorkItemModal: React.FC<CreateModalProps> = ({
  activeUser,
  users,
  teams,
  onClose,
  onSuccess,
  onToast
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<WorkItemCategory>('CUSTOMER_ISSUE');
  const [priority, setPriority] = useState<WorkItemPriority>('MEDIUM');
  const [teamId, setTeamId] = useState(teams[0]?.id || 'team_eng');
  const [assigneeId, setAssigneeId] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      onToast('Title and description are required', 'error');
      return;
    }

    setIsSubmitting(true);
    // Generate explicit idempotency key to prevent accidental duplicate submission
    const idempotencyKey = generateIdempotencyKey();

    try {
      await api.createWorkItem({
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        team_id: teamId,
        assignee_id: assigneeId || null,
        required_next_action: nextAction.trim() || 'Initial triage.'
      }, activeUser.id, idempotencyKey);

      onToast('Operational Work Item created successfully', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      onToast(err.message || 'Failed to create work item', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Create New Operational Work Item</h2>
          <button className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Title / Summary *</label>
              <input
                type="text"
                className="form-input"
                required
                placeholder="e.g. Database Spike on Webhook Handler"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as WorkItemCategory)}
                >
                  <option value="CUSTOMER_ISSUE">Customer Escalation</option>
                  <option value="ENGINEERING_PROBLEM">Engineering Problem</option>
                  <option value="PAYMENT_INVESTIGATION">Payment Investigation</option>
                  <option value="PRODUCTION_INCIDENT">Production Incident</option>
                  <option value="COMPLIANCE_REQUEST">Compliance & Legal</option>
                  <option value="OPERATIONAL_APPROVAL">Operational Approval</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Priority</label>
                <select
                  className="form-select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as WorkItemPriority)}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Target Team Ownership</label>
                <select
                  className="form-select"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Initial Assignee</label>
                <select
                  className="form-select"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Detailed Description & Context *</label>
              <textarea
                className="form-textarea"
                required
                placeholder="Provide full context, root cause hypothesis, or customer details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Required Next Action</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Investigate slow query log and increase connection limit"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              <Plus size={16} />
              <span>Create Work Item</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
