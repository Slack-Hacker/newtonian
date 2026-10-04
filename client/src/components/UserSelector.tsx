import React from 'react';
import { User } from '../types/index.js';

interface UserSelectorProps {
  users: User[];
  activeUser: User | null;
  onSelectUser: (user: User) => void;
}

export const UserSelector: React.FC<UserSelectorProps> = ({ users, activeUser, onSelectUser }) => {
  if (!activeUser) return null;

  // Find user's highest role for display badge
  const roles = activeUser.teams?.map(t => t.role) || [];
  const primaryRole = roles.includes('ADMIN') ? 'ADMIN' : roles.includes('TEAM_LEAD') ? 'TEAM_LEAD' : roles.includes('TEAM_MEMBER') ? 'TEAM_MEMBER' : 'VIEWER';

  return (
    <div className="user-persona-selector">
      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ACTING AS:</span>
      <select
        className="persona-select"
        value={activeUser.id}
        onChange={(e) => {
          const selected = users.find(u => u.id === e.target.value);
          if (selected) onSelectUser(selected);
        }}
      >
        {users.map(u => (
          <option key={u.id} value={u.id}>
            {u.name} ({u.email.split('@')[0]})
          </option>
        ))}
      </select>
      <span className={`role-badge ${primaryRole}`}>{primaryRole}</span>
    </div>
  );
};
