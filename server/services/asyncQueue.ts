import db from '../db/database.js';

export interface AsyncJobPayload {
  type: 'NOTIFICATION' | 'SLA_EVALUATION' | 'AUDIT_DISPATCH';
  workItemId: string;
  triggeredByUserId: string;
  details?: Record<string, any>;
}

class AsyncQueueService {
  private isProcessing = false;

  constructor() {
    // Start background processing loop every 3 seconds
    setInterval(() => this.processNextBatch(), 3000);
  }

  /**
   * Enqueues a background job to SQLite table
   */
  public enqueue(payload: AsyncJobPayload): string {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    db.prepare(`
      INSERT INTO async_jobs (id, type, payload, status, retry_count, max_retries)
      VALUES (?, ?, ?, 'PENDING', 0, 3)
    `).run(jobId, payload.type, JSON.stringify(payload));

    // Trigger immediate batch processing
    setImmediate(() => this.processNextBatch());
    return jobId;
  }

  /**
   * Batch processes pending background jobs with retries
   */
  private async processNextBatch() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pendingJobs = db.prepare(`
        SELECT id, type, payload, retry_count, max_retries
        FROM async_jobs
        WHERE status IN ('PENDING', 'RETRY')
        ORDER BY created_at ASC
        LIMIT 5
      `).all() as any[];

      for (const job of pendingJobs) {
        db.prepare("UPDATE async_jobs SET status = 'PROCESSING' WHERE id = ?").run(job.id);
        
        try {
          const payload = JSON.parse(job.payload) as AsyncJobPayload;
          await this.executeJob(payload);

          db.prepare(`
            UPDATE async_jobs 
            SET status = 'COMPLETED', processed_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(job.id);
        } catch (error: any) {
          const newRetryCount = job.retry_count + 1;
          if (newRetryCount >= job.max_retries) {
            db.prepare(`
              UPDATE async_jobs 
              SET status = 'FAILED', retry_count = ?, error_message = ?, processed_at = CURRENT_TIMESTAMP 
              WHERE id = ?
            `).run(newRetryCount, error.message || 'Job execution failed', job.id);
          } else {
            db.prepare(`
              UPDATE async_jobs 
              SET status = 'RETRY', retry_count = ?, error_message = ? 
              WHERE id = ?
            `).run(newRetryCount, error.message || 'Retry scheduled', job.id);
          }
        }
      }
    } catch (e) {
      console.error('Error in async queue processing batch:', e);
    } finally {
      this.isProcessing = false;
    }
  }

  private async executeJob(payload: AsyncJobPayload): Promise<void> {
    // Simulate job processing work (e.g. sending team alert, updating audit logs)
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[AsyncWorker] Executing ${payload.type} for Work Item ${payload.workItemId}...`);
    }

    // Simulate occasional transient error for test/resilience demonstration if requested
    if (payload.details?.forceFail && payload.details?.attemptCount === 0) {
      payload.details.attemptCount = 1;
      throw new Error('Simulated transient webhook timeout - scheduled for retry.');
    }
  }

  public getJobStats() {
    return db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM async_jobs 
      GROUP BY status
    `).all();
  }
}

export const asyncQueue = new AsyncQueueService();
