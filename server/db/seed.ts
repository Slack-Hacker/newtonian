import { db, initializeDatabase } from './database.js';

export function seedDatabase(force: boolean = false) {
  if (force || process.env.NODE_ENV === 'test') {
    db.exec(`
      DROP TABLE IF EXISTS work_item_activities;
      DROP TABLE IF EXISTS idempotency_keys;
      DROP TABLE IF EXISTS async_jobs;
      DROP TABLE IF EXISTS work_items;
      DROP TABLE IF EXISTS user_teams;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS teams;
    `);
  }

  initializeDatabase();

  const existingTeams = db.prepare('SELECT COUNT(*) as count FROM teams').get() as { count: number };
  if (existingTeams.count > 0) {
    return;
  }

  const insertTeam = db.prepare('INSERT INTO teams (id, name, description) VALUES (?, ?, ?)');
  const insertUser = db.prepare('INSERT INTO users (id, name, email, avatar_url) VALUES (?, ?, ?, ?)');
  const insertUserTeam = db.prepare('INSERT INTO user_teams (user_id, team_id, role) VALUES (?, ?, ?)');
  const insertWorkItem = db.prepare(`
    INSERT INTO work_items (
      id, title, description, category, status, priority, team_id, assignee_id, reporter_id, required_next_action, version, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertActivity = db.prepare(`
    INSERT INTO work_item_activities (
      id, work_item_id, user_id, action_type, old_values, new_values, comment, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Teams
  const teams = [
    { id: 'team_eng', name: 'Engineering', description: 'Core platform engineering and infrastructure incidents' },
    { id: 'team_supp', name: 'Customer Support', description: 'Tier 2 customer escalation and urgent account issues' },
    { id: 'team_fin', name: 'Finance & Payments', description: 'Payment reconciliation, billing anomalies, and payouts' },
    { id: 'team_comp', name: 'Compliance & Legal', description: 'Regulatory requests, GDPR compliance, and legal audits' },
    { id: 'team_ops', name: 'Operations', description: 'Operational workflows, approval requests, and partner logistics' }
  ];

  for (const t of teams) {
    insertTeam.run(t.id, t.name, t.description);
  }

  // Users
  const users = [
    { id: 'usr_alice', name: 'Alice Chen', email: 'alice@newtonite.com', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice' },
    { id: 'usr_bob', name: 'Bob Smith', email: 'bob@newtonite.com', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob' },
    { id: 'usr_carol', name: 'Carol Danvers', email: 'carol@newtonite.com', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Carol' },
    { id: 'usr_david', name: 'David Kim', email: 'david@newtonite.com', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David' },
    { id: 'usr_eva', name: 'Eva Martinez', email: 'eva@newtonite.com', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Eva' },
    { id: 'usr_frank', name: 'Frank Wright', email: 'frank@newtonite.com', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Frank' }
  ];

  for (const u of users) {
    insertUser.run(u.id, u.name, u.email, u.avatar);
  }

  // User Teams & Roles
  const userTeams = [
    { user_id: 'usr_alice', team_id: 'team_eng', role: 'ADMIN' },
    { user_id: 'usr_alice', team_id: 'team_supp', role: 'ADMIN' },
    { user_id: 'usr_bob', team_id: 'team_supp', role: 'TEAM_LEAD' },
    { user_id: 'usr_bob', team_id: 'team_fin', role: 'TEAM_MEMBER' },
    { user_id: 'usr_carol', team_id: 'team_eng', role: 'TEAM_MEMBER' },
    { user_id: 'usr_david', team_id: 'team_fin', role: 'TEAM_LEAD' },
    { user_id: 'usr_eva', team_id: 'team_comp', role: 'TEAM_LEAD' },
    { user_id: 'usr_eva', team_id: 'team_ops', role: 'TEAM_MEMBER' },
    { user_id: 'usr_frank', team_id: 'team_supp', role: 'VIEWER' }
  ];

  for (const ut of userTeams) {
    insertUserTeam.run(ut.user_id, ut.team_id, ut.role);
  }

  const now = new Date();
  const past = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60 * 1000).toISOString();

  const workItems = [
    {
      id: 'WI-1001',
      title: 'Database Spike on Payment Gateway Webhook Handler',
      description: 'DB connection pool exhaustion observed during peak hour traffic spike at 14:00 UTC. Need query optimization and connection limits.',
      category: 'PRODUCTION_INCIDENT',
      status: 'IN_PROGRESS',
      priority: 'CRITICAL',
      team_id: 'team_eng',
      assignee_id: 'usr_carol',
      reporter_id: 'usr_alice',
      next_action: 'Investigate slow query log and increase pgpool max clients.',
      version: 2,
      created_at: past(180),
      updated_at: past(45)
    },
    {
      id: 'WI-1002',
      title: 'High-Value Wire Refund Request ($45,000 USD)',
      description: 'Enterprise client #9402 requested manual wire refund due to duplicate charge during system failure.',
      category: 'PAYMENT_INVESTIGATION',
      status: 'PENDING_APPROVAL',
      priority: 'HIGH',
      team_id: 'team_fin',
      assignee_id: 'usr_david',
      reporter_id: 'usr_bob',
      next_action: 'Finance Lead review and dual-authorization approval needed before bank transfer.',
      version: 3,
      created_at: past(240),
      updated_at: past(20)
    },
    {
      id: 'WI-1003',
      title: 'GDPR Right to be Forgotten Request #881',
      description: 'User requested complete deletion of PII and transaction records across analytics & logging stores.',
      category: 'COMPLIANCE_REQUEST',
      status: 'OPEN',
      priority: 'MEDIUM',
      team_id: 'team_comp',
      assignee_id: 'usr_eva',
      reporter_id: 'usr_eva',
      next_action: 'Verify user identity and schedule data scrubbing pipeline.',
      version: 1,
      created_at: past(360),
      updated_at: past(360)
    },
    {
      id: 'WI-1004',
      title: 'Partner API OAuth Token Refresh Failures',
      description: 'Multiple support tickets received regarding 401 Unauthorized responses during automated daily sync.',
      category: 'CUSTOMER_ISSUE',
      status: 'RESOLVED',
      priority: 'HIGH',
      team_id: 'team_supp',
      assignee_id: 'usr_bob',
      reporter_id: 'usr_frank',
      next_action: 'Verify with client that token rotation issue is resolved.',
      version: 4,
      created_at: past(720),
      updated_at: past(90)
    },
    {
      id: 'WI-1005',
      title: 'Vendor Contract Renewal Approval - AWS Reserved Instances',
      description: 'Annual commit approval needed to secure 32% discount on compute infrastructure for Q4.',
      category: 'OPERATIONAL_APPROVAL',
      status: 'OPEN',
      priority: 'LOW',
      team_id: 'team_ops',
      assignee_id: null,
      reporter_id: 'usr_alice',
      next_action: 'Operations Lead review quote document and approve budget allocation.',
      version: 1,
      created_at: past(1200),
      updated_at: past(1200)
    }
  ];

  for (const wi of workItems) {
    insertWorkItem.run(
      wi.id, wi.title, wi.description, wi.category, wi.status, wi.priority,
      wi.team_id, wi.assignee_id, wi.reporter_id, wi.next_action, wi.version, wi.created_at, wi.updated_at
    );
  }

  const activities = [
    {
      id: 'act_101',
      work_item_id: 'WI-1001',
      user_id: 'usr_alice',
      action_type: 'CREATED',
      old_values: null,
      new_values: JSON.stringify({ title: 'Database Spike on Payment Gateway Webhook Handler', status: 'OPEN', priority: 'CRITICAL' }),
      comment: 'Created incident ticket after monitoring alert triggered.',
      created_at: past(180)
    },
    {
      id: 'act_102',
      work_item_id: 'WI-1001',
      user_id: 'usr_alice',
      action_type: 'ASSIGNED',
      old_values: JSON.stringify({ assignee_id: null }),
      new_values: JSON.stringify({ assignee_id: 'usr_carol' }),
      comment: 'Assigned to Carol for database log analysis.',
      created_at: past(170)
    },
    {
      id: 'act_103',
      work_item_id: 'WI-1001',
      user_id: 'usr_carol',
      action_type: 'STATUS_CHANGE',
      old_values: JSON.stringify({ status: 'OPEN' }),
      new_values: JSON.stringify({ status: 'IN_PROGRESS' }),
      comment: 'Replicated issue in staging environment. Working on connection pooling config.',
      created_at: past(45)
    }
  ];

  for (const act of activities) {
    insertActivity.run(
      act.id, act.work_item_id, act.user_id, act.action_type, act.old_values, act.new_values, act.comment, act.created_at
    );
  }
}
