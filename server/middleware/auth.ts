import { Request, Response, NextFunction } from 'express';
import db from '../db/database.js';
import { AuthUserContext, Role } from '../types/index.js';

export interface AuthenticatedRequest extends Request {
  userContext?: AuthUserContext;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Get active user ID from header 'x-user-id', default to 'usr_alice' (Admin) if missing
  const userId = (req.headers['x-user-id'] as string) || 'usr_alice';

  try {
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(userId) as any;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized: User identity not found.' });
    }

    const userTeams = db.prepare(`
      SELECT ut.team_id, t.name as team_name, ut.role
      FROM user_teams ut
      JOIN teams t ON ut.team_id = t.id
      WHERE ut.user_id = ?
    `).all(userId) as any[];

    req.userContext = {
      id: user.id,
      name: user.name,
      email: user.email,
      teams: userTeams.map(t => ({
        team_id: t.team_id,
        team_name: t.team_name,
        role: t.role as Role
      }))
    };

    next();
  } catch (err: any) {
    return res.status(500).json({ error: 'Auth middleware error', details: err.message });
  }
}

/**
 * Checks whether user has permission to perform action on a team resource
 */
export function hasTeamRole(userContext: AuthUserContext, teamId: string, allowedRoles: Role[]): boolean {
  // Global ADMIN can perform any action across all teams
  const globalAdmin = userContext.teams.some(t => t.role === 'ADMIN');
  if (globalAdmin) return true;

  const teamMembership = userContext.teams.find(t => t.team_id === teamId);
  if (!teamMembership) return false;

  return allowedRoles.includes(teamMembership.role);
}
