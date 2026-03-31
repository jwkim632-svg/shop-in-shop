import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const db = new Database("leads.db");

  // Initialize database
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      contact TEXT,
      experience TEXT,
      industry TEXT,
      revenue TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  app.use(express.json());

  // API: Submit lead
  app.post("/api/support", (req, res) => {
    const { name, contact, experience, industry, revenue } = req.body;
    
    if (!name || !contact) {
      return res.status(400).json({ error: "이름과 연락처는 필수입니다." });
    }

    try {
      const stmt = db.prepare("INSERT INTO leads (name, contact, experience, industry, revenue) VALUES (?, ?, ?, ?, ?)");
      stmt.run(name, contact, experience, industry, revenue);
      res.json({ success: true });
    } catch (error) {
      console.error("Database error:", error);
      res.status(500).json({ error: "서버 오류가 발생했습니다." });
    }
  });

  // API: Get all leads (Admin)
  app.get("/api/leads", (req, res) => {
    try {
      const leads = db.prepare("SELECT * FROM leads ORDER BY created_at DESC").all();
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "데이터를 불러오는데 실패했습니다." });
    }
  });

  // API: Delete a lead
  app.delete("/api/leads/:id", (req, res) => {
    const { id } = req.params;
    try {
      const stmt = db.prepare("DELETE FROM leads WHERE id = ?");
      const result = stmt.run(id);
      if (result.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "해당 지원자를 찾을 수 없습니다." });
      }
    } catch (error) {
      res.status(500).json({ error: "삭제 중 오류가 발생했습니다." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
