// ============================================================
// Node 11: Parse Score
// ============================================================
// Parses the Gemini quick-score JSON response.
// Handles both clean JSON and markdown-wrapped JSON responses.
// ============================================================

const item = $input.first().json;

// The Gemini response might be in different fields depending on node config
let responseText = item.text || item.output || item.response || '';

// If it's an object already (auto-parsed), try to extract directly
if (typeof responseText === 'object') {
  return [{
    json: {
      ...item,
      score: responseText.score || 0,
      visa_eligible: responseText.visa_eligible !== false,
      location_match: responseText.location_match !== false,
      reasoning: responseText.reasoning || 'No reasoning provided',
      _parsed: true
    }
  }];
}

// Try to extract JSON from the response text
// Handle markdown code blocks: ```json ... ```
let jsonStr = responseText;
const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
if (codeBlockMatch) {
  jsonStr = codeBlockMatch[1].trim();
}

// Try to parse JSON
try {
  const parsed = JSON.parse(jsonStr);
  return [{
    json: {
      ...item,
      score: parsed.score || 0,
      visa_eligible: parsed.visa_eligible !== false,
      location_match: parsed.location_match !== false,
      reasoning: parsed.reasoning || 'No reasoning provided',
      _parsed: true
    }
  }];
} catch (e) {
  // If JSON parsing fails, try to extract score with regex
  const scoreMatch = responseText.match(/"score"\s*:\s*(\d+)/);
  const visaMatch = responseText.match(/"visa_eligible"\s*:\s*(true|false)/);
  const locationMatch = responseText.match(/"location_match"\s*:\s*(true|false)/);
  const reasonMatch = responseText.match(/"reasoning"\s*:\s*"([^"]+)"/);

  return [{
    json: {
      ...item,
      score: scoreMatch ? parseInt(scoreMatch[1]) : 0,
      visa_eligible: visaMatch ? visaMatch[1] === 'true' : true,
      location_match: locationMatch ? locationMatch[1] === 'true' : true,
      reasoning: reasonMatch ? reasonMatch[1] : 'Could not parse Gemini response',
      _parsed: false,
      _parseError: e.message
    }
  }];
}
