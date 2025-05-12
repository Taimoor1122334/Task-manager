const form = document.getElementById("task-form");
const taskList = document.getElementById("task-list");
const sort = document.getElementById("sort");
const filterCategory = document.getElementById("filter-category");
const search = document.getElementById("search");
const notifications = document.getElementById("notifications");
const incompleteCount = document.getElementById("incomplete-count");

let tasks = JSON.parse(localStorage.getItem("tasks")) || [];  

function saveTasks() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
} 

function renderTasks() {
  taskList.innerHTML = "";

  let filtered = tasks.filter(task => {
    const inCategory = filterCategory.value === "all" || task.category === filterCategory.value;
    const inSearch = task.title.toLowerCase().includes(search.value.toLowerCase()) ||
                     task.description.toLowerCase().includes(search.value.toLowerCase());
    return inCategory && inSearch;
  });

  filtered.sort((a, b) => new Date(a[sort.value]) - new Date(b[sort.value]));

  filtered.forEach(task => {
    const li = document.createElement("li");
    li.className = `task ${task.category} ${task.completed ? "completed" : ""}`;

    const dueDate = new Date(task.dueDate);
    const now = new Date();
    if (dueDate < now && !task.completed) {
      li.classList.add("overdue");
    }

    li.innerHTML = `
      <strong>${task.title}</strong> - ${task.description} 
      <br>Due: ${task.dueDate} | Created: ${new Date(task.createdAt).toLocaleString()}
      <br>
      <button class="toggle">${task.completed ? "Uncomplete" : "Complete"}</button>
      <button class="edit">Edit</button>
      <button class="delete">Delete</button>
    `;

    // Toggle Complete
    li.querySelector(".toggle").onclick = () => {
      task.completed = !task.completed;
      saveTasks();
      renderTasks();
    };

    // Delete
    li.querySelector(".delete").onclick = () => {
      tasks = tasks.filter(t => t.id !== task.id);
      saveTasks();
      renderTasks();
    };

    // Edit
    li.querySelector(".edit").onclick = () => {
      document.getElementById("title").value = task.title;
      document.getElementById("description").value = task.description;
      document.getElementById("category").value = task.category;
      document.getElementById("dueDate").value = task.dueDate;
      tasks = tasks.filter(t => t.id !== task.id);
      saveTasks();
      renderTasks();
    };

    taskList.appendChild(li);
  });

  showNotifications();
  updateIncompleteCount();
}

function showNotifications() {
  notifications.innerHTML = "";
  const now = new Date();
  const upcoming = tasks.filter(task => {
    const due = new Date(task.dueDate);
    return due - now <= 24 * 60 * 60 * 1000 && due > now && !task.completed;
  });

  if (upcoming.length > 0) {
    notifications.innerText = `⚠️ ${upcoming.length} task(s) due within 24 hours!`;
  }
}

function updateIncompleteCount() {
  const count = tasks.filter(task => !task.completed).length;
  incompleteCount.innerText = `🔔 Incomplete Tasks: ${count}`;
}

form.onsubmit = function (e) {
  e.preventDefault();

  const title = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const category = document.getElementById("category").value;
  const dueDate = document.getElementById("dueDate").value;

  if (!title || !description || !category || !dueDate) {
    alert("Please fill all fields.");
    return;
  }

  if (new Date(dueDate) <= new Date()) {
    alert("Due date must be in the future.");
    return;
  }

  const task = {
    id: Date.now() + "-" + Math.random().toString(16).slice(2),
    title,
    description,
    category,
    dueDate,
    createdAt: new Date().toISOString(),
    completed: false
  };

  tasks.push(task);
  saveTasks();
  form.reset();
  renderTasks();
};

sort.onchange = renderTasks;
filterCategory.onchange = renderTasks;
search.oninput = renderTasks;

renderTasks();

