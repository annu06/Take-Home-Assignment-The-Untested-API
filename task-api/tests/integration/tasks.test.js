const request = require('supertest');
const app = require('../../src/app');
const taskService = require('../../src/services/taskService');

describe('Task API Integration Tests', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('GET /tasks', () => {
    test('returns 200 with an empty array when no tasks exist', async () => {
      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    test('returns 200 with all tasks', async () => {
      taskService.create({ title: 'Task 1' });
      taskService.create({ title: 'Task 2' });

      const res = await request(app).get('/tasks');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Task 1');
      expect(res.body[1].title).toBe('Task 2');
    });

    test('filters tasks by exact status via ?status= query param', async () => {
      taskService.create({ title: 'Task 1', status: 'todo' });
      taskService.create({ title: 'Task 2', status: 'in_progress' });
      taskService.create({ title: 'Task 3', status: 'done' });

      const res = await request(app).get('/tasks?status=in_progress');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Task 2');
      expect(res.body[0].status).toBe('in_progress');
    });

    test('paginates tasks with page and limit query params', async () => {
      for (let i = 1; i <= 5; i++) {
        taskService.create({ title: `Task ${i}` });
      }

      const res = await request(app).get('/tasks?page=1&limit=2');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Task 1');
      expect(res.body[1].title).toBe('Task 2');

      const resPage2 = await request(app).get('/tasks?page=2&limit=2');
      expect(resPage2.status).toBe(200);
      expect(resPage2.body).toHaveLength(2);
      expect(resPage2.body[0].title).toBe('Task 3');
      expect(resPage2.body[1].title).toBe('Task 4');
    });

    test('gracefully defaults non-numeric page and limit to 1 and 10', async () => {
      taskService.create({ title: 'Task 1' });
      const res = await request(app).get('/tasks?page=invalid&limit=invalid');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Task 1');
    });

    test('composes status filtering and pagination simultaneously', async () => {

      taskService.create({ title: 'Todo 1', status: 'todo' });
      taskService.create({ title: 'Todo 2', status: 'todo' });
      taskService.create({ title: 'Todo 3', status: 'todo' });
      taskService.create({ title: 'Done 1', status: 'done' });

      const res = await request(app).get('/tasks?status=todo&page=1&limit=2');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].title).toBe('Todo 1');
      expect(res.body[1].title).toBe('Todo 2');
    });

    test('returns empty array when requested page is out of bounds', async () => {
      taskService.create({ title: 'Task 1' });

      const res = await request(app).get('/tasks?page=10&limit=5');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('POST /tasks', () => {
    test('creates a task with valid body and returns 201', async () => {
      const payload = {
        title: 'Complete assignment',
        description: 'Write tests and fix bugs',
        priority: 'high',
        dueDate: '2026-10-01T10:00:00.000Z',
      };

      const res = await request(app).post('/tasks').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe(payload.title);
      expect(res.body.description).toBe(payload.description);
      expect(res.body.status).toBe('todo');
      expect(res.body.priority).toBe('high');
      expect(res.body.dueDate).toBe(payload.dueDate);
      expect(res.body.assignee).toBeNull();
      expect(res.body.createdAt).toBeDefined();
    });

    test('returns 400 when title is missing', async () => {
      const res = await request(app).post('/tasks').send({ description: 'No title' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('title is required and must be a non-empty string');
    });

    test('returns 400 when title is an empty string or whitespace only', async () => {
      const res = await request(app).post('/tasks').send({ title: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('title is required and must be a non-empty string');
    });

    test('returns 400 when status is invalid', async () => {
      const res = await request(app).post('/tasks').send({
        title: 'Task',
        status: 'invalid_status',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('status must be one of:');
    });

    test('returns 400 when status is an empty string', async () => {
      const res = await request(app).post('/tasks').send({
        title: 'Task',
        status: '',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('status must be one of:');
    });

    test('returns 400 when priority is invalid', async () => {
      const res = await request(app).post('/tasks').send({
        title: 'Task',
        priority: 'super_high',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('priority must be one of:');
    });

    test('returns 400 when dueDate is an invalid date string', async () => {
      const res = await request(app).post('/tasks').send({
        title: 'Task',
        dueDate: 'not-a-valid-date',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('dueDate must be a valid ISO date string');
    });
  });

  describe('PUT /tasks/:id', () => {
    test('updates an existing task and returns 200', async () => {
      const task = taskService.create({ title: 'Old Title', priority: 'low' });

      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ title: 'Updated Title', priority: 'high' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Title');
      expect(res.body.priority).toBe('high');
      expect(res.body.id).toBe(task.id);
    });

    test('prevents updating immutable fields (id, createdAt)', async () => {
      const task = taskService.create({ title: 'Test Task' });

      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ id: 'hacked-id', createdAt: '1970-01-01T00:00:00Z', title: 'New Title' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(task.id);
      expect(res.body.createdAt).toBe(task.createdAt);
      expect(res.body.title).toBe('New Title');
    });

    test('returns 404 when updating non-existent task id', async () => {
      const res = await request(app)
        .put('/tasks/non-existent-id')
        .send({ title: 'Does not matter' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    test('returns 400 when update payload has invalid values', async () => {
      const task = taskService.create({ title: 'Task' });

      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ priority: 'invalid-priority' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('priority must be one of:');
    });

    test('returns 400 when updating title to an empty string', async () => {
      const task = taskService.create({ title: 'Task' });

      const res = await request(app)
        .put(`/tasks/${task.id}`)
        .send({ title: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('title must be a non-empty string');
    });
  });

  describe('DELETE /tasks/:id', () => {
    test('deletes existing task and returns 204 No Content', async () => {
      const task = taskService.create({ title: 'To Be Deleted' });

      const res = await request(app).delete(`/tasks/${task.id}`);
      expect(res.status).toBe(204);
      expect(res.body).toEqual({});

      expect(taskService.findById(task.id)).toBeUndefined();
    });

    test('returns 404 when deleting a non-existent task', async () => {
      const res = await request(app).delete('/tasks/random-unknown-id');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });

    test('returns 404 when attempting to delete the same task twice', async () => {
      const task = taskService.create({ title: 'Delete Twice' });

      await request(app).delete(`/tasks/${task.id}`);
      const secondRes = await request(app).delete(`/tasks/${task.id}`);

      expect(secondRes.status).toBe(404);
      expect(secondRes.body.error).toBe('Task not found');
    });
  });

  describe('PATCH /tasks/:id/complete', () => {
    test('marks an existing task as complete and returns 200 preserving priority', async () => {
      const task = taskService.create({ title: 'Finish testing', priority: 'high' });

      const res = await request(app).patch(`/tasks/${task.id}/complete`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(task.id);
      expect(res.body.status).toBe('done');
      expect(res.body.completedAt).toBeDefined();
      expect(new Date(res.body.completedAt).toString()).not.toBe('Invalid Date');
      expect(res.body.priority).toBe('high');
    });

    test('returns 404 when marking a non-existent task as complete', async () => {
      const res = await request(app).patch('/tasks/non-existent-id/complete');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });
  });

  describe('PATCH /tasks/:id/assign', () => {
    test('assigns an assignee to a task and returns 200 with updated task', async () => {
      const task = taskService.create({ title: 'Assign Feature' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Alex Morgan' });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(task.id);
      expect(res.body.assignee).toBe('Alex Morgan');
    });

    test('reassigns a task to another assignee', async () => {
      const task = taskService.create({ title: 'Reassign Task', assignee: 'Alex' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 'Jordan Lee' });

      expect(res.status).toBe(200);
      expect(res.body.assignee).toBe('Jordan Lee');
    });

    test('returns 400 when assignee is missing from request body', async () => {
      const task = taskService.create({ title: 'Task' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('assignee is required');
    });

    test('returns 400 when assignee is an empty string or whitespace only', async () => {
      const task = taskService.create({ title: 'Task' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('assignee must be a non-empty string');
    });

    test('returns 400 when assignee is not a string', async () => {
      const task = taskService.create({ title: 'Task' });

      const res = await request(app)
        .patch(`/tasks/${task.id}/assign`)
        .send({ assignee: 12345 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('assignee must be a string');
    });

    test('returns 404 when task id does not exist', async () => {
      const res = await request(app)
        .patch('/tasks/non-existent-task-id/assign')
        .send({ assignee: 'Alex Morgan' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Task not found');
    });
  });

  describe('GET /tasks/stats', () => {
    test('returns 200 with status counts and overdue counts', async () => {
      const past = new Date(Date.now() - 5000000).toISOString();
      const future = new Date(Date.now() + 5000000).toISOString();

      taskService.create({ title: 'T1', status: 'todo', dueDate: past });
      taskService.create({ title: 'T2', status: 'in_progress', dueDate: future });
      taskService.create({ title: 'T3', status: 'done', dueDate: past });

      const res = await request(app).get('/tasks/stats');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        todo: 1,
        in_progress: 1,
        done: 1,
        overdue: 1,
      });
    });

    test('returns zero counts when no tasks exist', async () => {
      const res = await request(app).get('/tasks/stats');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        todo: 0,
        in_progress: 0,
        done: 0,
        overdue: 0,
      });
    });
  });

  describe('Global Error Handling', () => {
    test('handles malformed JSON body with 500 internal server error', async () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const res = await request(app)
        .post('/tasks')
        .set('Content-Type', 'application/json')
        .send('{ malformed json body');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Internal server error');
      spy.mockRestore();
    });
  });
});

