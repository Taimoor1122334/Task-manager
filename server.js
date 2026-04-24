const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase using environment variables (safer)
const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID || "task-manager-c98ec",
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI || "https://accounts.google.com/o/oauth2/auth",
  token_uri: process.env.FIREBASE_TOKEN_URI || "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_CERT_URL || "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL
};

// Only initialize if we have valid credentials
if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log("Firebase initialized successfully");
} else {
  console.log("Warning: Firebase credentials not configured. Set environment variables.");
}

const db = admin.firestore();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ==================== PROJECTS ====================

app.get("/api/projects", async (_req, res) => {
  try {
    const snapshot = await db.collection("projects").orderBy("createdAt", "desc").get();
    const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Could not fetch projects." });
  }
});

app.post("/api/projects", async (req, res) => {
  const { name, description, status, deadline } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Project name is required." });
  }

  try {
    // Check if project name already exists
    const existing = await db.collection("projects").where("name", "==", name.trim()).get();
    if (!existing.empty) {
      return res.status(409).json({ error: "Project name already exists." });
    }

    const createdAt = new Date().toISOString();
    const docRef = await db.collection("projects").add({
      name: name.trim(),
      description: description || "",
      status: status || "active",
      deadline: deadline || null,
      createdAt
    });

    res.status(201).json({ id: docRef.id, name: name.trim(), description, status, deadline, createdAt });
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ error: "Could not create project." });
  }
});

app.put("/api/projects/:id", async (req, res) => {
  const projectId = req.params.id;
  const { name, description, status, deadline } = req.body;

  try {
    await db.collection("projects").doc(projectId).update({
      ...(name && { name: name.trim() }),
      ...(description !== undefined && { description }),
      ...(status && { status }),
      ...(deadline !== undefined && { deadline })
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ error: "Could not update project." });
  }
});

app.delete("/api/projects/:id", async (req, res) => {
  const projectId = req.params.id;

  try {
    await db.collection("projects").doc(projectId).delete();
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Could not delete project." });
  }
});

// ==================== TASKS ====================

app.get("/api/tasks", async (req, res) => {
  const projectId = req.query.projectId;
  if (!projectId) {
    return res.status(400).json({ error: "projectId query param is required." });
  }

  try {
    const snapshot = await db.collection("tasks")
      .where("projectId", "==", projectId)
      .orderBy("createdAt", "desc")
      .get();
    const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: "Could not fetch tasks." });
  }
});

app.get("/api/all-tasks", async (_req, res) => {
  try {
    const snapshot = await db.collection("tasks").orderBy("createdAt", "desc").get();
    const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(tasks);
  } catch (error) {
    console.error("Error fetching all tasks:", error);
    res.status(500).json({ error: "Could not fetch tasks." });
  }
});

app.post("/api/tasks", async (req, res) => {
  const { title, description, category, dueDate, projectId } = req.body;
  
  if (!projectId || !title || !description || !category || !dueDate) {
    return res.status(400).json({ error: "All task fields are required." });
  }

  try {
    const createdAt = new Date().toISOString();
    const docRef = await db.collection("tasks").add({
      projectId,
      title: title.trim(),
      description: description.trim(),
      category,
      dueDate,
      createdAt,
      completed: false,
      priority: 0
    });

    res.status(201).json({
      id: docRef.id,
      projectId,
      title: title.trim(),
      description: description.trim(),
      category,
      dueDate,
      createdAt,
      completed: false
    });
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: "Could not create task." });
  }
});

app.put("/api/tasks/:id", async (req, res) => {
  const taskId = req.params.id;
  const { title, description, category, dueDate, completed } = req.body;

  try {
    await db.collection("tasks").doc(taskId).update({
      ...(title && { title: title.trim() }),
      ...(description !== undefined && { description: description.trim() }),
      ...(category && { category }),
      ...(dueDate && { dueDate }),
      ...(completed !== undefined && { completed })
    });
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ error: "Could not update task." });
  }
});

app.patch("/api/tasks/:id/toggle", async (req, res) => {
  const taskId = req.params.id;

  try {
    const doc = await db.collection("tasks").doc(taskId).get();
    if (!doc.exists) {
      return res.status(404).json({ error: "Task not found." });
    }

    const currentCompleted = doc.data().completed;
    await db.collection("tasks").doc(taskId).update({ completed: !currentCompleted });
    res.json({ success: true, completed: !currentCompleted });
  } catch (error) {
    console.error("Error toggling task:", error);
    res.status(500).json({ error: "Could not toggle task." });
  }
});

app.delete("/api/tasks/:id", async (req, res) => {
  const taskId = req.params.id;

  try {
    await db.collection("tasks").doc(taskId).delete();
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ error: "Could not delete task." });
  }
});

// ==================== TIMER SESSIONS ====================

app.get("/api/timer-sessions", async (_req, res) => {
  try {
    const snapshot = await db.collection("timer_sessions").orderBy("completedAt", "desc").get();
    const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(sessions);
  } catch (error) {
    console.error("Error fetching sessions:", error);
    res.status(500).json({ error: "Could not fetch sessions." });
  }
});

app.post("/api/timer-sessions", async (req, res) => {
  const { mode, duration } = req.body;

  try {
    const completedAt = new Date().toISOString();
    const docRef = await db.collection("timer_sessions").add({
      mode,
      duration,
      completedAt
    });

    res.status(201).json({ id: docRef.id, mode, duration, completedAt });
  } catch (error) {
    console.error("Error creating session:", error);
    res.status(500).json({ error: "Could not create session." });
  }
});

// ==================== SETTINGS ====================

app.get("/api/settings/general", async (_req, res) => {
  try {
    const doc = await db.collection("settings").doc("general").get();
    res.json(doc.exists ? doc.data() : {});
  } catch (error) {
    res.status(500).json({ error: "Could not fetch settings." });
  }
});

app.put("/api/settings/general", async (req, res) => {
  try {
    await db.collection("settings").doc("general").set(req.body, { merge: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Could not save settings." });
  }
});

app.get("/api/settings/theme", async (_req, res) => {
  try {
    const doc = await db.collection("settings").doc("theme").get();
    res.json(doc.exists ? doc.data() : {});
  } catch (error) {
    res.status(500).json({ error: "Could not fetch theme." });
  }
});

app.put("/api/settings/theme", async (req, res) => {
  try {
    await db.collection("settings").doc("theme").set(req.body, { merge: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Could not save theme." });
  }
});

app.get("/api/settings/accentColor", async (_req, res) => {
  try {
    const doc = await db.collection("settings").doc("accentColor").get();
    res.json(doc.exists ? doc.data() : {});
  } catch (error) {
    res.status(500).json({ error: "Could not fetch accent color." });
  }
});

app.put("/api/settings/accentColor", async (req, res) => {
  try {
    await db.collection("settings").doc("accentColor").set(req.body, { merge: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Could not save accent color." });
  }
});

app.get("/api/settings/fontSize", async (_req, res) => {
  try {
    const doc = await db.collection("settings").doc("fontSize").get();
    res.json(doc.exists ? doc.data() : {});
  } catch (error) {
    res.status(500).json({ error: "Could not fetch font size." });
  }
});

app.put("/api/settings/fontSize", async (req, res) => {
  try {
    await db.collection("settings").doc("fontSize").set(req.body, { merge: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Could not save font size." });
  }
});

app.get("/api/settings/notifications", async (_req, res) => {
  try {
    const doc = await db.collection("settings").doc("notifications").get();
    res.json(doc.exists ? doc.data() : {});
  } catch (error) {
    res.status(500).json({ error: "Could not fetch notifications." });
  }
});

app.put("/api/settings/notifications", async (req, res) => {
  try {
    await db.collection("settings").doc("notifications").set(req.body, { merge: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Could not save notifications." });
  }
});

// ==================== EXPORT ====================

app.get("/api/export", async (_req, res) => {
  try {
    const [projectsSnap, tasksSnap, sessionsSnap] = await Promise.all([
      db.collection("projects").get(),
      db.collection("tasks").get(),
      db.collection("timer_sessions").get()
    ]);

    const data = {
      projects: projectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      tasks: tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      timerSessions: sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      exportedAt: new Date().toISOString()
    };

    res.json(data);
  } catch (error) {
    console.error("Error exporting data:", error);
    res.status(500).json({ error: "Could not export data." });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Using Firebase Firestore database`);
});
