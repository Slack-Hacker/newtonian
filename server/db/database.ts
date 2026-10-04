import { DatabaseSync } from 'node:sqlite';
import path from 'path';

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'newtonian.db');

export const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign key constraints
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_teams (
      user_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      role TEXT NOT NULL,
      PRIMARY KEY (user_id, team_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS work_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      team_id TEXT NOT NULL,
      assignee_id TEXT,
      reporter_id TEXT NOT NULL,
      required_next_action TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id),
      FOREIGN KEY (assignee_id) REFERENCES users(id),
      FOREIGN KEY (reporter_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS work_item_activities (
      id TEXT PRIMARY KEY,
      work_item_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      old_values TEXT,
      new_values TEXT,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      request_path TEXT NOT NULL,
      response_status INTEGER NOT NULL,
      response_body TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS async_jobs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_work_items_team ON work_items(team_id);
    CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(status);
    CREATE INDEX IF NOT EXISTS idx_work_items_priority ON work_items(priority);
    CREATE INDEX IF NOT EXISTS idx_work_items_assignee ON work_items(assignee_id);
    CREATE INDEX IF NOT EXISTS idx_work_items_created ON work_items(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_activities_item ON work_item_activities(work_item_id, created_at DESC);
  `);
}

export default db;
