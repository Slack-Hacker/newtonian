import React from 'react';
import { Team } from '../types/index.js';
import { Search, Filter, RotateCcw } from 'lucide-react';

interface FiltersProps {
  teams: Team[];
  filters: {
    team_id: string;
    status: string;
    priority: string;
    search: string;
    onlyMyAssigned: boolean;
  };
  onFilterChange: (key: string, value: any) => void;
  onReset: () => void;
}

export const WorkItemFilters: React.FC<FiltersProps> = ({
  teams,
  filters,
  onFilterChange,
  onReset
}) => {
  return (
    <div className="filters-bar">
      <div className="search-input-wrapper">
        <Search className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Search by ID, title, or keyword..."
          value={filters.search}
          onChange={(e) => onFilterChange('search', e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Filter size={16} color="var(--text-muted)" />
        <select
          className="filter-select"
          value={filters.team_id}
          onChange={(e) => onFilterChange('team_id', e.target.value)}
        >
          <option value="">All Teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={filters.status}
          onChange={(e) => onFilterChange('status', e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>

        <select
          className="filter-select"
          value={filters.priority}
          onChange={(e) => onFilterChange('priority', e.target.value)}
        >
          <option value="">All Priorities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', userSelect: 'none', marginLeft: '0.5rem' }}>
          <input
            type="checkbox"
            checked={filters.onlyMyAssigned}
            onChange={(e) => onFilterChange('onlyMyAssigned', e.target.checked)}
          />
          <span>Assigned to me</span>
        </label>

        <button className="btn btn-secondary" onClick={onReset} style={{ padding: '0.4rem 0.6rem' }} title="Reset filters">
          <RotateCcw size={14} />
        </button>
      </div>
    </div>
  );
};
