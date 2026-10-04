# Newtonite Operations Platform — Engineering Decisions & Architectural Trade-offs

## Executive Summary
This document details five key engineering decisions made during the design and development of the **Newtonite Operations Under Pressure** work management system. The architecture prioritizes data correctness under concurrent usage, explicit state control, server-enforced authorization, and architectural resilience.

---

## 1. Optimistic Concurrency Control via Version Counter (HTTP 409 Conflict)

### Problem
In high-throughput operational environments, multiple employees frequently view, triage, or modify the same work item simultaneously. Without concurrency controls, the last writer silently overwrites previous updates (the "Lost Update" problem).

### Decision & Trade-offs
- **Chosen Pattern**: Optimistic Concurrency Control (OCC) using an incrementing `version` integer column on the `work_items` table.
- **Implementation**:
  - Every update request must supply the version number the user was viewing (`WHERE id = ? AND version = ?`).
  - If another user committed a change first, the row update count is `0`.
  - The server immediately returns an **HTTP 409 Conflict** status with a payload containing the updated server state.
  - The frontend UI displays an interactive conflict resolution banner, allowing the user to reconcile their changes against the latest server state.
- **Trade-off**: Optimistic locking was chosen over pessimistic database locks (`SELECT ... FOR UPDATE`) because operational work item edits take seconds to minutes of user thinking time. Holding long-lived database locks would freeze resources and severely degrade concurrency under high user load.

---

## 2. Server-Enforced State Machine Workflow & Role-Gated Approvals

### Problem
Critical operational tasks (such as financial refunds, high-severity production incidents, or GDPR data deletions) require structured approval processes and must not bypass required verification steps or move directly from `OPEN` to `RESOLVED` without investigation.

### Decision & Trade-offs
- **Chosen Pattern**: Immutable State Transition Matrix enforced strictly at the API service layer.
- **Implementation**:
  - Work items transition cleanly through allowed paths:
    $$\text{DRAFT} \rightarrow \text{OPEN} \rightarrow \text{IN_PROGRESS} \rightarrow \text{PENDING_APPROVAL} \rightarrow \text{RESOLVED} \rightarrow \text{CLOSED}$$
  - Illegal transition attempts (e.g., `OPEN` directly to `RESOLVED`) are rejected with **HTTP 400 Bad Request**.
  - Transitioning from `PENDING_APPROVAL` to `RESOLVED` requires `TEAM_LEAD` or `ADMIN` authority for the item's team.
- **Trade-off**: Hardcoding the state transition rules in the service layer ensures maximum reliability and testability for the current business requirements, trading off the complexity of a dynamically user-configurable workflow engine.

---

## 3. Idempotency Key Middleware for Request Duplication Prevention

### Problem
Under high load or unstable network conditions, users often double-click submit buttons or retry requests when an operation takes time, risking duplicate item creation or repeated state mutations.

### Decision & Trade-offs
- **Chosen Pattern**: Server-side Idempotency Key matching (`X-Idempotency-Key` header).
- **Implementation**:
  - State-mutating API calls (`POST`, `PATCH`) record the idempotency key, user ID, request path, status code, and response body in an `idempotency_keys` table.
  - If a duplicate request arrives with an existing key, the server returns the cached response with header `X-Cache-Lookup: IDEMPOTENT_HIT`, bypassing re-execution.
- **Trade-off**: Persisting idempotency records requires minor database storage overhead, but guarantees zero duplicate side-effects during network retries.

---

## 4. Asynchronous Background Task Queue with Persistent Retries

### Problem
Secondary operations—such as sending team notifications, recording audit logs, and calculating SLA deadlines—should not block the primary HTTP response path. Furthermore, transient network failures in secondary services must not cause the primary operation to fail.

### Decision & Trade-offs
- **Chosen Pattern**: Persistent SQLite-backed task queue with background worker execution and retry backoff.
- **Implementation**:
  - State changes enqueue an event record (`async_jobs`) with initial status `PENDING`.
  - An asynchronous worker processes pending jobs in batches, automatically retrying up to 3 times upon failure before marking them as `FAILED` (dead-letter status).
- **Trade-off**: Using an in-memory/DB-backed worker queue avoids introducing external infrastructure dependencies (like Redis or RabbitMQ) while fulfilling reliable async guarantees within a single deployment unit.

---

## 5. Team-Based Role Authorization Model (RBAC / ABAC)

### Problem
Simply hiding UI controls for unauthorized users is insecure; malicious or accidental API calls could modify work items belonging to restricted teams (e.g., Compliance or Finance).

### Decision & Trade-offs
- **Chosen Pattern**: Dual-level authorization model (Global Roles + Team-Specific Roles) enforced in Express middleware and service layer.
- **Implementation**:
  - Roles (`ADMIN`, `TEAM_LEAD`, `TEAM_MEMBER`, `VIEWER`) determine allowable actions (`work_item:create`, `work_item:edit`, `work_item:approve`).
  - Every write request validates user team membership. Non-members receive an explicit **HTTP 403 Forbidden** error.
- **Trade-off**: A explicit team-role mapping was implemented rather than arbitrary dynamic policies to keep authorization fast, transparent, and easy to audit.

---

## What Was Intentionally Omitted & Future Extensions
1. **Pessimistic WebSocket Real-Time Locks**: Replaced with optimistic versioning to avoid socket reconnection fragility and state synchronization bugs.
2. **Distributed Redis Broker**: Kept in SQLite WAL mode for simplicity and zero-dependency local setup.
3. **Future Scaling (Next 6 Months)**: Transitioning from SQLite WAL to PostgreSQL for multi-region active-active clusters, and replacing in-memory async worker with BullMQ / Redis.
