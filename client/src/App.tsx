import React, { useState, useEffect } from 'react';
import { User, Team, WorkItem, StatsResponse } from './types/index.js';
import { Header } from './components/Header.js';
import { MetricsBar } from './components/MetricsBar.js';
import { WorkItemFilters } from './components/WorkItemFilters.js';
import { WorkItemTable } from './components/WorkItemTable.js';
import { WorkItemDetailModal } from './components/WorkItemDetailModal.js';
import { CreateWorkItemModal } from './components/CreateWorkItemModal.js';
import { ToastContainer, ToastMessage } from './components/Toast.js';
import { api } from './api/client.js';

export function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeUser, setActiveUser] = useState<User | null>(null);

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Filters State
  const [filters, setFilters] = useState({
    team_id: '',
    status: '',
    priority: '',
    search: '',
    onlyMyAssigned: false
  });

  const [isLoading, setIsLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WorkItem | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (text: string, type: 'error' | 'success' | 'warning' | 'info' = 'info') => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  // 1. Initial Load: Users & Teams
  useEffect(() => {
    const initData = async () => {
      try {
        const [uList, tList] = await Promise.all([
          api.getUsers(),
          api.getTeams()
        ]);
        setUsers(uList);
        setTeams(tList);
        // Default persona to Alice (Admin & Eng Lead)
        const defaultAlice = uList.find((u) => u.id === 'usr_alice') || uList[0];
        setActiveUser(defaultAlice || null);
      } catch (err: any) {
        showToast('Failed to initialize platform data', 'error');
      }
    };
    initData();
  }, []);

  // 2. Fetch Stats & Work Items when filters or activeUser change
  useEffect(() => {
    if (activeUser) {
      fetchData();
    }
  }, [activeUser, filters, meta.page]);

  const fetchData = async () => {
    if (!activeUser) return;
    setIsLoading(true);

    try {
      const statsRes = await api.getStats(activeUser.id);
      setStats(statsRes);

      const itemsRes = await api.getWorkItems({
        ...filters,
        assignee_id: filters.onlyMyAssigned ? activeUser.id : undefined,
        page: meta.page,
        limit: meta.limit
      }, activeUser.id);

      setWorkItems(itemsRes.data);
      setMeta(itemsRes.meta);
    } catch (err: any) {
      showToast('Error loading work items: ' + err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setMeta((prev) => ({ ...prev, page: 1 }));
  };

  const handleResetFilters = () => {
    setFilters({
      team_id: '',
      status: '',
      priority: '',
      search: '',
      onlyMyAssigned: false
    });
    setMeta((prev) => ({ ...prev, page: 1 }));
  };

  const activeJobCount = stats?.asyncJobStats?.find(j => j.status === 'PENDING' || j.status === 'PROCESSING')?.count || 0;

  return (
    <div className="app-container">
      <Header
        users={users}
        activeUser={activeUser}
        onSelectUser={setActiveUser}
        onOpenCreateModal={() => setIsCreateOpen(true)}
        asyncJobCount={activeJobCount}
      />

      <main className="main-content">
        <MetricsBar
          stats={stats}
          activeFilter={filters.status || null}
          onFilterClick={(statusVal) => handleFilterChange('status', statusVal || '')}
        />

        <WorkItemFilters
          teams={teams}
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
        />

        <WorkItemTable
          workItems={workItems}
          meta={meta}
          onSelectItem={setSelectedItem}
          onPageChange={(p) => setMeta((prev) => ({ ...prev, page: p }))}
          isLoading={isLoading}
        />
      </main>

      {/* Detail & Edit Workspace Modal */}
      {selectedItem && activeUser && (
        <WorkItemDetailModal
          item={selectedItem}
          activeUser={activeUser}
          users={users}
          teams={teams}
          onClose={() => setSelectedItem(null)}
          onUpdateSuccess={() => fetchData()}
          onToast={showToast}
        />
      )}

      {/* Create Work Item Modal */}
      {isCreateOpen && activeUser && (
        <CreateWorkItemModal
          activeUser={activeUser}
          users={users}
          teams={teams}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => fetchData()}
          onToast={showToast}
        />
      )}

      {/* Notification Toast Stack */}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </div>
  );
}
