# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

AI-powered job application pipeline: upload a job description, Gemini AI scores it against your profile, generates a tailored ATS-optimized LaTeX resume, compiles to PDF. The Next.js dashboard lets you track scores, download resumes, manage statuses, and edit your candidate profile.

## Commands

```bash
# Frontend (from frontend/)
npm run dev          # Dev server at http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint (flat config, eslint.config.mjs)

# Backend LaTeX service (from backend/latex-service/)
pip install -r requirements.txt
python server.py     # Flask server on port 3001
```

There are no tests in this project currently.

## Architecture

**Frontend** (`frontend/`): Next.js 15 App Router with React 19 server components. Vanilla CSS dark theme (no CSS framework). Direct PostgreSQL queries via `pg` library — no ORM.

**Backend** (`backend/`): n8n workflows hosted externally (not run locally). This directory is version-controlled source code for n8n Code nodes, Gemini AI prompts, workflow JSON exports, and the LaTeX compilation microservice.

**Data flow**: User uploads JD on `/upload` -> POST to n8n webhook -> n8n pipeline (parse JD -> visa check -> Gemini score -> Gemini resume generation -> LaTeX compile -> save to Postgres) -> Dashboard reads from Postgres.

### Key connections
- Frontend talks to the n8n backend via a webhook URL (`NEXT_PUBLIC_N8N_WEBHOOK_URL`)
- Frontend reads job/profile data directly from the same PostgreSQL database that n8n writes to
- Resumes are stored in S3 (`lib/s3.js`) — the `resume_file_path` column holds either S3 URIs or legacy `/files/output/` paths
- LaTeX service (`backend/latex-service/server.py`) compiles `.tex` to PDF via `pdflatex`; the frontend API route `/api/resume/[id]` can trigger on-demand compilation

## Auth Architecture (Split Runtime)

NextAuth v5 with credentials provider (email/password, bcrypt). Auth config is split across two files to handle Next.js edge vs node runtime constraints:

- `lib/auth.config.js` — Edge-safe config (pages, callbacks, session strategy). **No database imports.** Used by `middleware.js`.
- `lib/auth.js` — Full server-only config. Extends `auth.config.js` with the Credentials provider that queries the `users` table. Used by server components and API routes.

The middleware runs on every non-static request and redirects unauthenticated users to `/login`. Public routes: `/login`, `/signup`, `/api/auth`.

## Database

PostgreSQL with pgvector extension. Two main tables:

- `jobs` — unique constraint on `(user_email, company, role, version)` for resume versioning
- `profiles` — unique constraint on `(user_email, profile_name)`, contains `profile_json` JSONB with nested identity/experience/projects/skills/config

All queries are in `frontend/lib/db.js` as parameterized SQL. Functions are scoped by `userEmail` from the session.

## Frontend Patterns

- All pages are server components; client components are explicitly marked (`StatusDropdown`, `CopyButton`, `LogoutButton`, `MobileNav`, `AuthProvider`, `ExportProfile`)
- API routes live in `frontend/app/api/` — resume download, profile CRUD, job status update, auth, template management
- The LaTeX resume template is stored as a JS string in `lib/defaultTemplate.js` with placeholder sections (`__EXPERIENCE_SECTION__`, `__PROJECTS_SECTION__`, `__SKILLS_SECTION__`)
- Layout (`app/layout.js`) conditionally renders sidebar navigation only when authenticated

## Backend Patterns

- `backend/code_nodes/` — JavaScript snippets that run inside n8n Code nodes (not standalone scripts)
- `backend/prompts/` — Gemini prompt templates for the 4 pipeline stages (parse, score, resume, cover letter)
- `backend/workflows/` — n8n workflow JSON exports for import
- `backend/templates/` — LaTeX master template file
- `backend/seed/` — Reference candidate profile data

## Environment Variables

Frontend requires `.env.local` with: `PG_HOST`, `PG_PORT`, `PG_DATABASE`, `PG_USER`, `PG_PASSWORD`, `NEXT_PUBLIC_N8N_WEBHOOK_URL`, `LATEX_SERVICE_URL`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `NEXTAUTH_SECRET`.
