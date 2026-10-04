import React from 'react';
import { WorkItemActivity } from '../types/index.js';
import { Clock, MessageSquare, ArrowRight, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface TimelineHistoryProps {
  activities: WorkItemActivity[];
}

export const TimelineHistory: React.FC<TimelineHistoryProps> = ({ activities }) => {
  if (activities.length === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No activity logged yet.</div>;
  }

  const formatActionName = (action: string) => {
    switch (action) {
      case 'CREATED': return { label: 'Created Item', color: 'var(--accent-blue)', icon: Clock };
      case 'STATUS_CHANGE': return { label: 'Status Change', color: 'var(--accent-amber)', icon: ArrowRight };
      case 'ASSIGNED':
      case 'REASSIGNED': return { label: 'Reassigned', color: 'var(--accent-cyan)', icon: ArrowRight };
      case 'APPROVAL_SUBMITTED': return { label: 'Approval Requested', color: 'var(--accent-purple)', icon: AlertTriangle };
      case 'APPROVED': return { label: 'Approved', color: 'var(--accent-emerald)', icon: ShieldCheck };
      case 'REJECTED': return { label: 'Rejected', color: 'var(--accent-rose)', icon: AlertTriangle };
      case 'COMMENT_ADDED': return { label: 'Comment', color: 'var(--text-secondary)', icon: MessageSquare };
      default: return { label: action, color: 'var(--accent-blue)', icon: Clock };
    }
  };

  return (
    <div className="timeline">
      {activities.map((act) => {
        const { label, color, icon: Icon } = formatActionName(act.action_type);
        const oldVals = act.old_values ? JSON.parse(act.old_values) : null;
        const newVals = act.new_values ? JSON.parse(act.new_values) : null;

        return (
          <div key={act.id} className="timeline-item">
            <div className="timeline-dot" style={{ backgroundColor: color }} />
            <div className="timeline-content">
              <div className="timeline-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Icon size={14} color={color} />
                  <span className="timeline-author">{act.user_name || 'System User'}</span>
                  <span style={{ color: 'var(--text-muted)' }}>• {label}</span>
                </div>
                <span>{new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              {act.comment && (
                <div style={{ fontSize: '0.875rem', marginTop: '0.2rem', color: 'var(--text-primary)', fontStyle: act.action_type === 'COMMENT_ADDED' ? 'normal' : 'italic' }}>
                  "{act.comment}"
                </div>
              )}

              {newVals && (
                <div style={{ fontSize: '0.775rem', marginTop: '0.3rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-main)', padding: '0.4rem 0.6rem', borderRadius: '4px' }}>
                  {Object.keys(newVals).map((key) => (
                    <div key={key}>
                      <strong>{key}:</strong> {oldVals?.[key] ? `${oldVals[key]} ➔ ` : ''} <span>{newVals[key]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
