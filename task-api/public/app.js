// ==========================================================================
// Task Manager PRO Dashboard — Interactive Client Application
// ==========================================================================

const API_BASE = '/tasks';

let currentFilter = '';
let currentPage = 1;
const pageSize = 10;
let searchQuery = '';
let requestLogCount = 0;

// DOM Elements
const statsElements = {
  total: document.getElementById('statTotal'),
  todo: document.getElementById('statTodo'),
  inProgress: document.getElementById('statInProgress'),
  done: document.getElementById('statDone'),
  overdue: document.getElementById('statOverdue'),
};

const tasksList = document.getElementById('tasksList');
const emptyState = document.getElementById('emptyState');
const paginationLabel = document.getElementById('paginationLabel');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const searchInput = document.getElementById('searchInput');
const logsContainer = document.getElementById('logsContainer');
const logCountBadge = document.getElementById('logCountBadge');

// Modals
const createModal = document.getElementById('createModal');
const assignModal = document.getElementById('assignModal');
const createTaskForm = document.getElementById('createTaskForm');
const assignTaskForm = document.getElementById('assignTaskForm');
const assignTaskIdInput = document.getElementById('assignTaskId');
const assigneeInput = document.getElementById('assigneeInput');
const toastEl = document.getElementById('toast');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  loadData();
});

// Setup Listeners
function setupEventListeners() {
  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilter = tab.dataset.status;
      currentPage = 1;
      loadTasks();
    });
  });

  // Search input with debounce
  let debounceTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderTasks(window.cachedTasks || []);
    }, 250);
  });

  // Pagination buttons
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadTasks();
    }
  });

  nextPageBtn.addEventListener('click', () => {
    currentPage++;
    loadTasks();
  });

  // Modal Triggers
  document.getElementById('openCreateModalBtn').addEventListener('click', () => {
    createTaskForm.reset();
    createModal.classList.remove('hidden');
  });

  document.getElementById('closeCreateModalBtn').addEventListener('click', () => {
    createModal.classList.add('hidden');
  });

  document.getElementById('cancelCreateBtn').addEventListener('click', () => {
    createModal.classList.add('hidden');
  });

  document.getElementById('closeAssignModalBtn').addEventListener('click', () => {
    assignModal.classList.add('hidden');
  });

  document.getElementById('cancelAssignBtn').addEventListener('click', () => {
    assignModal.classList.add('hidden');
  });

  // Form Submissions
  createTaskForm.addEventListener('submit', handleCreateTask);
  assignTaskForm.addEventListener('submit', handleAssignTask);

  // Seed Data Buttons
  document.getElementById('seedDataBtn').addEventListener('click', seedDemoTasks);
  document.getElementById('emptySeedBtn').addEventListener('click', seedDemoTasks);

  // Console Clear
  document.getElementById('clearLogsBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    logsContainer.innerHTML = '';
    requestLogCount = 0;
    logCountBadge.textContent = '0 requests';
  });
}

// Log REST API Calls to live inspector
function logApiCall(method, url, status, duration, responseData) {
  requestLogCount++;
  logCountBadge.textContent = `${requestLogCount} request${requestLogCount === 1 ? '' : 's'}`;

  const entry = document.createElement('div');
  entry.className = 'log-entry';

  const statusClass = status >= 500 ? 'status-5xx' : status >= 400 ? 'status-4xx' : 'status-2xx';

  entry.innerHTML = `
    <div class="log-summary">
      <span class="log-method ${method}">${method}</span>
      <span class="log-path">${url}</span>
      <span class="log-status ${statusClass}">${status}</span>
      <span class="log-time">${duration}ms &bull; ${new Date().toLocaleTimeString()}</span>
    </div>
    <div class="log-json-drawer">${JSON.stringify(responseData, null, 2)}</div>
  `;

  logsContainer.appendChild(entry);
}

// Custom Fetch Wrapper with telemetry
async function apiRequest(endpoint, options = {}) {
  const start = performance.now();
  const method = options.method || 'GET';

  try {
    const res = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const duration = Math.round(performance.now() - start);
    let data = null;

    if (res.status !== 204) {
      data = await res.json();
    }

    logApiCall(method, endpoint, res.status, duration, data);

    if (!res.ok) {
      throw new Error(data && data.error ? data.error : `HTTP error ${res.status}`);
    }

    return data;
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    if (!options.silent) {
      showToast(err.message || 'Network request failed', 'error');
    }
    throw err;
  }
}

// Load stats and tasks
async function loadData() {
  await Promise.all([loadStats(), loadTasks()]);
}

async function loadStats() {
  try {
    const stats = await apiRequest(`${API_BASE}/stats`);
    if (stats) {
      const total = (stats.todo || 0) + (stats.in_progress || 0) + (stats.done || 0);
      statsElements.total.textContent = total;
      statsElements.todo.textContent = stats.todo || 0;
      statsElements.inProgress.textContent = stats.in_progress || 0;
      statsElements.done.textContent = stats.done || 0;
      statsElements.overdue.textContent = stats.overdue || 0;
    }
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

async function loadTasks() {
  try {
    let url = `${API_BASE}?page=${currentPage}&limit=${pageSize}`;
    if (currentFilter) {
      url += `&status=${encodeURIComponent(currentFilter)}`;
    }

    const tasks = await apiRequest(url);
    window.cachedTasks = tasks || [];
    renderTasks(window.cachedTasks);
    updatePaginationUI(tasks ? tasks.length : 0);
  } catch (err) {
    console.error('Failed to load tasks:', err);
  }
}

// Render Task Cards
function renderTasks(tasks) {
  let filtered = [...tasks];

  if (searchQuery) {
    filtered = filtered.filter((t) => {
      const inTitle = t.title && t.title.toLowerCase().includes(searchQuery);
      const inDesc = t.description && t.description.toLowerCase().includes(searchQuery);
      const inAssignee = t.assignee && t.assignee.toLowerCase().includes(searchQuery);
      return inTitle || inDesc || inAssignee;
    });
  }

  if (filtered.length === 0) {
    tasksList.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  tasksList.innerHTML = '';

  const now = new Date();

  filtered.forEach((task) => {
    const isDone = task.status === 'done';
    const isOverdue = task.dueDate && !isDone && new Date(task.dueDate) < now;

    const card = document.createElement('div');
    card.className = `task-card priority-${task.priority} status-${task.status}`;

    const formattedDueDate = task.dueDate
      ? new Date(task.dueDate).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null;

    card.innerHTML = `
      <div class="task-header">
        <div class="task-title-group">
          <h4 class="task-title">${escapeHtml(task.title)}</h4>
          ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}
        </div>
        <div class="task-actions">
          ${
            !isDone
              ? `<button class="btn-task-action btn-complete-task" onclick="handleCompleteTask('${task.id}')" title="Mark as complete">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Done
                </button>`
              : `<span class="badge badge-done">Completed</span>`
          }
          <button class="btn-task-action btn-delete-task" onclick="handleDeleteTask('${task.id}')" title="Delete task">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>

      <div class="task-meta">
        <span class="badge badge-${task.priority}">Priority: ${task.priority}</span>
        <span class="badge badge-${task.status}">${formatStatus(task.status)}</span>
        
        ${
          task.assignee
            ? `<div class="assignee-chip" onclick="openAssignModal('${task.id}', '${escapeAttr(task.assignee)}')">
                <span class="avatar-dot">${task.assignee.charAt(0).toUpperCase()}</span>
                <span>${escapeHtml(task.assignee)}</span>
                <span style="font-size: 0.65rem; color: var(--text-muted);">&bull; edit</span>
               </div>`
            : `<button class="btn-assign-quick" onclick="openAssignModal('${task.id}')">+ Assign</button>`
        }

        ${
          formattedDueDate
            ? `<span class="task-date-info ${isOverdue ? 'badge badge-overdue' : ''}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                ${isOverdue ? 'OVERDUE: ' : 'Due '}${formattedDueDate}
              </span>`
            : ''
        }

        <span class="task-date-info" style="margin-left: auto;">
          Created ${new Date(task.createdAt).toLocaleDateString()}
        </span>
      </div>
    `;

    tasksList.appendChild(card);
  });
}

function updatePaginationUI(currentBatchCount) {
  paginationLabel.textContent = `Page ${currentPage}`;
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentBatchCount < pageSize;
}

// Handlers
async function handleCreateTask(e) {
  e.preventDefault();

  const title = document.getElementById('createTitle').value.trim();
  const description = document.getElementById('createDescription').value.trim();
  const priority = document.getElementById('createPriority').value;
  const status = document.getElementById('createStatus').value;
  const dueVal = document.getElementById('createDueDate').value;
  const assignee = document.getElementById('createAssignee').value.trim();

  const payload = {
    title,
    description,
    priority,
    status,
    dueDate: dueVal ? new Date(dueVal).toISOString() : null,
  };

  try {
    const task = await apiRequest(API_BASE, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (assignee && task && task.id) {
      await apiRequest(`${API_BASE}/${task.id}/assign`, {
        method: 'PATCH',
        body: JSON.stringify({ assignee }),
      });
    }

    createModal.classList.add('hidden');
    showToast('Task created successfully!', 'success');
    await loadData();
  } catch (err) {
    // Handled by apiRequest
  }
}

window.openAssignModal = function (taskId, currentAssignee = '') {
  assignTaskIdInput.value = taskId;
  assigneeInput.value = currentAssignee;
  assignModal.classList.remove('hidden');
  assigneeInput.focus();
};

async function handleAssignTask(e) {
  e.preventDefault();

  const taskId = assignTaskIdInput.value;
  const assignee = assigneeInput.value.trim();

  if (!assignee) {
    showToast('Assignee cannot be empty', 'error');
    return;
  }

  try {
    await apiRequest(`${API_BASE}/${taskId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assignee }),
    });

    assignModal.classList.add('hidden');
    showToast(`Task assigned to ${assignee}!`, 'success');
    await loadData();
  } catch (err) {
    // Handled by apiRequest
  }
}

window.handleCompleteTask = async function (id) {
  try {
    await apiRequest(`${API_BASE}/${id}/complete`, {
      method: 'PATCH',
    });
    showToast('Task marked as complete! (Priority preserved)', 'success');
    await loadData();
  } catch (err) {
    // Handled by apiRequest
  }
};

window.handleDeleteTask = async function (id) {
  if (!confirm('Are you sure you want to delete this task?')) return;

  try {
    await apiRequest(`${API_BASE}/${id}`, {
      method: 'DELETE',
    });
    showToast('Task deleted', 'success');
    await loadData();
  } catch (err) {
    // Handled by apiRequest
  }
};

// Seed realistic demo tasks
async function seedDemoTasks() {
  const now = Date.now();
  const sampleTasks = [
    {
      title: 'Fix pagination offset calculation in taskService',
      description: 'Resolve off-by-one bug where page 1 skipped the first 10 items.',
      priority: 'high',
      status: 'done',
      assignee: 'Alex Morgan',
      dueDate: new Date(now - 86400000).toISOString(),
    },
    {
      title: 'Implement PATCH /tasks/:id/assign endpoint',
      description: 'Add input validation for non-empty assignee and support reassignment.',
      priority: 'high',
      status: 'done',
      assignee: 'Jordan Lee',
      dueDate: new Date(now - 3600000).toISOString(),
    },
    {
      title: 'Write 100% coverage unit & integration tests',
      description: 'Test all endpoints, validator edge cases, and Supertest route checks.',
      priority: 'high',
      status: 'done',
      assignee: 'Sarah Connor',
      dueDate: new Date(now + 86400000 * 2).toISOString(),
    },
    {
      title: 'Prepare Docker container & deployment pipeline',
      description: 'Configure multi-stage Dockerfile and healthcheck endpoints.',
      priority: 'medium',
      status: 'in_progress',
      assignee: 'David Miller',
      dueDate: new Date(now + 86400000 * 3).toISOString(),
    },
    {
      title: 'Review quarterly architecture roadmap',
      description: 'Finalize service decomposition plan with infrastructure team.',
      priority: 'medium',
      status: 'todo',
      assignee: 'Emma Watson',
      dueDate: new Date(now - 172800000).toISOString(), // Overdue
    },
    {
      title: 'Conduct security vulnerability audit',
      description: 'Verify input sanitization on all PUT and PATCH parameters.',
      priority: 'low',
      status: 'todo',
      assignee: null,
      dueDate: new Date(now + 86400000 * 5).toISOString(),
    },
  ];

  try {
    for (const sample of sampleTasks) {
      const task = await apiRequest(API_BASE, {
        method: 'POST',
        body: JSON.stringify({
          title: sample.title,
          description: sample.description,
          priority: sample.priority,
          status: sample.status,
          dueDate: sample.dueDate,
        }),
        silent: true,
      });

      if (sample.assignee && task && task.id) {
        await apiRequest(`${API_BASE}/${task.id}/assign`, {
          method: 'PATCH',
          body: JSON.stringify({ assignee: sample.assignee }),
          silent: true,
        });
      }
    }

    showToast('Seeded 6 sample tasks with various states!', 'success');
    await loadData();
  } catch (err) {
    showToast('Failed to seed some demo tasks', 'error');
  }
}

// Helpers
function showToast(message, type = 'success') {
  toastEl.textContent = message;
  toastEl.className = `toast ${type}`;
  setTimeout(() => {
    toastEl.className = 'toast hidden';
  }, 3500);
}

function formatStatus(status) {
  if (status === 'in_progress') return 'In Progress';
  if (status === 'todo') return 'To Do';
  if (status === 'done') return 'Completed';
  return status;
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
