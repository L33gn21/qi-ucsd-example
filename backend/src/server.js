const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { runMockPipeline } = require("./mockPipeline");
const db = require("./db");

const PORT = process.env.PORT || 4000;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("audio/") || file.mimetype === "video/webm") {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are accepted"));
    }
  },
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "voxshield-backend", db: db.pool ? "connected" : "disabled" });
});

app.post("/api/analyze", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file was uploaded (field name: 'audio')" });
  }

  const startedAt = Date.now();
  const report = runMockPipeline({
    buffer: req.file.buffer,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
  });
  const latencyMs = Date.now() - startedAt;

  const fullReport = {
    ...report,
    fileSizeBytes: req.file.size,
    latencyMs,
    analyzedAt: new Date().toISOString(),
  };

  try {
    await db.saveAnalysis(fullReport);
  } catch (err) {
    console.error("Failed to persist analysis:", err.message);
  }

  res.json(fullReport);
});

app.get("/api/history", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  try {
    const rows = await db.listRecentAnalyses(limit);
    res.json({ items: rows });
  } catch (err) {
    console.error("Failed to load history:", err.message);
    res.status(500).json({ error: "Failed to load history" });
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError || err) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: "Internal server error" });
});

db.init()
  .then(() => {
    if (db.pool) console.log("Connected to PostgreSQL and ensured schema.");
    else console.log("DATABASE_URL not set; running without persistence.");
  })
  .catch((err) => console.error("Failed to initialize database:", err.message))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`VoxShield backend listening on http://localhost:${PORT}`);
    });
  });
