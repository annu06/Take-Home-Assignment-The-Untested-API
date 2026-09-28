# Submission Notes — Full Stack Developer Take-Home Assignment

**Candidate Submission:** The Untested API — Tested, Fixed & Enhanced  
**Position:** Full Stack Developer Intern  
**Submission Date:** September 2026  
**Test Suite Status:** 87 / 87 Tests Passing &bull; 98.8% Code Coverage  

---

## 1. Overview & Deliverables Summary

This submission transforms the untested Task Manager API into a production-grade, thoroughly tested, and resilient backend service with an accompanying interactive live dashboard.

### Key Deliverables:
1. **Comprehensive Test Suite** (`tests/unit/`, `tests/integration/`):
   - **87 automated tests** using Jest and Supertest.
   - **98.8% code coverage** across all files (`100%` on routes, services, and validators).
   - Covers happy paths, boundary conditions, input sanitization, error handling, and regression checks.
2. **Formal Bug Report** ([BUG_REPORT.md](./BUG_REPORT.md)):
   - Documents 6 distinct bugs discovered in the codebase with root causes, code locations, discovery methods, and fixes.
3. **Bug Fixes**:
   - Fixed **BUG-01** (priority reset to `'medium'` on completion).
   - Fixed **BUG-02** (1-based pagination off-by-one error skipping page 1).
   - Fixed **BUG-03** (substring status match in `getByStatus`).
   - Fixed **BUG-04** (falsy empty string `""` validation bypass).
   - Fixed **BUG-05** (`update()` mutating immutable fields `id` and `createdAt`).
   - Fixed **BUG-06** (composing `status` filtering with `page`/`limit` pagination).
4. **New Feature Implementation**:
   - Implemented `PATCH /tasks/:id/assign` with comprehensive input validation, reassignment support, and full unit and integration test coverage.
5. **Interactive Live Web Dashboard & API Explorer** (`public/`):
   - A glassmorphic dark-mode web application served directly by the Express server.
   - Real-time statistics counters (Total, To Do, In Progress, Done, Overdue).
   - Live REST API request inspector drawer displaying every HTTP call, execution timing, and response JSON in real time.
   - Quick "Seed Demo Data" action for instant evaluation.

---

## 2. Test Coverage Metrics

Run `npm run coverage` inside `task-api/`:

```text
PASS tests/integration/tasks.test.js
PASS tests/unit/taskService.test.js
PASS tests/unit/validators.test.js
-----------------|---------|----------|---------|---------|-------------------
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-----------------|---------|----------|---------|---------|-------------------
All files        |   98.77 |    98.96 |   96.66 |   98.65 |                   
 src             |   86.66 |       75 |      50 |   86.66 |                   
  app.js         |   86.66 |       75 |      50 |   86.66 | 19-20 (app.listen)
 src/routes      |     100 |      100 |     100 |     100 |                   
  tasks.js       |     100 |      100 |     100 |     100 |                   
 src/services    |     100 |      100 |     100 |     100 |                   
  taskService.js |     100 |      100 |     100 |     100 |                   
 src/utils       |     100 |      100 |     100 |     100 |                   
  validators.js  |     100 |      100 |     100 |     100 |                   
-----------------|---------|----------|---------|---------|-------------------

Test Suites: 3 passed, 3 total
Tests:       87 passed, 87 total
Snapshots:   0 total
Time:        1.535 s
```

---

## 3. Part C: New Feature Design Decisions (`PATCH /tasks/:id/assign`)

### Endpoint Specification:
- **Route:** `PATCH /tasks/:id/assign`
- **Payload:** `{ "assignee": "string" }`
- **Response:** `200 OK` with updated task object (or `404 Not Found` if task ID does not exist).

### Key Design Decisions & Validation:
1. **Assignee Validation (`validateAssignTask`):**
   - The `assignee` field is required. If omitted or `undefined`, returns `400 Bad Request` (`'assignee is required'`).
   - Must be of type string. Non-string types (numbers, booleans, objects, arrays) return `400 Bad Request` (`'assignee must be a string'`).
   - Empty or whitespace-only strings (`""` or `"   "`) are rejected with `400 Bad Request` (`'assignee must be a non-empty string'`).
2. **Reassignment Support:**
   - Real-world task management frequently requires reassigning tickets between team members. The endpoint supports reassigning a task that already has an assignee and overwrites it cleanly.
3. **Data Shape Consistency:**
   - Updated `taskService.create()` to default `assignee: null`, ensuring every task returned by the API maintains a consistent schema shape.
4. **Trimming & Sanitization:**
   - Assignee strings are trimmed of leading and trailing whitespace before storage.

---

## 4. Evaluation Questions Answered

### A. What would you test next if you had more time?
1. **Concurrency and Race Conditions:**
   - In a production environment with multiple simultaneous requests or async operations (such as a distributed cluster or cluster mode in Node), concurrent updates to the same task could cause lost updates. I would write load/concurrency tests simulating simultaneous `PUT`, `PATCH`, and `DELETE` requests.
2. **Property-Based Testing:**
   - Utilize a property-based testing framework such as `fast-check` to generate hundreds of arbitrary input strings, Unicode characters, emojis, SQL injection patterns, and malformed ISO date strings against the validators to catch edge cases that human test cases miss.
3. **End-to-End (E2E) Browser Tests:**
   - Add Playwright or Cypress tests to exercise the full end-to-end user workflows: creating tasks via the UI, assigning team members, filtering by status, paginating, and verifying real-time DOM updates.
4. **Performance & Memory Profiling:**
   - Profile the memory footprint and response latency of `getStats()` and `getPaginated()` when holding 50,000+ tasks in-memory.

### B. Anything that surprised you in the codebase?
1. **The Priority Reset Bug in `completeTask`:**
   - In `taskService.js`, `completeTask` explicitly hardcoded `priority: 'medium'`. This was surprising because marking a task complete has nothing to do with changing its priority. It looked like an accidental copy-paste or stub from an early prototype that slipped into production without tests.
2. **Documentation Discrepancy in `README.md`:**
   - The initial `README.md` listed valid task statuses as `"pending | in-progress | completed"`, while the actual codebase (`validators.js` and `ASSIGNMENT.md`) implemented `"todo | in_progress | done"`. Without automated tests or OpenAPI contracts, documentation quickly diverges from implementation.
3. **The 1-Based Pagination Offset:**
   - `offset = page * limit` instead of `(page - 1) * limit`. When `page = 1`, it skipped the first 10 items. If an API has fewer than 10 items, `page=1` returned an empty array `[]` — an insidious bug that would immediately baffle API consumers.
4. **Falsy Truthiness Check in Validation:**
   - `if (body.status && !VALID_STATUSES.includes(body.status))` skipped validation when `body.status = ""` because empty strings evaluate to falsy in JavaScript. Because default arguments only trigger on `undefined`, tasks were successfully stored with invalid `status: ""` values.

### C. Any questions you'd ask before shipping this to production?
1. **Persistence & Data Storage Layer:**
   - *"When migrating from the in-memory array to a persistent database (PostgreSQL / MongoDB), what are the indexing requirements for `status`, `dueDate`, and `assignee` to support performant pagination and sorting at scale?"*
2. **Authentication, Authorization & Multi-Tenancy:**
   - *"How should tasks be scoped? Will tasks belong to specific teams, organizations, or individual user accounts (`userId`)? What authorization rules apply to who can delete or reassign a task?"*
3. **Soft Deletes vs. Hard Deletes:**
   - *"Should `DELETE /tasks/:id` perform a permanent hard delete or a soft delete (e.g. `isDeleted: true` with a `deletedAt` timestamp) to support audit trails and accidental recovery?"*
4. **API Versioning & OpenAPI Contracts:**
   - *"Should we establish an `/api/v1` namespace and generate an automated Swagger/OpenAPI 3.0 specification so frontend and third-party consumers have strict, auto-generated TypeScript SDKs?"*
5. **Notification & Webhook System:**
   - *"Are there requirements to notify assignees (via email, Slack, or webhook) when they are assigned a task or when a task becomes overdue?"*
6. **Rate Limiting & Security Headers:**
   - *"Should we configure `helmet` for security headers, `express-rate-limit` to prevent brute force attacks, and CORS configuration for trusted domains?"*

---

## 5. How to Run Locally

### 1. Install Dependencies
```bash
cd task-api
npm install
```

### 2. Run Test Suite
```bash
npm test
```

### 3. Run Test Suite with Coverage
```bash
npm run coverage
```

### 4. Start the Application
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser to view the interactive Task Manager Dashboard and API Explorer!
