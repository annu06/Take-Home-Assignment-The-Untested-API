const {
  validateCreateTask,
  validateUpdateTask,
  validateAssignTask,
} = require('../../src/utils/validators');

describe('validators Unit Tests', () => {
  describe('validateCreateTask()', () => {
    test('returns null for a valid minimal task', () => {
      const error = validateCreateTask({ title: 'Valid Task' });
      expect(error).toBeNull();
    });

    test('returns null for a valid task with all fields', () => {
      const error = validateCreateTask({
        title: 'Full Task',
        description: 'Complete description',
        status: 'in_progress',
        priority: 'high',
        dueDate: '2026-12-31T23:59:59.000Z',
      });
      expect(error).toBeNull();
    });

    test('fails when body is undefined or null', () => {
      expect(validateCreateTask(null)).toBe('title is required and must be a non-empty string');
      expect(validateCreateTask(undefined)).toBe('title is required and must be a non-empty string');
    });

    test('fails when title is missing', () => {
      const error = validateCreateTask({});
      expect(error).toBe('title is required and must be a non-empty string');
    });

    test('fails when title is not a string (number, boolean, object)', () => {
      expect(validateCreateTask({ title: 123 })).toBe('title is required and must be a non-empty string');
      expect(validateCreateTask({ title: true })).toBe('title is required and must be a non-empty string');
      expect(validateCreateTask({ title: {} })).toBe('title is required and must be a non-empty string');
    });

    test('fails when title is empty or only whitespace', () => {
      expect(validateCreateTask({ title: '' })).toBe('title is required and must be a non-empty string');
      expect(validateCreateTask({ title: '   ' })).toBe('title is required and must be a non-empty string');
    });

    test('fails when status is invalid', () => {
      const error = validateCreateTask({ title: 'Task', status: 'archived' });
      expect(error).toBe('status must be one of: todo, in_progress, done');
    });

    test('fails when status is an empty string (BUG-04 fix)', () => {
      const error = validateCreateTask({ title: 'Task', status: '' });
      expect(error).toBe('status must be one of: todo, in_progress, done');
    });

    test('fails when priority is invalid', () => {
      const error = validateCreateTask({ title: 'Task', priority: 'urgent' });
      expect(error).toBe('priority must be one of: low, medium, high');
    });

    test('fails when priority is an empty string (BUG-04 fix)', () => {
      const error = validateCreateTask({ title: 'Task', priority: '' });
      expect(error).toBe('priority must be one of: low, medium, high');
    });

    test('fails when dueDate is not a valid date string', () => {
      const error = validateCreateTask({ title: 'Task', dueDate: 'not-a-date' });
      expect(error).toBe('dueDate must be a valid ISO date string');
    });

    test('allows null dueDate', () => {
      const error = validateCreateTask({ title: 'Task', dueDate: null });
      expect(error).toBeNull();
    });
  });

  describe('validateUpdateTask()', () => {
    test('returns null for valid partial updates', () => {
      expect(validateUpdateTask({ title: 'New Title' })).toBeNull();
      expect(validateUpdateTask({ status: 'done' })).toBeNull();
      expect(validateUpdateTask({ priority: 'low' })).toBeNull();
      expect(validateUpdateTask({ dueDate: '2026-10-01T00:00:00.000Z' })).toBeNull();
      expect(validateUpdateTask({})).toBeNull();
    });

    test('fails when body is null or undefined', () => {
      expect(validateUpdateTask(null)).toBe('request body is required');
      expect(validateUpdateTask(undefined)).toBe('request body is required');
    });

    test('fails when title is updated to empty string or whitespace', () => {
      expect(validateUpdateTask({ title: '' })).toBe('title must be a non-empty string');
      expect(validateUpdateTask({ title: '   ' })).toBe('title must be a non-empty string');
      expect(validateUpdateTask({ title: 456 })).toBe('title must be a non-empty string');
    });

    test('fails when updating to an invalid status', () => {
      expect(validateUpdateTask({ status: 'cancelled' })).toBe(
        'status must be one of: todo, in_progress, done'
      );
    });

    test('fails when updating status to an empty string', () => {
      expect(validateUpdateTask({ status: '' })).toBe(
        'status must be one of: todo, in_progress, done'
      );
    });

    test('fails when updating to an invalid priority', () => {
      expect(validateUpdateTask({ priority: 'critical' })).toBe(
        'priority must be one of: low, medium, high'
      );
    });

    test('fails when updating priority to an empty string', () => {
      expect(validateUpdateTask({ priority: '' })).toBe(
        'priority must be one of: low, medium, high'
      );
    });

    test('fails when updating to an invalid dueDate', () => {
      expect(validateUpdateTask({ dueDate: 'invalid-date' })).toBe(
        'dueDate must be a valid ISO date string'
      );
    });
  });

  describe('validateAssignTask()', () => {
    test('returns null for a valid assignee string', () => {
      expect(validateAssignTask({ assignee: 'Alice Johnson' })).toBeNull();
    });

    test('fails when body is missing or assignee is undefined', () => {
      expect(validateAssignTask(null)).toBe('assignee is required');
      expect(validateAssignTask({})).toBe('assignee is required');
      expect(validateAssignTask({ assignee: undefined })).toBe('assignee is required');
    });

    test('fails when assignee is not a string (number, boolean, array, object)', () => {
      expect(validateAssignTask({ assignee: 123 })).toBe('assignee must be a string');
      expect(validateAssignTask({ assignee: true })).toBe('assignee must be a string');
      expect(validateAssignTask({ assignee: ['Bob'] })).toBe('assignee must be a string');
      expect(validateAssignTask({ assignee: { name: 'Bob' } })).toBe('assignee must be a string');
    });

    test('fails when assignee is an empty string or whitespace only', () => {
      expect(validateAssignTask({ assignee: '' })).toBe('assignee must be a non-empty string');
      expect(validateAssignTask({ assignee: '   ' })).toBe('assignee must be a non-empty string');
    });
  });
});
