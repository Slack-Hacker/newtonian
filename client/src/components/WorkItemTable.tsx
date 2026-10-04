import React from 'react';
import { WorkItem } from '../types/index.js';
import { User, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';

interface TableProps {
  workItems: WorkItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onSelectItem: (item: WorkItem) => void;
  onPageChange: (page: number) => void;
  isLoading: boolean;
}

export const WorkItemTable: React.FC<TableProps> = ({
  workItems,
  meta,
  onSelectItem,
  onPageChange,
  isLoading
}) => {
  const formatCategory = (cat: string) => {
    return cat.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="table-container">
      <table className="work-table">
        <thead>
          <tr>
            <th>ID / Category</th>
            <th>Work Item & Next Action</th>
            <th>Team</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Assignee</th>
            <th>Version</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                Loading work items...
              </td>
            </tr>
          ) : workItems.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No operational work items found matching current filters.
              </td>
            </tr>
          ) : (
            workItems.map((item) => (
              <tr key={item.id} onClick={() => onSelectItem(item)}>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                    <span className="item-id">{item.id}</span>
                    <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>{formatCategory(item.category)}</span>
                  </div>
                </td>

                <td>
                  <div className="item-title-col">
                    <span className="item-title">{item.title}</span>
                    <span className="item-subtitle">
                      <strong>Next Action:</strong> {item.required_next_action || 'Pending triage'}
                    </span>
                  </div>
                </td>

                <td>
                  <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>{item.team_name || item.team_id}</span>
                </td>

                <td>
                  <span className={`priority-pill priority-${item.priority}`}>{item.priority}</span>
                </td>

                <td>
                  <span className={`status-pill status-${item.status}`}>
                    <span className="status-dot" />
                    <span>{item.status.replace('_', ' ')}</span>
                  </span>
                </td>

                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.825rem' }}>
                    <User size={14} color="var(--text-muted)" />
                    <span>{item.assignee_name || 'Unassigned'}</span>
                  </div>
                </td>

                <td>
                  <span className="version-badge">v{item.version}</span>
                </td>

                <td>
                  <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                    {new Date(item.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination Footer */}
      <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Showing <strong>{workItems.length}</strong> of <strong>{meta.total}</strong> active operational work items
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.65rem' }}
            disabled={meta.page <= 1}
            onClick={() => onPageChange(meta.page - 1)}
          >
            <ChevronLeft size={16} />
            <span>Prev</span>
          </button>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Page {meta.page} of {meta.totalPages || 1}</span>
          <button
            className="btn btn-secondary"
            style={{ padding: '0.35rem 0.65rem' }}
            disabled={meta.page >= meta.totalPages}
            onClick={() => onPageChange(meta.page + 1)}
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
