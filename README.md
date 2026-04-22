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

### Backend (n8n Workflows)

The n8n workflows are hosted. The `backend/` directory contains:
- **Source code** for n8n Code nodes (version-controlled in `code_nodes/`)
- **AI prompts** for Gemini (in `prompts/`)
- **Workflow JSON** files for import into n8n (in `workflows/`)
- **LaTeX service** for PDF compilation (in `latex-service/`)

### Documentation

See [`docs/BACKEND_README.md`](docs/BACKEND_README.md) for full backend architecture, database schema, pipeline stages, and API reference.
