const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = 3000;
const DB_PATH = path.join(__dirname, "task-manager.db");

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("Database connection failed:", err.message);
  } else {
    console.log("Connected to SQLite database.");
  }
});

db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      status TEXT DEFAULT 'active',
      deadline TEXT,
      createdAt TEXT NOT NULL
    )
  `);

  // Ensure all columns exist (add missing columns if they don't)
  db.run(`ALTER TABLE projects ADD COLUMN description TEXT`, (err) => {
    // Ignore error if column already exists
  });
  db.run(`ALTER TABLE projects ADD COLUMN status TEXT DEFAULT 'active'`, (err) => {
    // Ignore error if column already exists
  });
  db.run(`ALTER TABLE projects ADD COLUMN deadline TEXT`, (err) => {
    // Ignore error if column already exists
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      projectId INTEGER,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      dueDate TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      priority INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS timer_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mode TEXT NOT NULL,
      duration INTEGER NOT NULL,
      completedAt TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL
    )
  `);
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get("/api/projects", (_req, res) => {
  db.all("SELECT * FROM projects ORDER BY createdAt DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Could not fetch projects." });
    }
    return res.json(rows);
  });
});

app.post("/api/projects", (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Project name is required." });
  }

  const createdAt = new Date().toISOString();
  db.run(
    "INSERT INTO projects (name, createdAt) VALUES (?, ?)",
    [name.trim(), createdAt],
    function onInsert(err) {
      if (err) {
        if (err.message.includes("UNIQUE")) {
          return res.status(409).json({ error: "Project name already exists." });
        }
        return res.status(500).json({ error: "Could not create project." });
      }
      return res.status(201).json({ id: this.lastID, name: name.trim(), createdAt });
    }
  );
});

app.delete("/api/projects/:id", (req, res) => {
  const projectId = Number(req.params.id);
  if (Number.isNaN(projectId)) {
    return res.status(400).json({ error: "Invalid project id." });
  }

  db.run("DELETE FROM projects WHERE id = ?", [projectId], function onDelete(err) {
    if (err) {
      return res.status(500).json({ error: "Could not delete project." });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Project not found." });
    }
    return res.json({ success: true });
  });
});

app.get("/api/tasks", (req, res) => {
  const projectId = Number(req.query.projectId);
  if (Number.isNaN(projectId)) {
    return res.status(400).json({ error: "projectId query param is required." });
  }

  db.all(
    "SELECT * FROM tasks WHERE projectId = ? ORDER BY createdAt DESC",
    [projectId],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: "Could not fetch tasks." });
      }

      const formatted = rows.map((row) => ({
        ...row,
        completed: Boolean(row.completed)
      }));
      return res.json(formatted);
    }
  );
});

app.post("/api/tasks", (req, res) => {
  const { title, description, category, dueDate } = req.body;
  const projectId = Number(req.body.projectId);
  if (!projectId || !title || !description || !category || !dueDate) {
    return res.status(400).json({ error: "All task fields are required." });
  }

  const createdAt = new Date().toISOString();
  db.run(
    `INSERT INTO tasks (projectId, title, description, category, dueDate, createdAt, completed)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [projectId, title.trim(), description.trim(), category, dueDate, createdAt],
    function onInsert(err) {
      if (err) {
        return res.status(500).json({ error: "Could not create task." });
      }
      return res.status(201).json({
        id: this.lastID,
        projectId,
        title: title.trim(),
        description: description.trim(),
        category,
        dueDate,
        createdAt,
        completed: false
      });
    }
  );
});

app.put("/api/tasks/:id", (req, res) => {
  const taskId = Number(req.params.id);
  const { title, description, category, dueDate, completed } = req.body;

  if (Number.isNaN(taskId)) {
    return res.status(400).json({ error: "Invalid task id." });
  }

  db.run(
    `UPDATE tasks
     SET title = ?, description = ?, category = ?, dueDate = ?, completed = ?
     WHERE id = ?`,
    [title.trim(), description.trim(), category, dueDate, completed ? 1 : 0, taskId],
    function onUpdate(err) {
      if (err) {
        return res.status(500).json({ error: "Could not update task." });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: "Task not found." });
      }
      return res.json({ success: true });
    }
  );
});

app.patch("/api/tasks/:id/toggle", (req, res) => {
  const taskId = Number(req.params.id);
  if (Number.isNaN(taskId)) {
    return res.status(400).json({ error: "Invalid task id." });
  }

  db.get("SELECT completed FROM tasks WHERE id = ?", [taskId], (findErr, row) => {
    if (findErr) {
      return res.status(500).json({ error: "Could not find task." });
    }
    if (!row) {
      return res.status(404).json({ error: "Task not found." });
    }

    const nextCompleted = row.completed ? 0 : 1;
    db.run("UPDATE tasks SET completed = ? WHERE id = ?", [nextCompleted, taskId], (updateErr) => {
      if (updateErr) {
        return res.status(500).json({ error: "Could not toggle task." });
      }
      return res.json({ success: true, completed: Boolean(nextCompleted) });
    });
  });
});

app.delete("/api/tasks/:id", (req, res) => {
  const taskId = Number(req.params.id);
  if (Number.isNaN(taskId)) {
    return res.status(400).json({ error: "Invalid task id." });
  }

  db.run("DELETE FROM tasks WHERE id = ?", [taskId], function onDelete(err) {
    if (err) {
      return res.status(500).json({ error: "Could not delete task." });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Task not found." });
    }
    return res.json({ success: true });
  });
});

// Enhanced Projects API with description, status, deadline
app.post("/api/projects", (req, res) => {
  const { name, description, status, deadline } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Project name is required." });
  }

  const createdAt = new Date().toISOString();
  db.run(
    "INSERT INTO projects (name, description, status, deadline, createdAt) VALUES (?, ?, ?, ?, ?)",
    [name.trim(), description || "", status || "active", deadline || null, createdAt],
    function onInsert(err) {
      if (err) {
        if (err.message.includes("UNIQUE")) {
          return res.status(409).json({ error: "Project name already exists." });
        }
        return res.status(500).json({ error: "Could not create project." });
      }
      return res.status(201).json({
        id: this.lastID,
        name: name.trim(),
        description: description || "",
        status: status || "active",
        deadline: deadline || null,
        createdAt,
        taskCount: 0
      });
    }
  );
});

app.put("/api/projects/:id", (req, res) => {
  const projectId = Number(req.params.id);
  const { name, description, status, deadline } = req.body;

  if (Number.isNaN(projectId)) {
    return res.status(400).json({ error: "Invalid project id." });
  }

  const updates = [];
  const values = [];

  // Build update query dynamically
  if (name && name.trim()) {
    updates.push("name = ?");
    values.push(name.trim());
  }
  if (description !== undefined) {
    updates.push("description = ?");
    values.push(description || "");
  }
  if (status !== undefined) {
    updates.push("status = ?");
    values.push(status || "active");
  }
  if (deadline !== undefined) {
    updates.push("deadline = ?");
    values.push(deadline || null);
  }

  if (updates.length === 0) {
    // No fields to update, just return the project
    db.get("SELECT * FROM projects WHERE id = ?", [projectId], (err, project) => {
      if (err || !project) {
        return res.status(404).json({ error: "Project not found." });
      }
      return res.json(project);
    });
    return;
  }

  values.push(projectId);

  db.run(
    `UPDATE projects SET ${updates.join(", ")} WHERE id = ?`,
    values,
    function onUpdate(err) {
      if (err) {
        console.error("Update error:", err);
        return res.status(500).json({ error: "Could not update project." });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: "Project not found." });
      }
      // Fetch and return the updated project
      db.get("SELECT * FROM projects WHERE id = ?", [projectId], (err, row) => {
        if (err) {
          console.error("Fetch error:", err);
          return res.status(500).json({ error: "Could not fetch updated project." });
        }
        return res.json(row);
      });
    }
  );
});

// All Tasks API (for My Tasks page)
app.get("/api/all-tasks", (req, res) => {
  db.all("SELECT * FROM tasks ORDER BY createdAt DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Could not fetch tasks." });
    }

    const formatted = rows.map((row) => ({
      ...row,
      completed: Boolean(row.completed)
    }));
    return res.json(formatted);
  });
});

// Timer Sessions API
app.get("/api/timer-sessions", (req, res) => {
  db.all("SELECT * FROM timer_sessions ORDER BY completedAt DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Could not fetch timer sessions." });
    }
    return res.json(rows);
  });
});

app.post("/api/timer-sessions", (req, res) => {
  const { mode, duration } = req.body;
  if (!mode || !duration) {
    return res.status(400).json({ error: "Mode and duration are required." });
  }

  const completedAt = new Date().toISOString();
  db.run(
    "INSERT INTO timer_sessions (mode, duration, completedAt) VALUES (?, ?, ?)",
    [mode, duration, completedAt],
    function onInsert(err) {
      if (err) {
        return res.status(500).json({ error: "Could not create timer session." });
      }
      return res.status(201).json({
        id: this.lastID,
        mode,
        duration,
        completedAt
      });
    }
  );
});

// Settings API
app.get("/api/settings/:key", (req, res) => {
  const key = req.params.key;
  db.get("SELECT value FROM settings WHERE key = ?", [key], (err, row) => {
    if (err) {
      return res.status(500).json({ error: "Could not fetch setting." });
    }
    return res.json({ value: row ? row.value : null });
  });
});

app.put("/api/settings/:key", (req, res) => {
  const key = req.params.key;
  const { value } = req.body;

  db.run(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    [key, JSON.stringify(value)],
    function onInsert(err) {
      if (err) {
        return res.status(500).json({ error: "Could not save setting." });
      }
      return res.json({ success: true });
    }
  );
});

// Data Export API
app.get("/api/export", (req, res) => {
  const exportData = {};

  db.all("SELECT * FROM projects", [], (err, projects) => {
    if (err) return res.status(500).json({ error: "Could not export projects." });
    exportData.projects = projects;

    db.all("SELECT * FROM tasks", [], (err, tasks) => {
      if (err) return res.status(500).json({ error: "Could not export tasks." });
      exportData.tasks = tasks;

      db.all("SELECT * FROM timer_sessions", [], (err, sessions) => {
        if (err) return res.status(500).json({ error: "Could not export sessions." });
        exportData.timerSessions = sessions;

        db.all("SELECT * FROM settings", [], (err, settings) => {
          if (err) return res.status(500).json({ error: "Could not export settings." });
          exportData.settings = settings;
          exportData.exportedAt = new Date().toISOString();

          res.json(exportData);
        });
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Task manager running at http://localhost:${PORT}`);
});
