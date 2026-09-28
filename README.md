# Take-Home Assignment — The Untested API (Completed Submission)

[![Tests](https://img.shields.io/badge/Tests-87%20Passed-brightgreen)](https://github.com)
[![Coverage](https://img.shields.io/badge/Coverage-98.8%25-brightgreen)](https://github.com)
[![Node](https://img.shields.io/badge/Node.js-18%2B-blue)](https://nodejs.org)

Production-ready Task Manager API with a comprehensive test suite (87 tests, 98.8% coverage), full bug audit and resolution, the new assignee feature, and an interactive live dashboard with real-time REST API telemetry.

- Full brief: **[ASSIGNMENT.md](./ASSIGNMENT.md)**
- Bug audit & root causes: **[BUG_REPORT.md](./BUG_REPORT.md)**
- Detailed submission notes & evaluation answers: **[SUBMISSION_NOTES.md](./SUBMISSION_NOTES.md)**

---

## Quickstart

```bash
cd task-api
npm install
npm test           # Run 87 unit and integration tests
npm run coverage   # Run tests with code coverage report
npm start          # Starts server on http://localhost:3000
```

Open **[http://localhost:3000](http://localhost:3000)** in any browser to launch the **Interactive Task Manager Dashboard & Live REST API Playground**.

---

## What Was Done

### 1. Day 1: Comprehensive Test Suite (`tests/`)
- **Unit Tests** (`tests/unit/`): Direct tests for `taskService.js` and `validators.js` checking happy paths, edge cases, boundaries, and validation errors.
- **Integration Tests** (`tests/integration/`): Supertest API tests for every endpoint (`GET /tasks`, `POST /tasks`, `PUT /tasks/:id`, `DELETE /tasks/:id`, `PATCH /tasks/:id/complete`, `PATCH /tasks/:id/assign`, `GET /tasks/stats`).
- **Results:** 87 tests passing with **98.8% coverage** across all files (100% on routes, services, and validators).

### 2. Day 2 Part A: Bug Report (`BUG_REPORT.md`)
Identified 6 critical and subtle bugs:
- **BUG-01:** `completeTask()` unconditionally reset task `priority` to `'medium'`.
- **BUG-02:** 1-indexed pagination off-by-one error (`offset = page * limit`) skipped page 1 entirely.
- **BUG-03:** `getByStatus()` used loose substring matching (`.includes()`) instead of exact equality (`===`).
- **BUG-04:** Falsy empty strings (`""`) bypassed `status` and `priority` validation in `validators.js`.
- **BUG-05:** `update()` allowed mutating immutable system fields (`id`, `createdAt`).
- **BUG-06:** Mutual exclusivity of status filtering and pagination in `routes/tasks.js`.

### 3. Day 2 Part B: Bug Fixes
- Resolved data corruption in `completeTask` by preserving existing priority.
- Corrected pagination offset formula to `(page - 1) * limit`.
- Enforced strict equality matching on status filters.
- Sanitized `update()` to protect immutable system fields.
- Hardened validation checks to reject empty strings.
- Enabled seamless composition of status filtering with pagination.

### 4. Day 2 Part C: New Feature (`PATCH /tasks/:id/assign`)
- **Route:** `PATCH /tasks/:id/assign`
- **Body:** `{ "assignee": "string" }`
- **Validation:**
  - Requires non-empty string for `assignee` (rejects missing, empty, or whitespace-only strings with `400 Bad Request`).
  - Supports reassignment if a task is already assigned.
  - Returns `404 Not Found` for invalid task IDs.
  - Returns updated task object with `assignee` saved.
- Tested extensively with unit and integration tests.

### 5. Bonus: Interactive Live Dashboard & API Explorer (`public/`)
- Sleek glassmorphic dark-mode web application served directly at `http://localhost:3000/`.
- Live stats metrics (Total, To Do, In Progress, Done, Overdue with pulse warning).
- Instant "Seed Demo Data" button.
- Real-time API console displaying raw HTTP requests, response timing, and JSON payloads.

---

## API Reference

| Method   | Path                      | Description                              |
|----------|---------------------------|------------------------------------------|
| `GET`    | `/tasks`                  | List tasks. Supports `?status=`, `?page=`, `?limit=` |
| `POST`   | `/tasks`                  | Create a new task                        |
| `PUT`    | `/tasks/:id`              | Update an existing task                  |
| `DELETE` | `/tasks/:id`              | Delete a task (returns 204)              |
| `PATCH`  | `/tasks/:id/complete`     | Mark task as complete (preserves priority)|
| `PATCH`  | `/tasks/:id/assign`       | Assign task to a user (new endpoint)     |
| `GET`    | `/tasks/stats`            | Counts by status + overdue count         |

### Task Schema

```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "status": "todo | in_progress | done",
  "priority": "low | medium | high",
  "dueDate": "ISO 8601 or null",
  "assignee": "string or null",
  "completedAt": "ISO 8601 or null",
  "createdAt": "ISO 8601"
}
```

---

## Sample Requests

```bash
# Create a task
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Implement authentication", "priority": "high"}'

# Assign task
curl -X PATCH http://localhost:3000/tasks/<id>/assign \
  -H "Content-Type: application/json" \
  -d '{"assignee": "Sarah Connor"}'

# Mark complete
curl -X PATCH http://localhost:3000/tasks/<id>/complete

# Query stats
curl http://localhost:3000/tasks/stats
```
