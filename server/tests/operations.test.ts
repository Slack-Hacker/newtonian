import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { seedDatabase } from '../db/seed.js';

describe('Newtonite Operational Systems Test Suite', () => {

  beforeAll(() => {
    // Force re-seed fresh tables for deterministic tests
    seedDatabase(true);
  });

  describe('1. Optimistic Concurrency Control (Conflict Handling)', () => {
    it('should reject stale update with HTTP 409 Conflict when version mismatches', async () => {
      // 1. Fetch existing item WI-1001 (version 2 in seed data)
      const fetchRes = await request(app)
        .get('/api/work-items/WI-1001')
        .set('x-user-id', 'usr_alice');
      
      expect(fetchRes.status).toBe(200);
      const initialVersion = fetchRes.body.version;

      // 2. User A successfully updates the item (version 2 -> 3)
      const userARes = await request(app)
        .patch('/api/work-items/WI-1001')
        .set('x-user-id', 'usr_alice')
        .send({
          version: initialVersion,
          title: 'Database Spike - Resolved initial pool size',
          required_next_action: 'Monitor connection metrics.'
        });

      expect(userARes.status).toBe(200);
      expect(userARes.body.version).toBe(initialVersion + 1);

      // 3. User B tries to update using old version (initialVersion) -> MUST fail with 409 Conflict
      const userBRes = await request(app)
        .patch('/api/work-items/WI-1001')
        .set('x-user-id', 'usr_carol')
        .send({
          version: initialVersion, // Stale version!
          title: 'Stale update attempt from Carol',
          required_next_action: 'Should be rejected.'
        });

      expect(userBRes.status).toBe(409);
      expect(userBRes.body.conflict).toBe(true);
      expect(userBRes.body.error).toContain('updated by another user');
      expect(userBRes.body.currentWorkItem.version).toBe(initialVersion + 1);
    });
  });

  describe('2. Idempotency & Duplicate Operation Prevention', () => {
    it('should return identical cached response for duplicate requests with same Idempotency Key', async () => {
      const idempotencyKey = `idemp_test_${Date.now()}`;

      const payload = {
        title: 'Idempotency Validation Request',
        description: 'Testing duplicate POST request handling',
        category: 'ENGINEERING_PROBLEM',
        priority: 'MEDIUM',
        team_id: 'team_eng'
      };

      // First request
      const firstRes = await request(app)
        .post('/api/work-items')
        .set('x-user-id', 'usr_alice')
        .set('x-idempotency-key', idempotencyKey)
        .send(payload);

      expect(firstRes.status).toBe(201);
      const createdItemId = firstRes.body.id;

      // Second request with SAME key
      const secondRes = await request(app)
        .post('/api/work-items')
        .set('x-user-id', 'usr_alice')
        .set('x-idempotency-key', idempotencyKey)
        .send(payload);

      expect(secondRes.status).toBe(201);
      expect(secondRes.headers['x-cache-lookup']).toBe('IDEMPOTENT_HIT');
      expect(secondRes.body.id).toBe(createdItemId);
    });
  });

  describe('3. Resource-Level Authorization (RBAC / ABAC)', () => {
    it('should block non-team members with 403 Forbidden when creating item in unauthorized team', async () => {
      // Frank (usr_frank) is only VIEWER in team_supp, not in team_comp
      const res = await request(app)
        .post('/api/work-items')
        .set('x-user-id', 'usr_frank')
        .send({
          title: 'Unauthorized Audit Request',
          description: 'Frank should not be allowed here',
          category: 'COMPLIANCE_REQUEST',
          priority: 'HIGH',
          team_id: 'team_comp'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('permission');
    });

    it('should block TEAM_MEMBER from approving PENDING_APPROVAL work item', async () => {
      // Fetch fresh version of WI-1002
      const itemRes = await request(app).get('/api/work-items/WI-1002').set('x-user-id', 'usr_alice');
      const v = itemRes.body.version;

      // Carol (usr_carol) is in team_eng, not team_fin lead
      const res = await request(app)
        .patch('/api/work-items/WI-1002')
        .set('x-user-id', 'usr_carol')
        .send({
          version: v,
          status: 'RESOLVED'
        });

      expect(res.status).toBe(403);
    });

    it('should allow TEAM_LEAD to approve PENDING_APPROVAL work item', async () => {
      // Fetch fresh version of WI-1002
      const itemRes = await request(app).get('/api/work-items/WI-1002').set('x-user-id', 'usr_alice');
      const v = itemRes.body.version;

      // David (usr_david) is TEAM_LEAD in team_fin
      const res = await request(app)
        .patch('/api/work-items/WI-1002')
        .set('x-user-id', 'usr_david')
        .send({
          version: v,
          status: 'RESOLVED'
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('RESOLVED');
    });
  });

  describe('4. State Machine Workflow Rule Enforcement', () => {
    it('should reject invalid state transitions with 400 Bad Request', async () => {
      // Fetch fresh version of WI-1003 (status OPEN)
      const itemRes = await request(app).get('/api/work-items/WI-1003').set('x-user-id', 'usr_eva');
      const v = itemRes.body.version;

      // Trying to transition directly to 'RESOLVED' should fail.
      const res = await request(app)
        .patch('/api/work-items/WI-1003')
        .set('x-user-id', 'usr_eva')
        .send({
          version: v,
          status: 'RESOLVED'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid state transition');
    });

    it('should allow valid state transition from OPEN to IN_PROGRESS', async () => {
      // Fetch fresh version of WI-1003
      const itemRes = await request(app).get('/api/work-items/WI-1003').set('x-user-id', 'usr_eva');
      const v = itemRes.body.version;

      const res = await request(app)
        .patch('/api/work-items/WI-1003')
        .set('x-user-id', 'usr_eva')
        .send({
          version: v,
          status: 'IN_PROGRESS'
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('IN_PROGRESS');
    });
  });
});
