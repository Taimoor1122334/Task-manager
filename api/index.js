// Vercel API Route - Unified handler for all endpoints
const admin = require("firebase-admin");
const serviceAccount = require("../task-manager-c98ec-firebase-adminsdk-fbsvc-994d0b9258.json");

// Initialize Firebase (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Helper to handle CORS
function handleCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  handleCORS(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { url } = req;
  const path = url.split("?")[0];

  try {
    // ==================== PROJECTS ====================
    if (path === "/api/projects" || path === "/projects") {
      if (req.method === "GET") {
        const snapshot = await db.collection("projects").orderBy("createdAt", "desc").get();
        const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.status(200).json(projects);
      }
      
      if (req.method === "POST") {
        const { name, description, status, deadline } = req.body;
        if (!name || !name.trim()) {
          return res.status(400).json({ error: "Project name is required." });
        }
        
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
        
        return res.status(201).json({ id: docRef.id, name: name.trim(), description, status, deadline, createdAt });
      }
    }

    // ==================== TASKS ====================
    if (path === "/api/tasks" || path === "/tasks") {
      if (req.method === "GET") {
        const projectId = req.query.projectId;
        if (!projectId) {
          return res.status(400).json({ error: "projectId query param is required." });
        }
        
        const snapshot = await db.collection("tasks")
          .where("projectId", "==", projectId)
          .orderBy("createdAt", "desc")
          .get();
        const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.status(200).json(tasks);
      }
      
      if (req.method === "POST") {
        const { title, description, category, dueDate, projectId } = req.body;
        
        if (!projectId || !title || !description || !category || !dueDate) {
          return res.status(400).json({ error: "All task fields are required." });
        }
        
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
        
        return res.status(201).json({
          id: docRef.id,
          projectId,
          title: title.trim(),
          description: description.trim(),
          category,
          dueDate,
          createdAt,
          completed: false
        });
      }
    }

    // ==================== ALL TASKS ====================
    if (path === "/api/all-tasks" || path === "/all-tasks") {
      if (req.method === "GET") {
        const snapshot = await db.collection("tasks").orderBy("createdAt", "desc").get();
        const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.status(200).json(tasks);
      }
    }

    // ==================== TIMER SESSIONS ====================
    if (path === "/api/timer-sessions" || path === "/timer-sessions") {
      if (req.method === "GET") {
        const snapshot = await db.collection("timer_sessions").orderBy("completedAt", "desc").get();
        const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return res.status(200).json(sessions);
      }
      
      if (req.method === "POST") {
        const { mode, duration } = req.body;
        const completedAt = new Date().toISOString();
        const docRef = await db.collection("timer_sessions").add({ mode, duration, completedAt });
        return res.status(201).json({ id: docRef.id, mode, duration, completedAt });
      }
    }

    // ==================== SETTINGS ====================
    if (path.startsWith("/api/settings/")) {
      const settingKey = path.split("/api/settings/")[1];
      
      if (req.method === "GET") {
        const doc = await db.collection("settings").doc(settingKey).get();
        return res.status(200).json(doc.exists ? doc.data() : {});
      }
      
      if (req.method === "PUT") {
        await db.collection("settings").doc(settingKey).set(req.body, { merge: true });
        return res.status(200).json({ success: true });
      }
    }

    // ==================== EXPORT ====================
    if (path === "/api/export" || path === "/export") {
      const [projectsSnap, tasksSnap, sessionsSnap] = await Promise.all([
        db.collection("projects").get(),
        db.collection("tasks").get(),
        db.collection("timer_sessions").get()
      ]);

      return res.status(200).json({
        projects: projectsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        tasks: tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        timerSessions: sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        exportedAt: new Date().toISOString()
      });
    }

    // 404 for unknown routes
    return res.status(404).json({ error: "Endpoint not found" });

  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: error.message });
  }
}