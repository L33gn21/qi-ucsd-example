# VoxShield

Trust-based voice fraud screening demo. VoxShield analyzes a suspicious phone recording in two sequential stages:

1. **Synthetic voice detection** — is the voice human or AI-generated?
2. **Accent estimation** — only if the voice is human, estimate which of 4 English accents it matches (American, British, Indian, Australian).

It produces a report with a verdict, confidence score, and risk level. VoxShield is a decision-support tool, not a final judge — boundary-confidence cases are flagged for human review.

This is a hackathon-style demo: the ML models are **mocked** (deterministic pseudo-random outputs derived from the uploaded file), matching the PRD's two-stage pipeline shape without training real models.

Every analysis is persisted to **PostgreSQL** so past screenings can be reviewed; the UI shows a "recent analyses" table backed by `GET /api/history`.

## Contents

- [`backend/`](backend) — Express API server (`/api/analyze`, `/api/history`) that runs the mock pipeline, stores each report in Postgres, and returns a JSON report
- [`frontend/`](frontend) — static HTML/CSS/JS UI (served by a small Express static server) for uploading audio and viewing the report + history
- [`render.yaml`](render.yaml) — Render Blueprint that provisions a free Postgres database plus the backend and frontend services

## Running locally

### 1. Postgres

You need a reachable PostgreSQL instance. Easiest local option is Docker:

```bash
docker run --name voxshield-pg -e POSTGRES_PASSWORD=voxshield -e POSTGRES_DB=voxshield -p 5432:5432 -d postgres:16
```

The backend auto-creates its `analyses` table on startup — no migrations to run by hand.

If `DATABASE_URL` isn't set, the backend still runs fine (analyses just aren't persisted and `/api/history` returns an empty list) — handy for quick UI iteration.

### 2. Install & run

```bash
cd backend && npm install
cd ../frontend && npm install
```

```bash
# Terminal 1
cd backend
export DATABASE_URL=postgres://postgres:voxshield@localhost:5432/voxshield
npm start   # http://localhost:4000

# Terminal 2
cd frontend && npm start  # http://localhost:5173
```

Open `http://localhost:5173`, upload an audio file, and click "분석 시작" (Analyze) to see the mocked pipeline run, the resulting report, and the updated history table below it.

## Deploying (Render)

This repo includes a [Render Blueprint](https://render.com/docs/blueprint-spec) (`render.yaml`) that provisions:

- `voxshield-db` — a free managed PostgreSQL instance
- `voxshield-backend` — the API, wired to `voxshield-db` via `DATABASE_URL` automatically
- `voxshield-frontend` — the static-ish UI server

Steps:

1. Push this repo to GitHub (already the case if you're reading this from the repo).
2. In the Render dashboard: **New +** → **Blueprint** → select this repo. Render reads `render.yaml` and provisions all three resources.
3. After the first deploy, open the `voxshield-backend` service, copy its public URL (e.g. `https://voxshield-backend.onrender.com`).
4. Open the `voxshield-frontend` service → **Environment** → set `BACKEND_URL` to that URL → save (triggers a redeploy).
5. Visit the `voxshield-frontend` URL — it now talks to the backend, which talks to Postgres.

Free-tier services spin down when idle, so the first request after inactivity may take ~30s to wake up.
