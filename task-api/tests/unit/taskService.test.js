const taskService = require('../../src/services/taskService');

describe('taskService Unit Tests', () => {
  beforeEach(() => {
    taskService._reset();
  });

  describe('create()', () => {
    test('creates a task with required title and default values', () => {
      const task = taskService.create({ title: 'Write tests' });

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(typeof task.id).toBe('string');
      expect(task.title).toBe('Write tests');
      expect(task.description).toBe('');
      expect(task.status).toBe('todo');
      expect(task.priority).toBe('medium');
      expect(task.dueDate).toBeNull();
      expect(task.assignee).toBeNull();
      expect(task.completedAt).toBeNull();
      expect(task.createdAt).toBeDefined();
      expect(new Date(task.createdAt).toString()).not.toBe('Invalid Date');
    });

    test('creates a task with custom fields including assignee', () => {
      const dueDate = new Date('2026-10-15T12:00:00Z').toISOString();
      const task = taskService.create({
        title: 'Review PR',
        description: 'Check logic and test coverage',
        status: 'in_progress',
        priority: 'high',
        dueDate,
        assignee: 'Alice',
      });

      expect(task.title).toBe('Review PR');
      expect(task.description).toBe('Check logic and test coverage');
      expect(task.status).toBe('in_progress');
      expect(task.priority).toBe('high');
      expect(task.dueDate).toBe(dueDate);
      expect(task.assignee).toBe('Alice');
    });
  });

  describe('getAll()', () => {
    test('returns an empty array when no tasks exist', () => {
      expect(taskService.getAll()).toEqual([]);
    });

    test('returns all created tasks', () => {
      const t1 = taskService.create({ title: 'Task 1' });
      const t2 = taskService.create({ title: 'Task 2' });

      const all = taskService.getAll();
      expect(all).toHaveLength(2);
      expect(all).toEqual([t1, t2]);
    });

    test('returns a copy of the tasks array preventing direct external mutation', () => {
      taskService.create({ title: 'Task 1' });
      const list = taskService.getAll();
      list.pop();
      expect(taskService.getAll()).toHaveLength(1);
    });
  });

  describe('findById()', () => {
    test('returns the correct task when id matches', () => {
      const created = taskService.create({ title: 'Find Me' });
      const found = taskService.findById(created.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.title).toBe('Find Me');
    });

    test('returns undefined when id does not exist', () => {
      const found = taskService.findById('non-existent-uuid');
      expect(found).toBeUndefined();
    });
  });

  describe('getByStatus()', () => {
    test('filters tasks by exact status match', () => {
      taskService.create({ title: 'T1', status: 'todo' });
      taskService.create({ title: 'T2', status: 'in_progress' });
      taskService.create({ title: 'T3', status: 'done' });
      taskService.create({ title: 'T4', status: 'todo' });

      const todos = taskService.getByStatus('todo');
      expect(todos).toHaveLength(2);
      expect(todos.every((t) => t.status === 'todo')).toBe(true);

      const inProgress = taskService.getByStatus('in_progress');
      expect(inProgress).toHaveLength(1);
      expect(inProgress[0].title).toBe('T2');
    });

    test('does not return tasks on partial substring matches', () => {
      taskService.create({ title: 'T1', status: 'todo' });
      taskService.create({ title: 'T2', status: 'done' });

      // 'do' is a substring of both 'todo' and 'done', but exact match must return none
      const partialMatch = taskService.getByStatus('do');
      expect(partialMatch).toEqual([]);
    });

    test('returns empty array when no tasks have matching status', () => {
      taskService.create({ title: 'T1', status: 'todo' });
      expect(taskService.getByStatus('done')).toEqual([]);
    });
  });

  describe('getPaginated()', () => {
    test('returns the first page with correct items when page=1', () => {
      for (let i = 1; i <= 15; i++) {
        taskService.create({ title: `Task ${i}` });
      }

      const page1 = taskService.getPaginated(1, 10);
      expect(page1).toHaveLength(10);
      expect(page1[0].title).toBe('Task 1');
      expect(page1[9].title).toBe('Task 10');
    });

    test('returns the second page with remaining items', () => {
      for (let i = 1; i <= 15; i++) {
        taskService.create({ title: `Task ${i}` });
      }

      const page2 = taskService.getPaginated(2, 10);
      expect(page2).toHaveLength(5);
      expect(page2[0].title).toBe('Task 11');
      expect(page2[4].title).toBe('Task 15');
    });

    test('handles page=0 or negative page gracefully by falling back to page 1', () => {
      taskService.create({ title: 'Task 1' });
      const result = taskService.getPaginated(0, 10);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Task 1');
    });

    test('handles non-numeric string values for page and limit safely', () => {
      taskService.create({ title: 'Task 1' });
      const result = taskService.getPaginated('invalid-page', 'invalid-limit');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Task 1');
    });

    test('returns empty array when requested page exceeds total items', () => {
      taskService.create({ title: 'Task 1' });
      const page5 = taskService.getPaginated(5, 10);
      expect(page5).toEqual([]);
    });
  });

  describe('getStats()', () => {
    test('computes status counts correctly with no overdue tasks', () => {
      const futureDate = new Date(Date.now() + 10000000).toISOString();
      taskService.create({ title: 'T1', status: 'todo', dueDate: futureDate });
      taskService.create({ title: 'T2', status: 'in_progress', dueDate: futureDate });
      taskService.create({ title: 'T3', status: 'done', dueDate: futureDate });

      const stats = taskService.getStats();
      expect(stats).toEqual({
        todo: 1,
        in_progress: 1,
        done: 1,
        overdue: 0,
      });
    });

    test('ignores tasks with unknown status in status counts', () => {
      // Create a task and bypass validator to simulate legacy data with unrecognized status
      const task = taskService.create({ title: 'Legacy' });
      task.status = 'archived_legacy';

      const stats = taskService.getStats();
      expect(stats.todo).toBe(0);
      expect(stats.in_progress).toBe(0);
      expect(stats.done).toBe(0);
    });


    test('computes overdue count for past due dates that are not done', () => {
      const pastDate = new Date(Date.now() - 10000000).toISOString();
      const futureDate = new Date(Date.now() + 10000000).toISOString();

      taskService.create({ title: 'Overdue Todo', status: 'todo', dueDate: pastDate });
      taskService.create({ title: 'Overdue Progress', status: 'in_progress', dueDate: pastDate });
      taskService.create({ title: 'Done Past Due', status: 'done', dueDate: pastDate });
      taskService.create({ title: 'Future Due', status: 'todo', dueDate: futureDate });
      taskService.create({ title: 'No Due Date', status: 'todo', dueDate: null });

      const stats = taskService.getStats();
      expect(stats.todo).toBe(3);
      expect(stats.in_progress).toBe(1);
      expect(stats.done).toBe(1);
      expect(stats.overdue).toBe(2);
    });

    test('returns zero counts when store is empty', () => {
      const stats = taskService.getStats();
      expect(stats).toEqual({
        todo: 0,
        in_progress: 0,
        done: 0,
        overdue: 0,
      });
    });
  });

  describe('update()', () => {
    test('updates specified fields of an existing task', () => {
      const task = taskService.create({ title: 'Old Title', priority: 'low' });
      const updated = taskService.update(task.id, {
        title: 'New Title',
        priority: 'high',
      });

      expect(updated).toBeDefined();
      expect(updated.title).toBe('New Title');
      expect(updated.priority).toBe('high');
      expect(updated.status).toBe('todo'); // Unchanged field
    });

    test('returns null when updating a non-existent task', () => {
      const result = taskService.update('non-existent-id', { title: 'New' });
      expect(result).toBeNull();
    });

    test('preserves immutable fields like id and createdAt', () => {
      const task = taskService.create({ title: 'Immutable Test' });
      const originalId = task.id;
      const originalCreatedAt = task.createdAt;

      const updated = taskService.update(task.id, {
        id: 'attacker-custom-id',
        createdAt: '1970-01-01T00:00:00.000Z',
        title: 'Updated Title',
      });

      expect(updated.id).toBe(originalId);
      expect(updated.createdAt).toBe(originalCreatedAt);
      expect(updated.title).toBe('Updated Title');
    });
  });

  describe('remove()', () => {
    test('removes an existing task and returns true', () => {
      const task = taskService.create({ title: 'Delete Me' });
      const result = taskService.remove(task.id);

      expect(result).toBe(true);
      expect(taskService.findById(task.id)).toBeUndefined();
      expect(taskService.getAll()).toHaveLength(0);
    });

    test('returns false when trying to remove a non-existent task', () => {
      const result = taskService.remove('fake-id');
      expect(result).toBe(false);
    });
  });

  describe('completeTask()', () => {
    test('marks task as done and sets completedAt without altering priority', () => {
      const task = taskService.create({ title: 'Important Task', priority: 'high' });
      const completed = taskService.completeTask(task.id);

      expect(completed).toBeDefined();
      expect(completed.status).toBe('done');
      expect(completed.completedAt).toBeDefined();
      expect(new Date(completed.completedAt).toString()).not.toBe('Invalid Date');
      expect(completed.priority).toBe('high');
    });

    test('returns null when task id does not exist', () => {
      const result = taskService.completeTask('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('assignTask()', () => {
    test('assigns a user to a task and returns updated task', () => {
      const task = taskService.create({ title: 'Task to Assign' });
      expect(task.assignee).toBeNull();

      const updated = taskService.assignTask(task.id, 'John Doe');
      expect(updated).toBeDefined();
      expect(updated.id).toBe(task.id);
      expect(updated.assignee).toBe('John Doe');

      // Verify persistence in store
      const retrieved = taskService.findById(task.id);
      expect(retrieved.assignee).toBe('John Doe');
    });

    test('reassigns an already assigned task to a new user', () => {
      const task = taskService.create({ title: 'Task', assignee: 'John' });
      const updated = taskService.assignTask(task.id, 'Jane');

      expect(updated.assignee).toBe('Jane');
    });

    test('returns null when assigning a non-existent task', () => {
      const result = taskService.assignTask('non-existent-id', 'John Doe');
      expect(result).toBeNull();
    });
  });

  describe('_reset()', () => {
    test('clears all tasks from the in-memory array', () => {
      taskService.create({ title: 'T1' });
      taskService.create({ title: 'T2' });
      expect(taskService.getAll()).toHaveLength(2);

      taskService._reset();
      expect(taskService.getAll()).toHaveLength(0);
    });
  });
});
