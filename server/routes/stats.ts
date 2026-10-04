import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import db from '../db/database.js';
import { asyncQueue } from '../services/asyncQueue.js';

const router = Router();

// GET /api/stats - High level operational dashboard metrics
router.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.userContext!;
    
    const totalOpen = (db.prepare("SELECT COUNT(*) as count FROM work_items WHERE status IN ('OPEN', 'IN_PROGRESS')").get() as any).count;
    const pendingApproval = (db.prepare("SELECT COUNT(*) as count FROM work_items WHERE status = 'PENDING_APPROVAL'").get() as any).count;
    const criticalIncidents = (db.prepare("SELECT COUNT(*) as count FROM work_items WHERE priority = 'CRITICAL' AND status != 'CLOSED'").get() as any).count;
    const myAssigned = (db.prepare("SELECT COUNT(*) as count FROM work_items WHERE assignee_id = ? AND status != 'CLOSED'").get(user.id) as any).count;
    const totalResolved = (db.prepare("SELECT COUNT(*) as count FROM work_items WHERE status IN ('RESOLVED', 'CLOSED')").get() as any).count;

    return res.json({
      totalOpen,
      pendingApproval,
      criticalIncidents,
      myAssigned,
      totalResolved,
      asyncJobStats: asyncQueue.getJobStats()
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch stats', details: err.message });
  }
});

export default router;
