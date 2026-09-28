# Bug Report — The Untested API

This report documents the bugs discovered in the Task Manager API through systematic unit and integration testing.

---

## Summary of Identified Bugs

| Bug ID | Severity | File & Location | Description |
|--------|----------|-----------------|-------------|
| **BUG-01** | High | `src/services/taskService.js:69` | `completeTask()` unconditionally overwrites task `priority` to `'medium'` |
| **BUG-02** | High | `src/services/taskService.js:12` | 1-based pagination calculation off-by-one skips the entire first page |
| **BUG-03** | Medium | `src/services/taskService.js:9` | `getByStatus()` performs substring matching (`.includes()`) rather than exact matching |
| **BUG-04** | Medium | `src/utils/validators.js:8,11,24,27` | Falsy empty strings (`""`) bypass `status` and `priority` validations |
| **BUG-05** | High | `src/services/taskService.js:50` | `update()` allows overriding immutable system fields (`id`, `createdAt`) |
| **BUG-06** | Low | `src/routes/tasks.js:14-24` | Filtering by `status` bypasses pagination (`page` and `limit` are ignored) |

---

## Detailed Bug Reports

### BUG-01: `completeTask()` unconditionally overwrites task `priority` to `'medium'`

- **Severity:** High (Silent Data Mutation)
- **Location:** `task-api/src/services/taskService.js`, line 69
- **Expected Behavior:** Marking a task as complete (`PATCH /tasks/:id/complete`) should update `status` to `'done'` and set `completedAt` to an ISO timestamp, while leaving all other fields (such as `priority`, `title`, `description`, `dueDate`) intact.
- **What Actually Happens:** The updated object explicitly sets `priority: 'medium'`:
  ```javascript
  const updated = {
    ...task,
    priority: 'medium', // <--- Overwrites existing priority!
    status: 'done',
    completedAt: new Date().toISOString(),
  };
  ```
  If a task was created with `priority: 'high'` or `priority: 'low'`, marking it complete silently degrades or changes its priority to `'medium'`.
- **How Discovered:**
  - Unit test `taskService.test.js`: Created a task with `priority: 'high'` and called `completeTask(task.id)`. The assertion `expect(completed.priority).toBe('high')` failed with `Expected: "high", Received: "medium"`.
  - Integration test `tasks.test.js`: `PATCH /tasks/:id/complete` asserted `res.body.priority === 'high'` and received `'medium'`.
- **Fix:**
  Remove `priority: 'medium'` from the updated object:
  ```javascript
  const updated = {
    ...task,
    status: 'done',
    completedAt: new Date().toISOString(),
  };
  ```

---

### BUG-02: 1-indexed pagination off-by-one skips the entire first page

- **Severity:** High (Functional Breakdown)
- **Location:** `task-api/src/services/taskService.js`, lines 11–14
- **Expected Behavior:** In standard 1-based pagination (e.g. `GET /tasks?page=1&limit=10`), page 1 should return items 0 through 9 (`offset = (page - 1) * limit`).
- **What Actually Happens:**
  ```javascript
  const getPaginated = (page, limit) => {
    const offset = page * limit;
    return tasks.slice(offset, offset + limit);
  };
  ```
  When `page = 1` and `limit = 10`, `offset` is calculated as `1 * 10 = 10`. It executes `tasks.slice(10, 20)`. The first 10 items (indices 0–9) are permanently skipped and can never be retrieved by page 1. If there are fewer than 10 items in the store, `GET /tasks?page=1&limit=10` returns an empty array `[]`.
- **How Discovered:**
  - Unit test `taskService.test.js`: Created 15 tasks. Requested `getPaginated(1, 10)` and expected 10 items starting with "Task 1". Received 5 items starting with "Task 11".
  - Integration test `tasks.test.js`: `GET /tasks?page=1&limit=2` expected `"Task 1"` as the first element but received `"Task 3"`.
- **Fix:**
  Adjust the formula to `(page - 1) * limit` with boundary guard:
  ```javascript
  const getPaginated = (page, limit) => {
    const validPage = Math.max(1, parseInt(page) || 1);
    const validLimit = Math.max(1, parseInt(limit) || 10);
    const offset = (validPage - 1) * validLimit;
    return tasks.slice(offset, offset + validLimit);
  };
  ```

---

### BUG-03: `getByStatus()` performs substring matching (`.includes()`) instead of exact matching

- **Severity:** Medium (Query Inaccuracy)
- **Location:** `task-api/src/services/taskService.js`, line 9
- **Expected Behavior:** Filtering tasks by status (`/tasks?status=todo`) should only return tasks whose `status` exactly equals `'todo'`.
- **What Actually Happens:**
  ```javascript
  const getByStatus = (status) => tasks.filter((t) => t.status.includes(status));
  ```
  Because `.includes()` checks for substrings:
  - Querying `?status=do` returns tasks with status `'todo'` AND status `'done'`.
  - Querying `?status=in` returns `'in_progress'`.
  - Querying `?status=` (empty string) returns every task because every string includes `""`.
  - If `t.status` is null/undefined, it throws `TypeError: Cannot read properties of undefined (reading 'includes')`.
- **How Discovered:**
  - Unit test passing partial status names like `getByStatus("do")` returned both `todo` and `done` tasks.
- **Fix:**
  Use strict equality check:
  ```javascript
  const getByStatus = (status) => tasks.filter((t) => t.status === status);
  ```

---

### BUG-04: Falsy empty strings (`""`) bypass `status` and `priority` validation

- **Severity:** Medium (Input Validation Bypass)
- **Location:** `task-api/src/utils/validators.js`, lines 8, 11, 24, 27
- **Expected Behavior:** Providing `""` (empty string) for `status` or `priority` should fail validation with 400 Bad Request because `""` is not in `VALID_STATUSES` or `VALID_PRIORITIES`.
- **What Actually Happens:**
  ```javascript
  if (body.status && !VALID_STATUSES.includes(body.status))
  ```
  In JavaScript, `""` is falsy. Therefore, `body.status && ...` evaluates to `""` (falsy) and the validation block is skipped entirely!
  Then in `taskService.create({ title, description = '', status = 'todo', ... })`, JavaScript default parameters only apply when the argument is `undefined`. Because `status: ""` is passed, it is saved directly to the database as `status: ""`.
- **How Discovered:**
  - Passing `{ title: "Test", status: "" }` to `POST /tasks` returned `201 Created` with `status: ""`.
- **Fix:**
  Check `body.status !== undefined && !VALID_STATUSES.includes(body.status)`:
  ```javascript
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  if (body.priority !== undefined && !VALID_PRIORITIES.includes(body.priority)) {
    return `priority must be one of: ${VALID_PRIORITIES.join(', ')}`;
  }
  ```

---

### BUG-05: `taskService.update()` allows overwriting immutable fields (`id`, `createdAt`)

- **Severity:** High (Security / Data Integrity)
- **Location:** `task-api/src/services/taskService.js`, lines 50–52
- **Expected Behavior:** System-generated identifiers (`id`) and audit timestamps (`createdAt`) should remain immutable throughout the task lifecycle.
- **What Actually Happens:**
  ```javascript
  const updated = { ...tasks[index], ...fields };
  ```
  Any caller sending `PUT /tasks/:id` with `{ "id": "attacker-id", "createdAt": "1970-01-01T00:00:00Z" }` will overwrite the task's primary key and timestamp.
- **How Discovered:**
  - Unit test in `taskService.test.js` asserting `updated.id === originalId` failed with `Expected: originalId, Received: "attacker-custom-id"`.
- **Fix:**
  Sanitize the update input by omitting `id` and `createdAt`:
  ```javascript
  const update = (id, fields) => {
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) return null;

    const { id: _ignoredId, createdAt: _ignoredCreatedAt, ...allowedFields } = fields;
    const updated = { ...tasks[index], ...allowedFields };
    tasks[index] = updated;
    return updated;
  };
  ```

---

### BUG-06: `routes/tasks.js` does not compose `status` filter with pagination

- **Severity:** Low (Feature Limitation)
- **Location:** `task-api/src/routes/tasks.js`, lines 14–24
- **Expected Behavior:** A client making a request like `GET /tasks?status=todo&page=1&limit=5` expects to receive the first 5 tasks that have status `'todo'`.
- **What Actually Happens:**
  ```javascript
  if (status) {
    const tasks = taskService.getByStatus(status);
    return res.json(tasks);
  }

  if (page !== undefined || limit !== undefined) {
    ...
  }
  ```
  The `if (status)` block returns immediately, ignoring `page` and `limit`.
- **How Discovered:**
  - Integration test verifying pagination while filtering by status returned all matching tasks without paginating.
- **Fix:**
  Allow filtering and pagination to compose cleanly in `routes/tasks.js` or `taskService.js`.
