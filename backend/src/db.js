const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

const pool = connectionString
  ? new Pool({
      connectionString,
      ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
    })
  : null;

async function init() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS analyses (
      id SERIAL PRIMARY KEY,
      file_name TEXT NOT NULL,
      mime_type TEXT,
      file_size_bytes INTEGER,
      voice_type TEXT NOT NULL,
      voice_type_confidence REAL NOT NULL,
      accent TEXT,
      accent_confidence REAL,
      risk_level TEXT NOT NULL,
      needs_human_review BOOLEAN NOT NULL,
      latency_ms INTEGER,
      report JSONB NOT NULL,
      analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function saveAnalysis(report) {
  if (!pool) return null;
  const { rows } = await pool.query(
    `INSERT INTO analyses
      (file_name, mime_type, file_size_bytes, voice_type, voice_type_confidence,
       accent, accent_confidence, risk_level, needs_human_review, latency_ms, report, analyzed_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id, analyzed_at`,
    [
      report.fileName,
      report.mimeType,
      report.fileSizeBytes,
      report.voiceType,
      report.voiceTypeConfidence,
      report.accent ? report.accent.predicted : null,
      report.accent ? report.accent.confidence : null,
      report.riskLevel,
      report.needsHumanReview,
      report.latencyMs,
      JSON.stringify(report),
      report.analyzedAt,
    ]
  );
  return rows[0];
}

async function listRecentAnalyses(limit = 20) {
  if (!pool) return [];
  const { rows } = await pool.query(
    `SELECT id, file_name, voice_type, voice_type_confidence, accent, accent_confidence,
            risk_level, needs_human_review, latency_ms, analyzed_at
     FROM analyses
     ORDER BY analyzed_at DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

module.exports = { pool, init, saveAnalysis, listRecentAnalyses };
