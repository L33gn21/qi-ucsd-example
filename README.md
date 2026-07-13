# VoxShield

Trust-based voice fraud screening demo. VoxShield analyzes a suspicious phone recording in two sequential stages:

1. **Synthetic voice detection** — is the voice human or AI-generated?
2. **Accent estimation** — only if the voice is human, estimate which of 4 English accents it matches (American, British, Indian, Australian).

It produces a report with a verdict, confidence score, and risk level. VoxShield is a decision-support tool, not a final judge — boundary-confidence cases are flagged for human review.

This is a hackathon-style demo: the ML models are **mocked** (deterministic pseudo-random outputs derived from the uploaded file), matching the PRD's two-stage pipeline shape without training real models.

## Contents

- [`backend/`](backend) — Express API server (`/api/analyze`) that runs the mock pipeline and returns a JSON report
- [`frontend/`](frontend) — static HTML/CSS/JS UI (served by a small Express static server) for uploading audio and viewing the report

## Running locally

Install dependencies once for each app:

```bash
cd backend && npm install
cd ../frontend && npm install
```

Then run both servers (in separate terminals):

```bash
# Terminal 1
cd backend && npm start   # http://localhost:4000

# Terminal 2
cd frontend && npm start  # http://localhost:5173
```

Open `http://localhost:5173`, upload an audio file, and click "분석 시작" (Analyze) to see the mocked pipeline run and the resulting report.
