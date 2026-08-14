/**
 * Seeds the public demo account. Idempotent — safe to re-run.
 *
 *   node --env-file=.env scripts/seed-demo.js
 *
 * Point --env-file at whichever DB you want seeded (local or prod).
 * Credentials are duplicated in app/login/page.js — keep them in sync.
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const DEMO_EMAIL = 'demo@applai.dev';
const DEMO_PASSWORD = 'demo1234';
const DEMO_NAME = 'Alex Demo';

const isLocal = /^(localhost|127\.0\.0\.1|::1|postgres-local)$/.test(process.env.PG_HOST || '');

// This script DELETEs and reinserts rows. It must never be able to reach a
// hosted database, however it is invoked (--env-file=.env.production, a stray
// PG_HOST export, a copied .env). There is deliberately no override flag:
// seeding a remote DB is never the intent, so refuse rather than offer an escape.
if (!isLocal) {
  console.error(
    `refusing to seed: PG_HOST is "${process.env.PG_HOST || '(unset)'}", which is not a local host.\n` +
    `  seed-demo.js only runs against localhost / 127.0.0.1 / ::1 / postgres-local.\n` +
    `  start the container and retry:  docker start postgres-local`
  );
  process.exit(1);
}

const pool = new Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  // Supabase (and most managed Postgres) require TLS; local docker doesn't offer it.
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

const PROFILE = {
  identity: { name: DEMO_NAME, email: DEMO_EMAIL },
  profile: {
    name: DEMO_NAME,
    contact: {
      email: DEMO_EMAIL,
      phone: '(555) 010-0100',
      location: 'Boston, MA',
      linkedin: 'linkedin.com/in/alexdemo',
      github: 'github.com/alexdemo',
    },
    education: [
      {
        institution: 'Northeastern University',
        degree: 'MS in Computer Science',
        grad_date: 'May 2026',
        gpa: '3.9',
      },
      {
        institution: 'University of Pune',
        degree: 'BE in Information Technology',
        grad_date: 'May 2023',
        gpa: '3.7',
      },
    ],
    skills: {
      languages: ['Python', 'JavaScript', 'TypeScript', 'Java', 'SQL', 'Go'],
      frameworks: ['React', 'Next.js', 'Node.js', 'FastAPI', 'Django', 'PyTorch'],
      tools: ['Docker', 'Kubernetes', 'AWS', 'PostgreSQL', 'Redis', 'Terraform', 'Git'],
    },
  },
  experience: [
    {
      company: 'Cloudpine Systems',
      role: 'Software Engineer Intern',
      dates: 'Jun 2025 – Aug 2025',
      tech_stack: ['Go', 'Kubernetes', 'PostgreSQL', 'gRPC'],
      bullet_points_pool: [
        'Built a gRPC ingestion service in Go handling 40K events/sec, cutting p99 latency from 380ms to 95ms',
        'Migrated 14 batch jobs to a Kubernetes CronJob pipeline, reducing nightly runtime by 62%',
        'Added partial indexes and query rewrites to a 300M-row Postgres table, dropping report times from 45s to 3s',
        'Wrote integration tests raising service coverage from 41% to 84% and caught 3 pre-release regressions',
      ],
    },
    {
      company: 'Meridian Analytics',
      role: 'Full Stack Developer',
      dates: 'Jul 2023 – Aug 2024',
      tech_stack: ['React', 'Node.js', 'AWS', 'Redis'],
      bullet_points_pool: [
        'Shipped a React dashboard used by 1,200 daily users, replacing a legacy jQuery app',
        'Cut API response times 70% by introducing Redis caching and cursor-based pagination',
        'Designed a role-based access layer in Node.js covering 6 permission tiers across 40+ endpoints',
        'Automated deploys with GitHub Actions and Terraform, taking releases from weekly to daily',
      ],
    },
    {
      company: 'Northeastern University',
      role: 'Graduate Teaching Assistant',
      dates: 'Sep 2024 – Present',
      tech_stack: ['Python', 'Algorithms'],
      bullet_points_pool: [
        'Led weekly labs on algorithms and data structures for 60 graduate students',
        'Built an autograder in Python that cut assignment turnaround from 5 days to 8 hours',
      ],
    },
  ],
  projects: [
    {
      project_name: 'ApplAI — Resume Tailoring Pipeline',
      role: 'Creator',
      dates: '2025',
      summary_sentence: 'AI pipeline that scores job descriptions against a candidate profile and generates ATS-optimized LaTeX resumes.',
      tech_stack: ['Next.js', 'n8n', 'Gemini', 'PostgreSQL', 'pgvector', 'S3'],
      github_links: ['github.com/alexdemo/applai'],
      live_url: '',
      bullet_points_pool: [
        'Orchestrated a 6-stage n8n workflow: JD parsing, visa eligibility check, Gemini scoring, resume generation, LaTeX compilation, and persistence',
        'Stored 500+ scored postings in Postgres with pgvector embeddings for similarity search',
        'Reduced per-application tailoring time from 40 minutes to under 2 minutes',
      ],
    },
    {
      project_name: 'Shardwatch — Distributed KV Store',
      role: 'Creator',
      dates: '2024',
      summary_sentence: 'Raft-backed sharded key-value store with automatic rebalancing.',
      tech_stack: ['Go', 'Raft', 'Docker'],
      github_links: ['github.com/alexdemo/shardwatch'],
      live_url: '',
      bullet_points_pool: [
        'Implemented Raft leader election and log replication across a 5-node cluster',
        'Sustained 12K writes/sec with linearizable reads under simulated node failures',
      ],
    },
    {
      project_name: 'TransitPulse',
      role: 'Creator',
      dates: '2024',
      summary_sentence: 'Real-time transit delay predictor trained on 3 years of MBTA data.',
      tech_stack: ['Python', 'PyTorch', 'FastAPI', 'React'],
      github_links: ['github.com/alexdemo/transitpulse'],
      live_url: '',
      bullet_points_pool: [
        'Trained an LSTM delay predictor reaching 87% accuracy within a 3-minute window',
        'Served predictions through a FastAPI endpoint averaging 40ms response time',
      ],
    },
  ],
  skills: {
    languages: ['Python', 'JavaScript', 'TypeScript', 'Java', 'SQL', 'Go'],
    frameworks: ['React', 'Next.js', 'Node.js', 'FastAPI', 'Django', 'PyTorch'],
    tools: ['Docker', 'Kubernetes', 'AWS', 'PostgreSQL', 'Redis', 'Terraform', 'Git'],
  },
  config: { min_score: 65, generate_cover_letter: false },
};

// daysAgo → created_at, so the demo dashboard always looks recently active.
// reasoning matches the jsonb shape app/jobs/[id]/page.js renders: strengths / gaps / key_alignments.
const JOBS = [
  {
    company: 'Stripe', role: 'Software Engineer Intern, Payments', location: 'Seattle, WA',
    score: 91, match_level: 'STRONG_MATCH', status: 'interviewing', daysAgo: 2, resume: true,
    hook: 'Go + gRPC payment ingestion work at Cloudpine maps directly onto Stripe\'s ledger services.',
    reasoning: {
      strengths: [
        'Production Go experience on a 40K events/sec gRPC service directly matches the payments infrastructure stack.',
        'Raft implementation in Shardwatch demonstrates the consistency and correctness instincts payments work demands.',
        'Postgres tuning on a 300M-row table shows comfort operating at Stripe\'s data scale.',
      ],
      gaps: [
        'No prior fintech or payments domain experience.',
        'Ledger and double-entry accounting concepts are not evidenced anywhere on the profile.',
      ],
      key_alignments: [
        'Go and gRPC are both listed as core requirements and both appear in production experience.',
        'May 2026 graduation lines up with the summer 2026 intern cohort.',
        'Distributed systems depth matches the reliability bar for the team.',
      ],
    },
  },
  {
    company: 'Databricks', role: 'Software Engineer Intern, Compute', location: 'San Francisco, CA',
    score: 88, match_level: 'STRONG_MATCH', status: 'applied', daysAgo: 4, resume: true,
    hook: 'Kubernetes CronJob migration and Raft implementation cover the distributed compute requirements.',
    reasoning: {
      strengths: [
        'Migrated 14 batch jobs to Kubernetes CronJobs, cutting runtime 62% — direct compute-platform experience.',
        'Go and container orchestration are both first-class on the profile.',
        'Raft-based KV store shows the systems depth the compute team screens for.',
      ],
      gaps: [
        'No Scala or Spark exposure, which the job description lists as strongly preferred.',
        'No experience with JVM performance tuning.',
      ],
      key_alignments: [
        'Kubernetes appears in both the requirements and the candidate\'s production work.',
        'Distributed consensus experience maps to cluster coordination work.',
      ],
    },
  },
  {
    company: 'Ramp', role: 'Software Engineer Intern', location: 'New York, NY',
    score: 84, match_level: 'GOOD_MATCH', status: 'interviewing', daysAgo: 6, resume: true,
    hook: 'Full-stack React + Node work at Meridian matches Ramp\'s product engineering bar.',
    reasoning: {
      strengths: [
        'Shipped a React dashboard to 1,200 daily users, replacing a legacy app end to end.',
        'Designed an RBAC layer across 40+ endpoints, showing ownership beyond feature work.',
        'Cut API latency 70% with caching and pagination — measurable product impact.',
      ],
      gaps: [
        'Fintech and expense-management domain context is new.',
        'No exposure to accounting integrations or bank APIs.',
      ],
      key_alignments: [
        'TypeScript and React are core requirements and core strengths.',
        'Ramp weights shipping velocity heavily; the weekly-to-daily release automation demonstrates it.',
      ],
    },
  },
  {
    company: 'Anthropic', role: 'Software Engineer Intern, Inference', location: 'San Francisco, CA',
    score: 79, match_level: 'GOOD_MATCH', status: 'applied', daysAgo: 8, resume: true,
    hook: 'PyTorch LSTM serving plus a 40K events/sec Go service covers ML infra fundamentals.',
    reasoning: {
      strengths: [
        'Trained and served a PyTorch model behind a 40ms FastAPI endpoint — real ML serving experience.',
        'Strong Python plus high-throughput backend work covers the inference infrastructure basics.',
      ],
      gaps: [
        'No large-scale GPU cluster or CUDA kernel work, which is weighted heavily for this team.',
        'No experience with model parallelism or quantization.',
      ],
      key_alignments: [
        'Python and PyTorch are both explicit requirements.',
        'Latency-focused optimization work matches what inference serving optimizes for.',
      ],
    },
  },
  {
    company: 'Datadog', role: 'Software Engineer Intern, Metrics', location: 'Boston, MA',
    score: 82, match_level: 'GOOD_MATCH', status: 'resume_generated', daysAgo: 1, resume: true,
    hook: 'High-throughput ingestion and Postgres index tuning are exactly the metrics-pipeline skill set.',
    reasoning: {
      strengths: [
        'High-throughput event ingestion experience transfers directly to time-series metrics pipelines.',
        'Query optimization work — 45s to 3s on a 300M-row table — matches the read path of a metrics store.',
        'Go and Kubernetes are both listed requirements and both present in production work.',
      ],
      gaps: [
        'No direct experience with time-series databases or cardinality management.',
      ],
      key_alignments: [
        'Boston-based candidate for a Boston office.',
        'Observability and p99 latency work is already part of the candidate\'s vocabulary.',
      ],
    },
  },
  {
    company: 'Figma', role: 'Software Engineer Intern, Product', location: 'New York, NY',
    score: 76, match_level: 'GOOD_MATCH', status: 'scored', daysAgo: 1, resume: false,
    hook: 'React dashboard rebuild for 1,200 daily users shows product-surface ownership.',
    reasoning: {
      strengths: [
        'Deep React experience on a real product surface with measurable adoption.',
        'Comfortable owning a feature from design through deployment.',
      ],
      gaps: [
        'Role emphasizes canvas rendering and WebGL, neither of which appears on the profile.',
        'No graphics or geometry background.',
        'No C++ for the rendering-adjacent portions of the stack.',
      ],
      key_alignments: [
        'TypeScript and React match the product engineering requirements.',
      ],
    },
  },
  {
    company: 'Snowflake', role: 'Software Engineer Intern, Query Engine', location: 'Bellevue, WA',
    score: 71, match_level: 'PARTIAL_MATCH', status: 'no_response', daysAgo: 21, resume: false,
    hook: 'Postgres query rewriting cut a report from 45s to 3s — query planning instinct is there.',
    reasoning: {
      strengths: [
        'Demonstrated query optimization results through index design and query rewriting.',
        'Strong SQL and relational database fundamentals.',
      ],
      gaps: [
        'Role requires C++, which is absent from the profile — this is the primary blocker.',
        'No compiler, parser, or query-planner internals experience.',
      ],
      key_alignments: [
        'SQL depth is a genuine match for the domain, even if the implementation language is not.',
      ],
    },
  },
  {
    company: 'Airbnb', role: 'Software Engineer Intern', location: 'San Francisco, CA',
    score: 80, match_level: 'GOOD_MATCH', status: 'rejected', daysAgo: 27, resume: true,
    hook: 'Full-stack React/Node plus AWS deploy automation lines up with the platform teams.',
    reasoning: {
      strengths: [
        'Broad full-stack coverage across React, Node, and AWS.',
        'Terraform and GitHub Actions automation matches the platform tooling.',
      ],
      gaps: [
        'No Ruby or Rails, which still backs a large share of the codebase.',
        'No experience with service-oriented migrations at Airbnb\'s scale.',
      ],
      key_alignments: [
        'Deployment automation experience maps to the developer-productivity org.',
      ],
    },
  },
  {
    company: 'Coinbase', role: 'Backend Engineer Intern', location: 'Remote, US',
    score: 68, match_level: 'PARTIAL_MATCH', status: 'pass', daysAgo: 18, resume: false,
    hook: 'Go services and Raft consensus overlap with blockchain node work.',
    reasoning: {
      strengths: [
        'Go plus distributed consensus experience overlaps conceptually with blockchain node operation.',
      ],
      gaps: [
        'No crypto, blockchain, or protocol-level experience, which the posting treats as required.',
        'No cryptography or key-management background.',
      ],
      key_alignments: [
        'Backend service design and Postgres are transferable, but score falls below the 70 threshold for tailoring effort.',
      ],
    },
  },
  {
    company: 'Palantir', role: 'Software Engineer Intern', location: 'Palo Alto, CA',
    score: 0, match_level: 'INELIGIBLE', status: 'ineligible', daysAgo: 12, resume: false,
    hook: '',
    reasoning: {
      strengths: [],
      gaps: [
        'Posting requires US citizenship or permanent residency for government-adjacent work.',
        'Candidate is on F-1 status, so the role is filtered before scoring runs.',
      ],
      key_alignments: [],
    },
  },
  {
    company: 'Vercel', role: 'Software Engineer Intern, Platform', location: 'Remote, US',
    score: 86, match_level: 'STRONG_MATCH', status: 'accepted', daysAgo: 34, resume: true,
    hook: 'Next.js project experience plus Kubernetes and Terraform is a direct platform-team match.',
    reasoning: {
      strengths: [
        'Next.js is used daily on the ApplAI project, including App Router and server components.',
        'Kubernetes and Terraform experience maps directly to the build platform team.',
        'Shipped a full CI/CD pipeline, which is the product Vercel sells.',
      ],
      gaps: [
        'No Rust, which parts of the build infrastructure are migrating toward.',
      ],
      key_alignments: [
        'Candidate is an active user of the platform they would be building.',
        'Remote-friendly role matches candidate availability.',
      ],
    },
  },
];

const DEMO_TEX = (name, company, role) => `\\documentclass[letterpaper,11pt]{article}
\\usepackage[margin=0.6in]{geometry}
\\usepackage{enumitem}
\\pagenumbering{gobble}
\\begin{document}
\\begin{center}
{\\LARGE \\textbf{${name}}}\\\\[2pt]
Boston, MA $\\cdot$ ${DEMO_EMAIL} $\\cdot$ github.com/alexdemo
\\end{center}
\\vspace{4pt}
\\hrule
\\vspace{6pt}
\\noindent\\textbf{Tailored for: ${role} @ ${company}}
\\vspace{6pt}

\\noindent\\textbf{\\large Experience}\\\\[2pt]
\\hrule
\\vspace{4pt}
\\noindent\\textbf{Cloudpine Systems} \\hfill Jun 2025 -- Aug 2025\\\\
\\textit{Software Engineer Intern}
\\begin{itemize}[leftmargin=*,itemsep=1pt,topsep=2pt]
\\item Built a gRPC ingestion service in Go handling 40K events/sec, cutting p99 latency from 380ms to 95ms
\\item Migrated 14 batch jobs to a Kubernetes CronJob pipeline, reducing nightly runtime by 62\\%
\\item Added partial indexes and query rewrites to a 300M-row Postgres table, dropping report times from 45s to 3s
\\end{itemize}
\\vspace{4pt}
\\noindent\\textbf{Meridian Analytics} \\hfill Jul 2023 -- Aug 2024\\\\
\\textit{Full Stack Developer}
\\begin{itemize}[leftmargin=*,itemsep=1pt,topsep=2pt]
\\item Shipped a React dashboard used by 1,200 daily users, replacing a legacy jQuery app
\\item Cut API response times 70\\% by introducing Redis caching and cursor-based pagination
\\item Automated deploys with GitHub Actions and Terraform, taking releases from weekly to daily
\\end{itemize}
\\vspace{6pt}

\\noindent\\textbf{\\large Projects}\\\\[2pt]
\\hrule
\\vspace{4pt}
\\noindent\\textbf{ApplAI --- Resume Tailoring Pipeline} \\hfill Next.js, n8n, Gemini, PostgreSQL
\\begin{itemize}[leftmargin=*,itemsep=1pt,topsep=2pt]
\\item Orchestrated a 6-stage workflow from JD parsing through LaTeX compilation and persistence
\\item Reduced per-application tailoring time from 40 minutes to under 2 minutes
\\end{itemize}
\\vspace{4pt}
\\noindent\\textbf{Shardwatch --- Distributed KV Store} \\hfill Go, Raft, Docker
\\begin{itemize}[leftmargin=*,itemsep=1pt,topsep=2pt]
\\item Implemented Raft leader election and log replication across a 5-node cluster
\\item Sustained 12K writes/sec with linearizable reads under simulated node failures
\\end{itemize}
\\vspace{6pt}

\\noindent\\textbf{\\large Education}\\\\[2pt]
\\hrule
\\vspace{4pt}
\\noindent\\textbf{Northeastern University} --- MS Computer Science, GPA 3.9 \\hfill May 2026\\\\
\\noindent\\textbf{University of Pune} --- BE Information Technology, GPA 3.7 \\hfill May 2023
\\vspace{6pt}

\\noindent\\textbf{\\large Skills}\\\\[2pt]
\\hrule
\\vspace{4pt}
\\noindent\\textbf{Languages:} Python, JavaScript, TypeScript, Java, SQL, Go\\\\
\\noindent\\textbf{Frameworks:} React, Next.js, Node.js, FastAPI, Django, PyTorch\\\\
\\noindent\\textbf{Tools:} Docker, Kubernetes, AWS, PostgreSQL, Redis, Terraform, Git
\\end{document}
`;

const JD_TEXT = (company, role, location) =>
  `${role} at ${company} — ${location}\n\n` +
  `About the role:\n${company} is hiring a ${role} to build and scale services used by millions. ` +
  `You will own features end to end, from design through deployment and on-call.\n\n` +
  `What you'll do:\n` +
  `- Design, build, and ship backend and full-stack services in production\n` +
  `- Partner with product and design to turn ambiguous problems into shipped features\n` +
  `- Improve reliability, latency, and observability of systems you own\n` +
  `- Write tests and participate in code review\n\n` +
  `Requirements:\n` +
  `- Pursuing a BS/MS in Computer Science or equivalent experience\n` +
  `- Proficiency in at least one of Go, Python, Java, or TypeScript\n` +
  `- Experience with relational databases and distributed systems fundamentals\n` +
  `- Familiarity with containers and CI/CD\n\n` +
  `Nice to have:\n` +
  `- Prior internship or open-source contributions\n` +
  `- Experience with Kubernetes, Terraform, or cloud infrastructure\n\n` +
  `(Sample job description — seeded for the ApplAI public demo.)`;

const s3 = process.env.AWS_S3_BUCKET
  ? new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    })
  : null;

async function putS3(key, body, contentType) {
  if (!s3) return false;
  await s3.send(new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
  return true;
}

/** Compiles tex -> pdf via the LaTeX microservice. Throws if the service is unreachable. */
async function compilePdf(texContent, filename) {
  const url = process.env.LATEX_SERVICE_URL || 'http://localhost:3001';
  const res = await fetch(`${url}/compile-binary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tex_content: texContent, filename }),
  });
  if (!res.ok) throw new Error(`latex service returned ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const q = (sql, params) => pool.query(sql, params).then(r => r.rows);

  // 1. User — re-running resets the password to a known value.
  // Select-then-write rather than ON CONFLICT: users.email may not carry a unique index.
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const existing = await q('SELECT id FROM users WHERE email = $1', [DEMO_EMAIL]);
  if (existing.length) {
    await q('UPDATE users SET name = $1, password_hash = $2 WHERE email = $3', [DEMO_NAME, hash, DEMO_EMAIL]);
  } else {
    await q('INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)', [DEMO_NAME, DEMO_EMAIL, hash]);
  }
  console.log(`user      ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);

  // 2. Profile — overwrite on re-run so visitor edits get reset.
  await q(
    `INSERT INTO profiles (user_email, profile_name, profile_json)
     VALUES ($1, 'general', $2)
     ON CONFLICT (user_email, profile_name) DO UPDATE SET profile_json = $2, updated_at = NOW()`,
    [DEMO_EMAIL, JSON.stringify(PROFILE)]
  );
  console.log('profile   general');

  // No master-template upload needed: /api/template/download serves lib/defaultTemplate.js directly.

  // 3. Jobs — wipe and reinsert so re-running resets any drag-and-drop the visitors did.
  await q('DELETE FROM jobs WHERE user_email = $1', [DEMO_EMAIL]);

  const bucket = process.env.AWS_S3_BUCKET;
  let latexUp = true;

  for (const j of JOBS) {
    const clean = j.company.replace(/[^a-zA-Z0-9]/g, '');
    const texKey = `resumes/${DEMO_EMAIL}/${clean}/v1/Resume_${clean}.tex`;
    let resumePath = null;

    if (j.resume && bucket) {
      const tex = DEMO_TEX(DEMO_NAME, j.company, j.role);
      try {
        await putS3(texKey, tex, 'application/x-tex');
        resumePath = `s3://${bucket}/${texKey}`;

        if (latexUp) {
          try {
            const pdf = await compilePdf(tex, `Resume_${clean}`);
            await putS3(texKey.replace('.tex', '.pdf'), pdf, 'application/pdf');
          } catch (e) {
            // One failure means the service is down; stop retrying for the rest.
            latexUp = false;
            console.warn(`pdf       LaTeX service unavailable (${e.message}) — .tex only, recompile from the resume editor`);
          }
        }
      } catch (e) {
        console.warn(`resume    ${j.company}: S3 upload failed (${e.message})`);
      }
    }

    await q(
      `INSERT INTO jobs
        (user_email, profile_name, company, role, location, source, source_url, job_description,
         score, match_level, hook, reasoning, status, resume_file_path, version, created_at, updated_at)
       VALUES ($1,'general',$2,$3,$4,'demo','', $5, $6,$7,$8,$9::jsonb,$10,$11, 1,
               NOW() - make_interval(days => $12), NOW() - make_interval(days => $12))`,
      [
        DEMO_EMAIL, j.company, j.role, j.location,
        JD_TEXT(j.company, j.role, j.location),
        j.score, j.match_level, j.hook, JSON.stringify(j.reasoning), j.status, resumePath,
        j.daysAgo,
      ]
    );
  }
  console.log(`jobs      ${JOBS.length} inserted`);

  // Self-check: the dashboard, kanban, and resumes pages all need to be non-empty.
  const [stats] = await q(
    `SELECT COUNT(*)::int AS total,
            COUNT(DISTINCT status)::int AS statuses,
            COUNT(resume_file_path)::int AS resumes
     FROM jobs WHERE user_email = $1`,
    [DEMO_EMAIL]
  );
  if (stats.total !== JOBS.length) throw new Error(`expected ${JOBS.length} jobs, found ${stats.total}`);
  if (stats.statuses < 5) throw new Error(`kanban needs jobs across >=5 statuses, found ${stats.statuses}`);
  if (bucket && stats.resumes === 0) throw new Error('no resume paths set — resumes page would be empty');
  if (!(await q('SELECT 1 FROM profiles WHERE user_email = $1', [DEMO_EMAIL])).length) {
    throw new Error('profile row missing');
  }
  console.log(`\nok        ${stats.total} jobs, ${stats.statuses} statuses, ${stats.resumes} resumes`);
}

main()
  .catch(e => {
    // AggregateError from pg-pool has an empty .message; the useful code is on .code.
    console.error(`seed failed: ${e.message || e.code || e}`);
    if (e.code === 'ECONNREFUSED') {
      console.error(`  cannot reach postgres at ${process.env.PG_HOST}:${process.env.PG_PORT} — is it running?`);
    }
    process.exitCode = 1;
  })
  .finally(() => pool.end());
