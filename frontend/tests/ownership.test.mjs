/**
 * Cross-account access tests for everything addressed by job id.
 *
 * Two real users are seeded in the local container, each owning a job with a
 * resume. Owner B then reaches for owner A's job by id on every route that
 * takes one. Every such attempt must return 404 — not 403, which would confirm
 * the id exists.
 *
 * Needs a dev server on TEST_BASE_URL. Run:
 *   npm run dev                      # in one shell
 *   npm test                         # in another
 *
 * These tests hit real HTTP with real session cookies rather than calling the
 * route handlers directly, because the thing under test is what an attacker
 * can actually reach over the wire.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';

// Seeding INSERTs and DELETEs. Same rule as scripts/seed-demo.js: never let
// this reach a hosted database, whatever env happens to be loaded.
const isLocal = /^(localhost|127\.0\.0\.1|::1|postgres-local)$/.test(process.env.PG_HOST || '');
if (!isLocal) {
  console.error(`refusing to run tests: PG_HOST is "${process.env.PG_HOST || '(unset)'}", not a local host.`);
  process.exit(1);
}

const A = { email: 'owner-a@ownership.test', password: 'test-password-a-1234', name: 'Owner A' };
const B = { email: 'intruder-b@ownership.test', password: 'test-password-b-1234', name: 'Intruder B' };

const pool = new Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
});
const q = (sql, params) => pool.query(sql, params).then(r => r.rows);

// Legacy /files/ path so the download reads from disk instead of needing S3.
const RESUME_REL = 'output/Resume_OwnershipTestCo.tex';
const FILES_BASE = process.env.FILES_BASE_PATH;

let jobA, jobB, cookieA, cookieB;

/** Full credentials login, returning the session cookie header. */
/**
 * Minimal cookie jar. Set-Cookie carries attributes (Path, HttpOnly, SameSite)
 * that must not go back in a Cookie header, and the dev server can emit the
 * same cookie name twice in one response — sending both makes NextAuth reject
 * the request as MissingCSRF. Keep bare name=value, last write wins.
 */
function updateJar(jar, res) {
  for (const raw of res.headers.getSetCookie()) {
    const [name, ...rest] = raw.split(';')[0].split('=');
    jar.set(name, rest.join('='));
  }
  return jar;
}
const jarHeader = jar => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

async function login({ email, password }) {
  const jar = new Map();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  updateJar(jar, csrfRes);

  // Derive the token from the cookie that actually survived deduping, so the
  // body token and the cookie token are guaranteed to be the same pair.
  const csrfToken = decodeURIComponent(jar.get('authjs.csrf-token') || '').split('|')[0];
  assert.ok(csrfToken, 'no csrf token issued');

  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: jarHeader(jar) },
    body: new URLSearchParams({ csrfToken, email, password, callbackUrl: `${BASE}/` }),
    redirect: 'manual',
  });
  updateJar(jar, res);

  const cookie = jarHeader(jar);
  assert.ok(cookie.includes('session-token'), `login failed for ${email} (${res.headers.get('location') || res.status})`);
  return cookie;
}

async function seedUser({ email, password, name }) {
  const hash = await bcrypt.hash(password, 10);
  await q('DELETE FROM users WHERE email = $1', [email]);
  await q('INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3)', [name, email, hash]);
  await q(
    `INSERT INTO profiles (user_email, profile_name, profile_json) VALUES ($1,'general',$2)
     ON CONFLICT (user_email, profile_name) DO UPDATE SET profile_json = $2`,
    [email, JSON.stringify({ identity: { name, email } })]
  );
  const [job] = await q(
    `INSERT INTO jobs (user_email, profile_name, source, company, role, score, match_level,
                       status, resume_file_path, version, created_at, updated_at)
     VALUES ($1,'general','test','OwnershipTestCo','Test Engineer',88,'STRONG_MATCH',
             'resume_generated',$2,1,NOW(),NOW())
     RETURNING id`,
    [email, `/files/${RESUME_REL}`]
  );
  return job.id;
}

before(async () => {
  // A real file on disk so the owner's download is a genuine 200, not a
  // missing-file 404 that would pass the test for the wrong reason.
  if (FILES_BASE) {
    for (const ext of ['tex', 'pdf']) {
      const p = path.join(FILES_BASE, RESUME_REL.replace(/\.tex$/, `.${ext}`));
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, ext === 'tex' ? '\\documentclass{article}\\begin{document}x\\end{document}' : '%PDF-1.4 test');
    }
  }
  jobA = await seedUser(A);
  jobB = await seedUser(B);
  cookieA = await login(A);
  cookieB = await login(B);
});

after(async () => {
  for (const { email } of [A, B]) {
    await q('DELETE FROM jobs WHERE user_email = $1', [email]);
    await q('DELETE FROM profiles WHERE user_email = $1', [email]);
    await q('DELETE FROM users WHERE email = $1', [email]);
  }
  await pool.end();
});

// ─── B reaching for A's job: every route must 404 ───

test("B cannot open A's job detail page", async () => {
  const res = await fetch(`${BASE}/jobs/${jobA}`, { headers: { cookie: cookieB } });
  assert.equal(res.status, 404, `expected 404, got ${res.status}`);
});

test("B cannot download A's resume PDF", async () => {
  const res = await fetch(`${BASE}/api/resume/${jobA}?format=pdf`, { headers: { cookie: cookieB } });
  assert.equal(res.status, 404, `expected 404, got ${res.status}`);
});

test("B cannot download A's resume .tex", async () => {
  const res = await fetch(`${BASE}/api/resume/${jobA}?format=tex`, { headers: { cookie: cookieB } });
  assert.equal(res.status, 404, `expected 404, got ${res.status}`);
});

test("B cannot overwrite A's resume source", async () => {
  const res = await fetch(`${BASE}/api/resume/${jobA}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieB },
    body: JSON.stringify({ texContent: '\\documentclass{article}\\begin{document}pwned\\end{document}' }),
  });
  assert.equal(res.status, 404, `expected 404, got ${res.status}`);
});

test("B cannot change the application state of A's job", async () => {
  const res = await fetch(`${BASE}/api/jobs/${jobA}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', cookie: cookieB },
    body: JSON.stringify({ application_state: 'rejected' }),
  });
  assert.equal(res.status, 404, `expected 404, got ${res.status}`);

  // The write must not have landed even if the response were misleading.
  const [row] = await q('SELECT application_state FROM jobs WHERE id = $1', [jobA]);
  assert.equal(row.application_state, 'none', "A's application state was modified by B");
});

test('an unauthenticated caller cannot change a job status', async () => {
  // redirect:'manual' so the middleware's 307 to /login is visible. Following
  // it would return the login page as a 200 and look like a successful write.
  const res = await fetch(`${BASE}/api/jobs/${jobA}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ application_state: 'rejected' }),
    redirect: 'manual',
  });
  assert.notEqual(res.status, 200, `unauthenticated write returned ${res.status}`);

  // The part that actually matters: no write landed.
  const [row] = await q('SELECT application_state FROM jobs WHERE id = $1', [jobA]);
  assert.equal(row.application_state, 'none', 'application state changed without a session');
});

test('status route rejects a field it does not own (mass assignment)', async () => {
  const res = await fetch(`${BASE}/api/jobs/${jobB}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', cookie: cookieB },
    body: JSON.stringify({
      application_state: 'applied',
      user_email: A.email,
      score: 1,
      pipeline_state: 'ineligible',
    }),
  });
  assert.equal(res.status, 200);

  // Only application_state may move; everything else on the body is ignored.
  const [row] = await q(
    'SELECT user_email, score, pipeline_state, application_state FROM jobs WHERE id = $1', [jobB]);
  assert.equal(row.user_email, B.email, 'job owner was reassigned via the request body');
  assert.equal(row.score, 88, 'score was writable via the request body');
  assert.equal(row.pipeline_state, 'scored', 'pipeline_state was writable via the request body');
  assert.equal(row.application_state, 'applied');
});

// ─── The owner is unaffected ───

test('A can open their own job detail page', async () => {
  const res = await fetch(`${BASE}/jobs/${jobA}`, { headers: { cookie: cookieA } });
  assert.equal(res.status, 200, `owner got ${res.status}`);
});

test('A can download their own resume', async () => {
  const res = await fetch(`${BASE}/api/resume/${jobA}?format=pdf`, { headers: { cookie: cookieA } });
  assert.equal(res.status, 200, `owner got ${res.status}`);
});

test('A can change the application state of their own job', async () => {
  const res = await fetch(`${BASE}/api/jobs/${jobA}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', cookie: cookieA },
    body: JSON.stringify({ application_state: 'interviewing' }),
  });
  assert.equal(res.status, 200, `owner got ${res.status}`);
  const [row] = await q('SELECT application_state, reviewed_at FROM jobs WHERE id = $1', [jobA]);
  assert.equal(row.application_state, 'interviewing');
  // Deciding on a job stamps reviewed_at, which is what drops it from the queue.
  assert.ok(row.reviewed_at, 'reviewed_at was not stamped');
});
