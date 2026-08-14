/**
 * The resume prompt is authored for n8n and reused verbatim by the on-demand
 * generation path, so the substitution has to fill every n8n expression in it.
 * A placeholder that silently survives would be sent to Gemini as literal
 * template syntax and produce a confidently wrong resume, which is exactly the
 * failure that is hard to notice by looking at the output.
 *
 * Pure functions only — no server, no network, no database.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, cleanCompany } from '../lib/resume.js';

const INPUTS = {
  template: '\\documentclass{article}\\begin{document}TEMPLATE_MARKER\\end{document}',
  jdText: 'JD_MARKER: we need a Go engineer.',
  profileJson: { identity: { name: 'PROFILE_MARKER' } },
  reasoning: { strengths: ['REASONING_MARKER'] },
};

test('every n8n placeholder is filled', () => {
  const out = buildPrompt(INPUTS);
  assert.equal(out.match(/\{\{[^}]*\}\}/), null, 'an n8n expression survived substitution');
});

test('each input actually reaches the prompt', () => {
  const out = buildPrompt(INPUTS);
  for (const marker of ['TEMPLATE_MARKER', 'JD_MARKER', 'PROFILE_MARKER', 'REASONING_MARKER']) {
    assert.ok(out.includes(marker), `${marker} missing from the built prompt`);
  }
});

test('missing optional inputs do not leave placeholders behind', () => {
  const out = buildPrompt({ template: 'x', jdText: null, profileJson: null, reasoning: null });
  assert.equal(out.match(/\{\{[^}]*\}\}/), null);
});

test('a LaTeX-heavy template survives substitution intact', () => {
  // String.replace treats $& and $1 in the replacement as capture references;
  // LaTeX is full of $, so the replacement must be passed as a function.
  const tricky = '\\begin{document}$100 & 50\\% $& $1 $$x$$\\end{document}';
  const out = buildPrompt({ ...INPUTS, template: tricky });
  assert.ok(out.includes(tricky), 'template was mangled by replacement-pattern expansion');
});

test('cleanCompany produces a safe path segment', () => {
  assert.equal(cleanCompany('Point C'), 'PointC');
  assert.equal(cleanCompany('kos.ai'), 'kosai');
  assert.equal(cleanCompany('../../etc'), 'etc');
  assert.equal(cleanCompany(''), 'general');
  assert.equal(cleanCompany(null), 'general');
});
