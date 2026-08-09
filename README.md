# Internship Hunt

An AI-powered job application pipeline that automates resume tailoring and application tracking.

- **Submit** a job description (PDF or text)
- **AI scores** how well you match the role (Gemini)
- **Generates** a tailored, ATS-optimized LaTeX resume
- **Compiles** to PDF and saves everything
- **Dashboard** to track scores, statuses, and download resumes

## Architecture

```
┌──────────────────┐     Webhook      ┌──────────────────┐     SQL      ┌─────────────────┐
│   Frontend       │ ──────────────►  │   n8n (Hosted)   │ ──────────► │   PostgreSQL     │
│   (Next.js 15)   │ ◄────────────── │   + Gemini AI    │ ◄────────── │   + pgvector     │
│   localhost:3000  │     Reads DB     │                  │             │                   │
└──────────────────┘                  └────────┬─────────┘             └─────────────────┘
                                               │
                                               ▼
                                      ┌──────────────────┐
                                      │  LaTeX Service   │
                                      │  (Flask, Python) │
                                      └──────────────────┘
```

## Project Structure

```
job-hunt/
├── frontend/              # Next.js 15 dashboard
│   ├── app/               # Pages, API routes, components
│   ├── lib/               # DB, S3, auth utilities
│   └── package.json
│
├── backend/               # n8n workflow source code
│   ├── code_nodes/        # JavaScript for n8n Code nodes
│   ├── prompts/           # Gemini AI prompt templates
│   ├── latex-service/     # LaTeX → PDF microservice
│   ├── workflows/         # Importable n8n workflow JSONs
│   ├── templates/         # LaTeX resume template
│   └── seed/              # Reference candidate profile
│
└── docs/                  # Documentation
    ├── BACKEND_README.md   # Backend architecture details
    └── TELEGRAM_SETUP.md   # Telegram bot setup
```

## Quick Start

### Frontend (Dashboard)

```bash
cd frontend
npm install
cp .env.example .env.local   # Edit with your DB and webhook credentials
npm run dev                   # http://localhost:3000
```

See [`frontend/.env.example`](frontend/.env.example) for every variable and what it does.

### Demo account

The login page has an **"Explore the demo"** button so recruiters and first-time
visitors can see the whole app without signing up. It signs into a seeded account
(`demo@applai.dev`) that owns a sample profile, 11 scored jobs across every kanban
column, and 7 compiled resumes.

The credentials are hardcoded in [`app/login/page.js`](frontend/app/login/page.js) —
this is a public demo, so there is nothing secret to configure. No extra environment
variables are needed in Vercel.

Seed or reset it:

```bash
cd frontend
npm run seed:demo         # reads .env / .env.local  (local Postgres)
npm run seed:demo:prod    # reads .env.production    (Supabase)
```

The script is idempotent — re-running wipes and reinserts the demo user's jobs and
profile, which is how you reset whatever visitors changed. It touches no other user's
data. It also uploads each demo resume's `.tex` to S3 and, if `LATEX_SERVICE_URL` is
reachable, compiles and uploads the `.pdf` alongside it.

### Backend (n8n Workflows)

The n8n workflows are hosted. The `backend/` directory contains:
- **Source code** for n8n Code nodes (version-controlled in `code_nodes/`)
- **AI prompts** for Gemini (in `prompts/`)
- **Workflow JSON** files for import into n8n (in `workflows/`)
- **LaTeX service** for PDF compilation (in `latex-service/`)

### Documentation

See [`docs/BACKEND_README.md`](docs/BACKEND_README.md) for full backend architecture, database schema, pipeline stages, and API reference.
