# n8n Fix: Unwanted Text in Generated LaTeX Files

## Problem

The generated `.tex` files sometimes contain non-LaTeX text at the beginning or end of sections. This happens because the Gemini AI response includes natural language text around or inside the JSON output, and the current parsing doesn't fully strip it.

## Root Cause

There are two places where unwanted text leaks through:

### 1. Preamble/epilogue around the JSON (Build Resume node)

The current cleanup in `Build Resume` only strips markdown fences:

```javascript
let cleaned = responseText
    .replace(/```json\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
```

This fails when Gemini outputs something like:

```
Here are the tailored resume sections:

```json
{ "experience_latex": "...", ... }
```

I've highlighted the most relevant experiences for this role.
```

After the regex cleanup, the preamble text `"Here are the tailored..."` and epilogue `"I've highlighted..."` remain. `JSON.parse` fails, the regex fallback extracts the field values correctly, but the outer text may still leak into edge cases.

**More critically**, the second regex `(/```\s*$/)` uses a `$` anchor, so it only matches ` ``` ` at the very end of the string. If there's epilogue text after the closing fences, the fences themselves aren't removed.

### 2. Text inside the JSON field values

Even when JSON parsing succeeds, Gemini sometimes includes explanatory text inside the LaTeX field values:

```json
{
  "experience_latex": "Here are the tailored entries:\n\n\\begin{twocolentry}...",
  "tailoring_notes": "..."
}
```

That `"Here are the tailored entries:\n\n"` ends up in the final `.tex` file.

## Fix

### Change 1: Better JSON extraction in Build Resume

Replace the current text cleanup block:

```javascript
// CURRENT CODE:
let cleaned = responseText
    .replace(/```json\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
```

With this more robust extraction:

```javascript
// NEW CODE: Extract the JSON object from anywhere in the response
let cleaned = responseText;

// Strip all markdown code fences (handles multiple or mismatched fences)
cleaned = cleaned.replace(/```(?:json)?\s*/gi, '').trim();

// Extract just the JSON object: find first { and last }
const firstBrace = cleaned.indexOf('{');
const lastBrace = cleaned.lastIndexOf('}');
if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
}
```

This handles preamble, epilogue, and mismatched fences in one shot.

### Change 2: Strip non-LaTeX text from field values

After the parsing block (after both `JSON.parse` and regex extraction), add cleanup for each field value. Insert this right **before** the `VALIDATION` section:

```javascript
// ----------- CLEAN FIELD VALUES -----------

/**
 * Strip any natural-language text that appears before the first LaTeX
 * command or environment in a field value.
 * Also strips trailing non-LaTeX text after the last closing brace/command.
 */
function cleanLatexField(text) {
    if (!text || typeof text !== 'string') return text;

    // Find the first LaTeX command: \command or \begin{
    const firstCmd = text.search(/\\[a-zA-Z]/);
    if (firstCmd > 0) {
        // There's text before the first LaTeX command — strip it
        text = text.substring(firstCmd);
    }

    // Find the last LaTeX closing construct: \end{...} or closing brace
    // that ends a LaTeX structure
    const lastEnd = text.search(/\\end\{[^}]+\}\s*$/);
    if (lastEnd !== -1) {
        const endMatch = text.substring(lastEnd).match(/\\end\{[^}]+\}/);
        if (endMatch) {
            text = text.substring(0, lastEnd + endMatch[0].length);
        }
    }

    return text.trim();
}

parsedContent.experience_latex = cleanLatexField(parsedContent.experience_latex);
parsedContent.projects_latex = cleanLatexField(parsedContent.projects_latex);
parsedContent.skills_latex = cleanLatexField(parsedContent.skills_latex);
```

### Change 3 (optional): Strengthen the AI prompt

In the `AI: Generate Resume2` node prompt, add this at the end of the OUTPUT FORMAT section:

```
# OUTPUT FORMAT (Strict JSON)
- Escape all double quotes inside LaTeX as \"
- Use newline characters explicitly (\n) inside JSON strings
- Return a single valid JSON object, nothing else
- The LaTeX field values must start with a LaTeX command (e.g. \begin{}, \vspace{}, \textbf{})
  and end with a LaTeX command. Do NOT include any natural language text, explanations,
  or commentary inside the field values — ONLY valid LaTeX code.
```

## Where to Apply

| Change | Node | Location in node |
|--------|------|-----------------|
| Change 1 | **Build Resume** (Code node) | Replace the `cleaned = responseText...` block (~line 15 of the active code) |
| Change 2 | **Build Resume** (Code node) | Insert between the parsing block and the `VALIDATION` section |
| Change 3 | **AI: Generate Resume2** (Gemini node) | Append to the OUTPUT FORMAT section of the prompt |

## Testing

After applying changes, run the pipeline with a job and check:
1. Open the generated `.tex` file — it should start with `\documentclass` and end with `\end{document}` with no stray text
2. Check each section between `\section{...}` headers — the content should be pure LaTeX with no English sentences outside of `\textbf{}` or bullet point content
3. Compile the `.tex` to PDF and verify no visible junk text appears
