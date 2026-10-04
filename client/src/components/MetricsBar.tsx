import React from 'react';
import { StatsResponse } from '../types/index.js';

interface MetricsBarProps {
  stats: StatsResponse | null;
  activeFilter: string | null;
  onFilterClick: (statusFilter: string | null) => void;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({ stats, activeFilter, onFilterClick }) => {
  if (!stats) return null;

  return (
    <div className="metrics-grid">
      <div 
        className="metric-card" 
        style={{ cursor: 'pointer', borderColor: activeFilter === null ? 'var(--accent-blue)' : undefined }}
        onClick={() => onFilterClick(null)}
      >
        <span className="metric-title">Active Work Items</span>
        <span className="metric-value" style={{ color: 'var(--accent-blue)' }}>{stats.totalOpen}</span>
      </div>

      <div 
        className="metric-card"
        style={{ cursor: 'pointer', borderColor: activeFilter === 'PENDING_APPROVAL' ? 'var(--accent-purple)' : undefined }}
        onClick={() => onFilterClick('PENDING_APPROVAL')}
      >
        <span className="metric-title">Pending Approval</span>
        <span className="metric-value" style={{ color: 'var(--accent-purple)' }}>{stats.pendingApproval}</span>
      </div>

      <div className="metric-card">
        <span className="metric-title">Critical Incidents</span>
        <span className="metric-value" style={{ color: 'var(--accent-rose)' }}>{stats.criticalIncidents}</span>
      </div>

      <div className="metric-card">
        <span className="metric-title">Assigned to Me</span>
        <span className="metric-value" style={{ color: 'var(--accent-amber)' }}>{stats.myAssigned}</span>
      </div>

      <div 
        className="metric-card"
        style={{ cursor: 'pointer', borderColor: activeFilter === 'RESOLVED' ? 'var(--accent-emerald)' : undefined }}
        onClick={() => onFilterClick('RESOLVED')}
      >
        <span className="metric-title">Resolved & Closed</span>
        <span className="metric-value" style={{ color: 'var(--accent-emerald)' }}>{stats.totalResolved}</span>
      </div>
    </div>
  );
};
