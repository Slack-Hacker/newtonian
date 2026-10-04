# Newtonite Operations Platform — Operations Under Pressure

An internal, high-reliability web application designed for enterprise teams to coordinate, triage, approve, and track operational work items under high pressure and concurrent usage.

![Newtonite Operations Platform](https://img.shields.shields.gov/badge/Status-Production--Ready-brightgreen)
![TypeScript](https://img.shields.shields.gov/badge/TypeScript-5.7-blue)
![Node](https://img.shields.shields.gov/badge/Node.js-24-green)
![Tests](https://img.shields.shields.gov/badge/Tests-Passing-success)

---

## 🌟 Key System Features

1. **Optimistic Concurrency Control (HTTP 409 Conflict Handling)**
   - Protects against simultaneous edits ("lost updates") via `version` counter locking.
   - When concurrent edits mismatch, returns HTTP 409 Conflict with full server state for UI reconciliation.

2. **Idempotent Operations & Duplicate Prevention**
   - Header `X-Idempotency-Key` prevents duplicate work item creation or state transitions during network retries or double clicks.

3. **Strict Workflow State Machine**
   - Backend-enforced valid transition paths: `DRAFT` ➔ `OPEN` ➔ `IN_PROGRESS` ➔ `PENDING_APPROVAL` ➔ `RESOLVED` ➔ `CLOSED`.
   - Rejects illegal state jumps with HTTP 400 Bad Request.
   - Role-gated approvals: Only `TEAM_LEAD` or `ADMIN` roles can approve items in `PENDING_APPROVAL`.

4. **Resource & Team-Level RBAC / ABAC**
   - User identities (`Alice`, `Bob`, `Carol`, `David`, `Eva`, `Frank`) belong to specific teams with defined roles (`ADMIN`, `TEAM_LEAD`, `TEAM_MEMBER`, `VIEWER`).
   - Server-side authorization checks block unauthorized cross-team modifications with HTTP 403 Forbidden.

5. **Asynchronous Task Queue & Audit Trail**
   - Background worker processes notifications and SLA tracking asynchronously with automatic retry backoff.
   - Comprehensive timeline history tracking every state change, reassignment, priority shift, and comment with full diffs.

6. **Interactive Demo Persona Switcher**
   - Switch between 6 user identities in the top navigation bar on the fly to test RBAC permissions and concurrency scenarios.

---

## 🚀 Quick Start Instructions

### Prerequisites
- **Node.js**: v18+ (Tested on Node.js v24)
- **npm**: v9+

### Installation & Run

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server** (API Server on port 3001 & Frontend on Vite port 3000):
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:3000`.

3. **Run Automated Test Suite**:
   ```bash
   npm test
   ```
   Runs Vitest automated integration tests validating optimistic locking, idempotency, RBAC, and workflow state machine rules.

---

## 📁 Repository Structure

```
newtonian/
├── ENGINEERING_DECISIONS.md # Document explaining key decisions & trade-offs
├── README.md                # System documentation & setup guide
├── vitest.config.ts         # Vitest test runner configuration
├── server/
│   ├── index.ts             # Express server entry point
│   ├── db/
│   │   ├── database.ts      # SQLite connection with WAL mode
│   │   └── seed.ts          # Seed data generator for users, teams & items
│   ├── middleware/
│   │   ├── auth.ts          # Persona & RBAC authorization middleware
│   │   └── idempotency.ts   # Idempotency response caching middleware
│   ├── services/
│   │   ├── workItemService.ts # Business logic, OCC versioning, state machine
│   │   └── asyncQueue.ts    # Background job queue with retry loop
│   ├── routes/
│   │   ├── workItems.ts     # Work Items REST endpoints
│   │   ├── auth.ts          # User identities and team roles
│   │   └── stats.ts         # Operational metrics dashboard
│   └── tests/
│       └── operations.test.ts # Vitest automated test suite
├── client/
│   ├── index.html           # HTML entry point
│   ├── vite.config.ts       # Vite build & proxy config
│   └── src/
│       ├── App.tsx          # Main React application
│       ├── api/client.ts    # Fetch wrapper with idempotency & error handling
│       ├── components/      # UI components (Header, Table, DetailModal, etc.)
│       └── styles/index.css # Dark mode operational design system
```

---

## 🧪 Testing Concurrency & RBAC Scenarios

- **Testing Concurrency Conflict**:
  1. Open a Work Item detail modal as `Alice`. Note the version (e.g. `v1`).
  2. Switch persona in top-right to `Carol` in another tab or window and update the work item (version becomes `v2`).
  3. Attempt to save changes in the first modal as `Alice` -> **HTTP 409 Conflict Banner** appears, warning that the version is stale and offering one-click server state reconciliation.

- **Testing RBAC Authorization**:
  1. Switch persona to `Frank (Viewer - Customer Support)`.
  2. Try creating a work item for `Compliance & Legal` -> **HTTP 403 Forbidden** toast appears.
  3. Try approving a `PENDING_APPROVAL` item -> Blocked by server-side authorization check.

---

## 📄 License
Newtonite Internal Engineering Challenge Candidate Solution.
