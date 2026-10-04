import React from 'react';
import { User } from '../types/index.js';
import { UserSelector } from './UserSelector.js';
import { Plus, ShieldAlert, Cpu } from 'lucide-react';

interface HeaderProps {
  users: User[];
  activeUser: User | null;
  onSelectUser: (user: User) => void;
  onOpenCreateModal: () => void;
  asyncJobCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  users,
  activeUser,
  onSelectUser,
  onOpenCreateModal,
  asyncJobCount = 0
}) => {
  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-logo">N</div>
        <div>
          <div className="brand-title">Newtonite Ops</div>
          <div style={{ fontSize: '0.725rem', color: 'var(--text-secondary)' }}>Operations Under Pressure Platform</div>
        </div>
      </div>

      <div className="header-actions">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-surface)', padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
          <Cpu size={14} color="var(--accent-cyan)" />
          <span>Worker Queue: <strong>{asyncJobCount} active</strong></span>
        </div>

        <UserSelector users={users} activeUser={activeUser} onSelectUser={onSelectUser} />

        <button className="btn btn-primary" onClick={onOpenCreateModal}>
          <Plus size={16} />
          <span>New Work Item</span>
        </button>
      </div>
    </header>
  );
};
