// Vercel API Route - Unified handler for all endpoints
const admin = require("firebase-admin");

// Initialize Firebase using environment variables (safer for deployment)
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
let db = null;
if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  db = admin.firestore();
  console.log("Firebase initialized successfully");
} else {
  console.log("Warning: Firebase credentials not configured. Set environment variables.");
}

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

  // Check if Firebase is initialized
  if (!db) {
    return res.status(503).json({ 
      error: "Firebase is not configured. Please set environment variables.",
      details: "Set FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, FIREBASE_PROJECT_ID"
    });
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