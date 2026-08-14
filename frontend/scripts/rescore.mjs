/**
 * Re-score existing jobs with the current scoring prompt and report the
 * resulting distribution. This is how we tell whether the rubric actually
 * discriminates, rather than trusting the prompt text.
 *
 *   GEMINI_API_KEY=... node --env-file=.env scripts/rescore.mjs            # dry run
 *   GEMINI_API_KEY=... node --env-file=.env scripts/rescore.mjs --write    # persist
 *   ... --limit 50                                                        # sample
 *
 * Dry run is the default: it prints the old and new distribution side by side
 * and writes nothing. --write updates score/match_level/reasoning/hook.
 *
 * Reads the rubric straight from backend/prompts/prompt_2_score_match.txt so
 * there is one source of truth. The n8n template placeholders in that file's
 * "# Inputs" section are replaced with real values here.
 */

import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.resolve(HERE, '../../backend/prompts/prompt_2_score_match.txt');

const WRITE = process.argv.includes('--write');
const LIMIT = Number(process.argv[process.argv.indexOf('--limit') + 1]) || null;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_KEY = process.env.GEMINI_API_KEY;
const CONCURRENCY = Number(process.env.RESCORE_CONCURRENCY) || 4;

// Same rule as seed-demo.js: this can UPDATE rows, so it must never be able to
// reach a hosted database whatever env happens to be loaded.
const isLocal = /^(localhost|127\.0\.0\.1|::1|postgres-local)$/.test(process.env.PG_HOST || '');
if (!isLocal) {
  console.error(`refusing to run: PG_HOST is "${process.env.PG_HOST || '(unset)'}", not a local host.`);
  process.exit(1);
}
if (!API_KEY) {
  console.error('GEMINI_API_KEY is not set — cannot re-score.\n' +
                '  GEMINI_API_KEY=... node --env-file=.env scripts/rescore.mjs');
  process.exit(1);
}

// Must match the TUNABLE block in prompt_2_score_match.txt.
const BANDS = [
  { name: '85-100  STRONG_MATCH  ', min: 85, max: 101, target: 10 },
  { name: '70-84   GOOD_MATCH    ', min: 70, max: 85, target: 25 },
  { name: '50-69   MODERATE_MATCH', min: 50, max: 70, target: 40 },
  { name: '0-49    WEAK_MATCH    ', min: 0, max: 50, target: 25 },
];

const pool = new Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
});
const q = (sql, params) => pool.query(sql, params).then(r => r.rows);

/** Rubric text minus the n8n-specific inputs section. */
function loadRubric() {
  const raw = fs.readFileSync(PROMPT_PATH, 'utf8');
  const cut = raw.indexOf('# Inputs');
  if (cut === -1) throw new Error('prompt file has no "# Inputs" section');
  return raw.slice(0, cut).replace(/-{3,}\s*$/, '').trimEnd();
}

function buildPrompt(rubric, profileJson, jdText) {
  return `${rubric}

---

# Inputs

**Candidate Profile:**
\`\`\`json
${JSON.stringify(profileJson)}
\`\`\`

**Job Description:**
\`\`\`
${jdText}
\`\`\`

# Analysis

[Provide your detailed analysis here following the output format above]
`;
}

async function score(prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
    }
  );
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('no text in gemini response');
  return JSON.parse(text);
}

function histogram(label, scores) {
  const n = scores.length;
  console.log(`\n${label}  (n=${n})`);
  for (const b of BANDS) {
    const c = scores.filter(s => s >= b.min && s < b.max).length;
    const pct = n ? (100 * c / n) : 0;
    const bar = '█'.repeat(Math.round(pct / 2));
    console.log(`  ${b.name}  ${String(c).padStart(4)}  ${pct.toFixed(1).padStart(5)}%  (target ~${b.target}%)  ${bar}`);
  }
  const avg = n ? scores.reduce((a, b) => a + b, 0) / n : 0;
  console.log(`  mean ${avg.toFixed(1)}   spread ${Math.min(...scores)}–${Math.max(...scores)}`);
}

/** Run `worker` over `items` with a bounded number in flight. */
async function mapLimit(items, limit, worker) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try {
        out[idx] = await worker(items[idx]);
      } catch (e) {
        out[idx] = { error: e.message };
      }
    }
  }));
  return out;
}

async function main() {
  const rubric = loadRubric();

  const jobs = await q(
    `SELECT j.id, j.company, j.role, j.score AS old_score, j.job_description, p.profile_json
     FROM jobs j
     JOIN profiles p ON p.user_email = j.user_email AND p.profile_name = j.profile_name
     WHERE j.job_description IS NOT NULL AND length(j.job_description) > 200
     ORDER BY j.created_at DESC
     ${LIMIT ? `LIMIT ${LIMIT}` : ''}`
  );

  if (!jobs.length) {
    console.error('no jobs with a usable job_description — nothing to re-score.');
    process.exit(1);
  }
  console.log(`re-scoring ${jobs.length} jobs with ${MODEL}${WRITE ? ' (WRITING)' : ' (dry run)'}\n`);

  let done = 0;
  const results = await mapLimit(jobs, CONCURRENCY, async (job) => {
    const r = await score(buildPrompt(rubric, job.profile_json, job.job_description));
    process.stdout.write(`\r  ${++done}/${jobs.length}`);
    return { job, ...r };
  });
  console.log('\n');

  const ok = results.filter(r => r && !r.error && typeof r.match_score === 'number');
  const failed = results.filter(r => !r || r.error || typeof r.match_score !== 'number');
  if (failed.length) console.log(`${failed.length} failed: ${[...new Set(failed.map(f => f?.error))].join(', ')}`);

  histogram('BEFORE (stored scores)', jobs.map(j => j.old_score).filter(s => s != null));
  histogram('AFTER  (new rubric)   ', ok.map(r => r.match_score));

  console.log('\nbiggest movers:');
  for (const r of [...ok].sort((a, b) => (a.match_score - a.job.old_score) - (b.match_score - b.job.old_score)).slice(0, 10)) {
    console.log(`  ${String(r.job.old_score).padStart(3)} → ${String(r.match_score).padStart(3)}  ${r.job.company} — ${r.job.role}`.slice(0, 110));
  }

  if (WRITE) {
    for (const r of ok) {
      await q(
        `UPDATE jobs SET score = $1, match_level = $2, reasoning = $3::jsonb, hook = $4, updated_at = NOW()
         WHERE id = $5`,
        [r.match_score, r.match_level, JSON.stringify(r.reasoning ?? {}), r.application_hook ?? null, r.job.id]
      );
    }
    console.log(`\nwrote ${ok.length} rows`);
  } else {
    console.log('\ndry run — nothing written. re-run with --write to persist.');
  }
}

main()
  .catch(e => { console.error(`rescore failed: ${e.message}`); process.exitCode = 1; })
  .finally(() => pool.end());
