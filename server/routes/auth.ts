import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import db from '../db/database.js';

const router = Router();

// GET /api/auth/me - Current identity and team memberships
router.get('/me', (req: AuthenticatedRequest, res: Response) => {
  return res.json(req.userContext);
});

// GET /api/auth/users - List all users with team memberships for switching personas
router.get('/users', (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = db.prepare('SELECT id, name, email, avatar_url, created_at FROM users').all() as any[];
    
    for (const u of users) {
      u.teams = db.prepare(`
        SELECT ut.team_id, t.name as team_name, ut.role 
        FROM user_teams ut
        JOIN teams t ON ut.team_id = t.id
        WHERE ut.user_id = ?
      `).all(u.id);
    }

    return res.json(users);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

// GET /api/auth/teams - List all teams
router.get('/teams', (req: AuthenticatedRequest, res: Response) => {
  try {
    const teams = db.prepare('SELECT id, name, description FROM teams').all();
    return res.json(teams);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch teams', details: err.message });
  }
});

export default router;
