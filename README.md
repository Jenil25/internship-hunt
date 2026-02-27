# Internship Hunt Dashboard

A **Next.js 15** web dashboard for tracking job applications processed by the [n8n Internship Hunt workflow](../n8n-local/). View match scores, download tailored resumes, manage application statuses, and edit your candidate profile.

## Quick Start

```bash
npm install
npm run dev
# Dashboard: http://localhost:3000
```

### Prerequisites
- Node.js 18+
- The n8n backend running (PostgreSQL + n8n + LaTeX service via Docker)
- See [n8n-local/README.md](../n8n-local/README.md) for backend setup

### Environment Variables (`.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PG_HOST` | `localhost` | PostgreSQL host |
| `PG_PORT` | `5432` | PostgreSQL port |
| `PG_DATABASE` | `applai_db` | Database name |
| `PG_USER` | `applai_user` | Database user |
| `PG_PASSWORD` | `applai_random` | Database password |
| `NEXT_PUBLIC_N8N_WEBHOOK_URL` | `http://localhost:5678/webhook-test/add-job` | n8n webhook endpoint |
| `FILES_BASE_PATH` | `/Users/.../n8n-local/local_files` | Path to n8n's file storage |
| `LATEX_SERVICE_URL` | `http://localhost:3001` | LaTeX compilation service |

> **Note**: For production webhook, change `webhook-test` to `webhook` in the URL.

## Tech Stack

- **Framework**: Next.js 15 (App Router, server components)
- **Styling**: Vanilla CSS with CSS custom properties (dark theme)
- **Database**: PostgreSQL via `pg` library (direct queries, no ORM)
- **Runtime**: React 19

## Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `app/page.js` | **Dashboard** — stats cards (total jobs, avg score, top matches), score distribution chart |
| `/jobs` | `app/jobs/page.js` | **Jobs List** — sortable table of all jobs with score pills, match badges, status badges, version indicators |
| `/jobs/[id]` | `app/jobs/[id]/page.js` | **Job Detail** — full job view: match score bar, outreach message, cover letter, resume download, version navigation, status management, AI reasoning breakdown |
| `/upload` | `app/upload/page.js` | **Upload JD** — drag-and-drop PDF upload form, sends to n8n webhook for processing |
| `/profile` | `app/profile/page.js` | **Profile View** — read-only view of candidate profile (identity, experience, projects, skills, config) |
| `/profile/edit` | `app/profile/edit/page.js` | **Profile Edit** — tabbed editor for identity, experience, projects, skills, config (min_score, cover letter toggle) |
| `/resumes` | `app/resumes/page.js` | **Resumes** — grid of all generated resumes with download links |

## API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/resume/[id]` | GET | Download resume PDF or .tex for a job. Query param: `?format=pdf\|tex`. Auto-compiles PDF if missing. |
| `/api/profile` | GET | Fetch the user's profile from Postgres |
| `/api/profile` | PUT | Update profile_json (identity, experience, projects, skills, config) |
| `/api/jobs/[id]/status` | PUT | Update a job's application status |

## Components

| Component | File | Description |
|-----------|------|-------------|
| `StatusDropdown` | `app/components/StatusDropdown.js` | Client-side dropdown for changing job status (applied, interviewing, rejected, etc.). Calls `PUT /api/jobs/[id]/status`. |
| `CopyButton` | `app/components/CopyButton.js` | Copies text to clipboard with visual feedback. Used for outreach hooks and cover letters. |

## Database Layer (`lib/db.js`)

Server-side database access using connection pooling (`pg.Pool`).

### Functions

| Function | Returns | Description |
|----------|---------|-------------|
| `getJobs()` | `Job[]` | All jobs ordered by `created_at DESC` |
| `getJobById(id)` | `Job \| null` | Single job by ID |
| `getJobVersions(company, role, email)` | `Version[]` | All versions of a specific company+role (id, version, score, status, created_at) |
| `getStats()` | `Stats` | Aggregated statistics (total, avg score, high matches, status breakdown) |
| `getProfile(email, name)` | `Profile \| null` | User profile by email + profile name |
| `updateProfile(email, name, json)` | `Profile` | Update profile_json |
| `updateJobStatus(id, status)` | `Job` | Update job application status |

## Key Features

### Job Versioning
When the same JD is uploaded again, a new version is created (v2, v3, etc.) instead of failing with a duplicate error. The job detail page shows a **version badge** and **version selector links** when multiple versions exist.

### Status Tracking
Jobs can be marked with statuses: `scored`, `resume_generated`, `ineligible`, `applied`, `interviewing`, `accepted`, `rejected`, `no_response`, `pass`. The status dropdown is available on both the jobs list and detail pages.

### Cover Letter
If enabled in profile config, an AI-generated cover letter appears on the job detail page with a copy button. The toggle is in Profile → Edit → Config tab.

### Outreach Hook
Each scored job gets an AI-generated outreach message — a personalized hook for LinkedIn messages or cold emails, referencing the candidate's specific experience relevant to the company.

### Resume Download
Download tailored resumes as PDF (compiled via LaTeX) or raw `.tex` files. The API auto-compiles PDFs on demand if they don't exist.

## File Structure

```
internship-hunt-dashboard/
├── app/
│   ├── page.js                    # Dashboard home (stats)
│   ├── layout.js                  # Root layout with sidebar nav
│   ├── globals.css                # Full design system (dark theme, components)
│   ├── components/
│   │   ├── StatusDropdown.js      # Job status changer
│   │   └── CopyButton.js         # Clipboard copy with feedback
│   ├── jobs/
│   │   ├── page.js                # Jobs list table
│   │   └── [id]/page.js           # Job detail (score, resume, cover letter)
│   ├── upload/page.js             # JD upload form
│   ├── profile/
│   │   ├── page.js                # Profile viewer
│   │   └── edit/page.js           # Profile editor (tabbed)
│   ├── resumes/page.js            # Resume gallery
│   └── api/
│       ├── resume/[id]/route.js   # Resume file download
│       ├── profile/route.js       # Profile CRUD
│       └── jobs/[id]/status/route.js  # Status update
├── lib/
│   └── db.js                      # PostgreSQL connection pool + queries
├── .env.local                     # Environment config
└── package.json                   # Dependencies: next, react, pg
```

## Design System

The app uses a custom dark theme defined in `globals.css` with CSS custom properties:

- **Colors**: Dark backgrounds (`--bg-primary: #0f1117`), teal accents (`--primary: #4fd1c5`)
- **Components**: Cards, pills, badges, buttons, tables — all styled with glassmorphism and subtle gradients
- **Responsive**: Sidebar navigation, grid layouts for detail pages
- **Interactions**: Hover effects, status badge colors, smooth transitions

## Data Flow

```
User uploads JD on /upload
  → POST to n8n webhook (multipart/form-data)
  → n8n processes: parse → score → generate resume → save to Postgres
  → Dashboard reads from Postgres and displays results
  → User can: download resume, copy outreach hook, update status, view cover letter
```
