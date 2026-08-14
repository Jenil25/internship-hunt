/**
 * Tailored resume generation, run on demand.
 *
 * This used to happen in n8n at scrape time for every job above a score
 * threshold: 364 resumes generated to send 32 applications. It now runs when
 * the user actually decides to apply, so the Gemini call and the LaTeX compile
 * are spent only on applications that happen.
 *
 * The prompt is read from backend/prompts/prompt_3_generate_resume.txt so the
 * n8n workflow and this path cannot drift apart.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Relative rather than the `@/` alias: the alias is resolved by Next's bundler,
// so `node --test` cannot load this module through it.
import { getS3Object, uploadToS3, BUCKET } from './s3.js';
import { defaultTemplate } from './defaultTemplate.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROMPT_PATH = path.resolve(HERE, '../../backend/prompts/prompt_3_generate_resume.txt');

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const LATEX_URL = process.env.LATEX_SERVICE_URL || 'http://localhost:3001';
const FILES_BASE = process.env.FILES_BASE_PATH || './local_files';

/** Company name as a filesystem/S3-safe segment. Matches the n8n convention. */
export function cleanCompany(company) {
  return (company || 'general').replace(/[^a-zA-Z0-9]/g, '') || 'general';
}

/**
 * Fill the n8n template expressions with real values.
 *
 * Throws if any `{{ ... }}` survives: a new placeholder added to the prompt
 * would otherwise be sent to Gemini as literal n8n syntax, which produces a
 * confidently wrong resume rather than an error.
 */
export function buildPrompt({ template, jdText, profileJson, reasoning }) {
  const raw = fs.readFileSync(PROMPT_PATH, 'utf8');
  const filled = raw
    .replace(/\{\{\s*\$\('Extract Template Text'\)[^}]*\}\}/g, () => template)
    .replace(/\{\{\s*\$\('Normalize Job Data'\)[^}]*\}\}/g, () => jdText || '')
    .replace(/\{\{\s*\$\('Fetch Profile'\)[^}]*\}\}/g, () => JSON.stringify(profileJson ?? {}))
    .replace(/\{\{\s*\$\('Parse Score'\)[^}]*\}\}/g, () => JSON.stringify(reasoning ?? {}));

  const leftover = filled.match(/\{\{[^}]*\}\}/);
  if (leftover) {
    throw new Error(`unfilled placeholder in resume prompt: ${leftover[0].slice(0, 80)}`);
  }
  return filled;
}

/** The user's master template from S3, falling back to the bundled default. */
async function loadTemplate(userEmail) {
  if (!BUCKET) return defaultTemplate;
  try {
    const { stream } = await getS3Object(`templates/${userEmail}/master_resume.tex`);
    return await streamToString(stream);
  } catch {
    // No per-user template uploaded yet, or S3 unreachable.
    return defaultTemplate;
  }
}

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

/** Gemini sometimes wraps LaTeX in a markdown fence despite instructions. */
function stripFence(text) {
  const fenced = text.match(/```(?:latex|tex)?\s*\n([\s\S]*?)```/);
  return (fenced ? fenced[1] : text).trim();
}

async function callGemini(prompt, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no content');
  return stripFence(text);
}

async function compileToPdf(texContent, filename) {
  const res = await fetch(`${LATEX_URL}/compile-binary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tex_content: texContent, filename }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`LaTeX compile failed: ${err.log || err.error || res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Generate, compile, and store a tailored resume for one job.
 * Returns the resume_file_path to persist. Throws with a user-readable message.
 */
export async function generateResume({ job, profileJson, userEmail }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured — cannot generate a resume.');
  }

  const template = await loadTemplate(userEmail);
  const prompt = buildPrompt({
    template,
    jdText: job.job_description,
    profileJson,
    reasoning: job.reasoning,
  });

  const texContent = await callGemini(prompt, apiKey);
  if (!texContent.includes('\\begin{document}')) {
    throw new Error('Generated content does not look like a LaTeX document.');
  }

  const clean = cleanCompany(job.company);
  const version = job.version || 1;
  const filename = `Resume_${clean}`;
  const pdfBuffer = await compileToPdf(texContent, filename);

  // S3 when configured, local disk otherwise, matching the layout the download
  // route already understands for each case.
  if (BUCKET) {
    const key = `resumes/${userEmail}/${clean}/v${version}/${filename}.tex`;
    await uploadToS3(key, texContent, 'application/x-tex');
    await uploadToS3(key.replace(/\.tex$/, '.pdf'), pdfBuffer, 'application/pdf');
    return `s3://${BUCKET}/${key}`;
  }

  const relDir = path.join('output', clean, `v${version}`);
  const absDir = path.resolve(FILES_BASE, relDir);
  fs.mkdirSync(absDir, { recursive: true });
  fs.writeFileSync(path.join(absDir, `${filename}.tex`), texContent, 'utf8');
  fs.writeFileSync(path.join(absDir, `${filename}.pdf`), pdfBuffer);
  return `/files/${relDir}/${filename}.tex`;
}
