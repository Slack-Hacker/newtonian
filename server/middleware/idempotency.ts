import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';
import db from '../db/database.js';

export function idempotencyMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const idempotencyKey = req.headers['x-idempotency-key'] as string;

  // Only apply to state-modifying HTTP methods if key is provided
  if (!idempotencyKey || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const userId = req.userContext?.id || 'anonymous';
  const requestPath = req.originalUrl || req.url;

  try {
    // Check if idempotency key exists in DB
    const existing = db.prepare('SELECT response_status, response_body FROM idempotency_keys WHERE key = ? AND user_id = ?')
      .get(idempotencyKey, userId) as any;

    if (existing) {
      // Return cached response directly
      res.setHeader('X-Cache-Lookup', 'IDEMPOTENT_HIT');
      return res.status(existing.response_status).json(JSON.parse(existing.response_body));
    }

    // Intercept res.json to save response to database
    const originalJson = res.json.bind(res);
    res.json = (body: any): Response => {
      // Only cache successful or client error responses (don't cache 5xx internal server errors)
      if (res.statusCode < 500) {
        try {
          db.prepare(`
            INSERT OR IGNORE INTO idempotency_keys (key, user_id, request_path, response_status, response_body)
            VALUES (?, ?, ?, ?, ?)
          `).run(idempotencyKey, userId, requestPath, res.statusCode, JSON.stringify(body));
        } catch (e) {
          console.error('Failed to store idempotency record:', e);
        }
      }
      return originalJson(body);
    };

    next();
  } catch (err) {
    console.error('Idempotency middleware error:', err);
    next();
  }
}
