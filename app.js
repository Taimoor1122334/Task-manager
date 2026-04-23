// Navigation function
function navigate(page) {
  window.location.href = page;
}

const taskForm = document.getElementById("task-form");
const projectForm = document.getElementById("project-form");
const projectNameInput = document.getElementById("project-name");
const projectSelect = document.getElementById("project-select");
const deleteProjectBtn = document.getElementById("delete-project");
const taskList = document.getElementById("task-list");
const sortSelect = document.getElementById("sort");
const filterCategorySelect = document.getElementById("filter-category");
const searchInput = document.getElementById("search");
const notifications = document.getElementById("notifications");
const incompleteCount = document.getElementById("incomplete-count");
const projectSummary = document.getElementById("project-summary");
const totalProjectsEl = document.getElementById("total-projects");
const totalTasksEl = document.getElementById("total-tasks");
const completedTasksEl = document.getElementById("completed-tasks");
const completionRateEl = document.getElementById("completion-rate");
const calendarTitle = document.getElementById("calendar-title");
const calendarWidget = document.getElementById("calendar-widget");
const upcomingList = document.getElementById("upcoming-list");
const activityFeed = document.getElementById("activity-feed");
const taskSubmit = document.getElementById("task-submit");
const cancelEditBtn = document.getElementById("cancel-edit");
const timerDisplay = document.getElementById("timer-display");
const timerStart = document.getElementById("timer-start");
const timerPause = document.getElementById("timer-pause");
const timerReset = document.getElementById("timer-reset");

let projects = [];
let tasks = [];
let selectedProjectId = null;
let editingTaskId = null;
let activity = [];
let timerSeconds = 25 * 60;
let timerInterval = null;

async function loadProjects() {
  try {
    const response = await fetch(`${API_BASE}/api/projects`);
    if (response.ok) {
      projects = await response.json();
      renderProjects();
      updateStats();
    }
  } catch (error) {
    console.error('Error loading projects:', error);
  }
}

async function loadTasks() {
  if (!selectedProjectId) return;
  try {
    const response = await fetch(`${API_BASE}/api/tasks?projectId=${selectedProjectId}`);
    if (response.ok) {
      tasks = await response.json();
      renderTasks();
      updateStats();
    }
  } catch (error) {
    console.error('Error loading tasks:', error);
  }
}

function logActivity(message) {
  activity.unshift(`${new Date().toLocaleTimeString()} - ${message}`);
  activity = activity.slice(0, 8);
  renderActivity();
}

function renderActivity() {
  if (!activity.length) {
    activityFeed.innerHTML = "<li>No recent actions.</li>";
    return;
  }
  activityFeed.innerHTML = activity.map((item) => `<li>${item}</li>`).join("");
}

function formatDate(dateString) {
  // Parse the date string directly without timezone conversion
  const [year, month, day] = dateString.split('-');
  const date = new Date(year, parseInt(month) - 1, day);
  return date.toLocaleDateString();
}

function parseLocalDate(dateString) {
  // Parse date string in local timezone (not UTC)
  const [year, month, day] = dateString.split('-');
  return new Date(year, parseInt(month) - 1, day);
}

function updateTimerDisplay() {
  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;
  timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function buildCalendar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay.getDay();
  const dueDates = new Set(tasks.filter((t) => !t.completed).map((t) => Number(t.dueDate.slice(-2))));
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  calendarTitle.textContent = now.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

  calendarWidget.innerHTML = labels.map((label) => `<div class="calendar-head">${label}</div>`).join("");

  for (let i = 0; i < startOffset; i += 1) {
    calendarWidget.innerHTML += "<div class='calendar-day'></div>";
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const isToday = day === now.getDate();
    const hasTask = dueDates.has(day);
    const classes = ["calendar-day"];
    if (isToday) classes.push("today");
    if (hasTask) classes.push("has-task");
    calendarWidget.innerHTML += `<div class="${classes.join(" ")}">${day}</div>`;
  }
}

function updateStats() {
  const completed = tasks.filter((task) => task.completed).length;
  const rate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  totalProjectsEl.textContent = String(projects.length);
  totalTasksEl.textContent = String(tasks.length);
  completedTasksEl.textContent = String(completed);
  completionRateEl.textContent = `${rate}%`;
  incompleteCount.textContent = `Incomplete: ${tasks.length - completed}`;
}

function updateNotice() {
  if (!selectedProjectId) {
    notifications.textContent = "Create or select a project to start managing tasks.";
    return;
  }
  const now = new Date();
  const dueSoon = tasks.filter((task) => {
    if (task.completed) return false;
    const due = parseLocalDate(task.dueDate);
    return due > now && due - now <= 24 * 60 * 60 * 1000;
  });
  notifications.textContent = dueSoon.length
    ? `${dueSoon.length} task(s) are due within the next 24 hours.`
    : "Everything is under control. No urgent deadlines today.";
}

function fillProjectDropdown() {
  projectSelect.innerHTML = '<option value="">Select project</option>';
  projects.forEach((project) => {
    const option = document.createElement("option");
    option.value = String(project.id);
    option.textContent = project.name;
    projectSelect.appendChild(option);
  });
  if (selectedProjectId) {
    projectSelect.value = String(selectedProjectId);
  }
}

function setTaskFormEnabled(enabled) {
  Array.from(taskForm.elements).forEach((el) => {
    el.disabled = !enabled;
  });
}

function updateProjectSummary() {
  const selected = projects.find((project) => project.id === selectedProjectId);
  if (!selected) {
    projectSummary.textContent = "No project selected";
    return;
  }
  const done = tasks.filter((task) => task.completed).length;
  projectSummary.textContent = `${selected.name} (${done}/${tasks.length} done)`;
}

function renderUpcoming() {
  const upcoming = tasks
    .filter((task) => !task.completed)
    .sort((a, b) => parseLocalDate(a.dueDate) - parseLocalDate(b.dueDate))
    .slice(0, 4);

  if (!upcoming.length) {
    upcomingList.innerHTML = "<li>No upcoming pending tasks.</li>";
    return;
  }

  upcomingList.innerHTML = upcoming
    .map((task) => `<li><strong>${task.title}</strong><br>Due ${formatDate(task.dueDate)}</li>`)
    .join("");
}

function renderTasks() {
  if (!selectedProjectId) {
    taskList.innerHTML = "<li class='empty'>Select a project to view tasks.</li>";
    updateStats();
    updateNotice();
    buildCalendar();
    renderUpcoming();
    return;
  }

  const query = searchInput.value.trim().toLowerCase();
  const category = filterCategorySelect.value;
  const sortKey = sortSelect.value;
  const now = new Date();

  const filtered = tasks
    .filter((task) => {
      const matchesQuery =
        task.title.toLowerCase().includes(query) || task.description.toLowerCase().includes(query);
      const matchesCategory = category === "all" || task.category === category;
      return matchesQuery && matchesCategory;
    })
    .sort((a, b) => parseLocalDate(a[sortKey]) - parseLocalDate(b[sortKey]));

  if (!filtered.length) {
    taskList.innerHTML = "<li class='empty'>No tasks match current filters.</li>";
  } else {
    taskList.innerHTML = filtered
      .map((task) => {
        const overdue = parseLocalDate(task.dueDate) < now && !task.completed ? "overdue" : "";
        const completed = task.completed ? "completed" : "";
        return `
          <li class="task-item ${task.category} ${overdue} ${completed}">
            <div class="task-top">
              <p class="task-title">${task.title}</p>
              <input type="checkbox" data-action="toggle" data-id="${task.id}" ${task.completed ? "checked" : ""} />
            </div>
            <p class="task-meta">${task.description}</p>
            <p class="task-meta">Due ${formatDate(task.dueDate)} | ${task.category}</p>
            <div class="task-actions">
              <button type="button" data-action="edit" data-id="${task.id}">Edit</button>
              <button type="button" class="danger" data-action="delete" data-id="${task.id}">Delete</button>
            </div>
          </li>
        `;
      })
      .join("");
  }

  updateProjectSummary();
  updateStats();
  updateNotice();
  buildCalendar();
  renderUpcoming();
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Request failed.");
  }
  return response.status === 204 ? null : response.json();
}

function resetTaskForm() {
  taskForm.reset();
  editingTaskId = null;
  taskSubmit.textContent = "Add Task";
  cancelEditBtn.hidden = true;
}

async function loadTasks(projectId) {
  tasks = await api(`/api/tasks?projectId=${projectId}`);
  renderTasks();
}

async function loadProjects() {
  projects = await api("/api/projects");
  fillProjectDropdown();

  if (!projects.length) {
    selectedProjectId = null;
    tasks = [];
    setTaskFormEnabled(false);
    resetTaskForm();
    renderTasks();
    return;
  }

  if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
    selectedProjectId = projects[0].id;
  }
  setTaskFormEnabled(true);
  fillProjectDropdown();
  await loadTasks(selectedProjectId);
}

projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const name = projectNameInput.value.trim();
    if (!name) {
      alert("Project name is required.");
      return;
    }
    await api("/api/projects", {
      method: "POST",
      body: JSON.stringify({ name })
    });
    projectForm.reset();
    logActivity(`Created project "${name}"`);
    await loadProjects();
  } catch (error) {
    alert(error.message);
  }
});

deleteProjectBtn.addEventListener("click", async () => {
  if (!selectedProjectId) {
    alert("Select a project first.");
    return;
  }
  if (!window.confirm("Delete this project and all tasks?")) {
    return;
  }
  try {
    const selected = projects.find((project) => project.id === selectedProjectId);
    await api(`/api/projects/${selectedProjectId}`, { method: "DELETE" });
    logActivity(`Deleted project "${selected ? selected.name : ""}"`);
    selectedProjectId = null;
    await loadProjects();
  } catch (error) {
    alert(error.message);
  }
});

projectSelect.addEventListener("change", async () => {
  const value = Number(projectSelect.value);
  selectedProjectId = Number.isNaN(value) ? null : value;
  resetTaskForm();

  if (!selectedProjectId) {
    tasks = [];
    setTaskFormEnabled(false);
    renderTasks();
    return;
  }
  setTaskFormEnabled(true);
  await loadTasks(selectedProjectId);
});

taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    if (!selectedProjectId) {
      alert("Select a project first.");
      return;
    }

    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const category = document.getElementById("category").value;
    const dueDate = document.getElementById("dueDate").value;
    if (!title || !description || !category || !dueDate) {
      alert("Please fill all fields.");
      return;
    }

    const existing = tasks.find((task) => task.id === editingTaskId);
    if (editingTaskId && existing) {
      await api(`/api/tasks/${editingTaskId}`, {
        method: "PUT",
        body: JSON.stringify({
          title,
          description,
          category,
          dueDate,
          completed: existing.completed
        })
      });
      logActivity(`Updated task "${title}"`);
    } else {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          projectId: selectedProjectId,
          title,
          description,
          category,
          dueDate
        })
      });
      logActivity(`Added task "${title}"`);
    }

    resetTaskForm();
    await loadTasks(selectedProjectId);
  } catch (error) {
    alert(error.message);
  }
});

cancelEditBtn.addEventListener("click", resetTaskForm);

taskList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const action = target.dataset.action;
  const taskId = Number(target.dataset.id);
  if (!action || Number.isNaN(taskId)) return;

  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;

  try {
    if (action === "edit") {
      document.getElementById("title").value = task.title;
      document.getElementById("description").value = task.description;
      document.getElementById("category").value = task.category;
      document.getElementById("dueDate").value = task.dueDate;
      editingTaskId = task.id;
      taskSubmit.textContent = "Update Task";
      cancelEditBtn.hidden = false;
      return;
    }

    if (action === "delete") {
      await api(`/api/tasks/${task.id}`, { method: "DELETE" });
      logActivity(`Deleted task "${task.title}"`);
      await loadTasks(selectedProjectId);
    }
  } catch (error) {
    alert(error.message);
  }
});

taskList.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.dataset.action !== "toggle") return;
  const taskId = Number(target.dataset.id);
  if (Number.isNaN(taskId)) return;
  try {
    await api(`/api/tasks/${taskId}/toggle`, { method: "PATCH" });
    const task = tasks.find((item) => item.id === taskId);
    if (task) {
      logActivity(`${task.completed ? "Reopened" : "Completed"} "${task.title}"`);
    }
    await loadTasks(selectedProjectId);
  } catch (error) {
    alert(error.message);
  }
});

sortSelect.addEventListener("change", renderTasks);
filterCategorySelect.addEventListener("change", renderTasks);
searchInput.addEventListener("input", renderTasks);

timerStart.addEventListener("click", () => {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    timerSeconds -= 1;
    updateTimerDisplay();
    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      timerSeconds = 0;
      updateTimerDisplay();
      logActivity("Focus session completed");
      alert("Focus session completed.");
    }
  }, 1000);
});

timerPause.addEventListener("click", () => {
  if (!timerInterval) return;
  clearInterval(timerInterval);
  timerInterval = null;
});

timerReset.addEventListener("click", () => {
  clearInterval(timerInterval);
  timerInterval = null;
  timerSeconds = 25 * 60;
  updateTimerDisplay();
});

setTaskFormEnabled(false);
updateTimerDisplay();
renderActivity();
loadProjects().catch((error) => {
  alert(`Server error: ${error.message}. Start backend with npm start`);
});

