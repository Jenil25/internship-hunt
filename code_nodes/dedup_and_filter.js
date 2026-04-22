// ============================================================
// Node 7: Dedup & Filter
// ============================================================
// Receives parsed+filtered jobs from Node 4 and existing DB records
// from Node 5 (PostgreSQL). Cross-references both sources to output
// only genuinely new job entries.
// ============================================================

// Get parsed jobs from the Parse & Filter node
const parsedJobs = $('Parse & Filter Jobs').all();

// Get existing jobs from PostgreSQL
const existingDbJobs = $('Fetch Existing Jobs').all();

// Get workflow static data for persistence across runs
const staticData = $getWorkflowStaticData('global');

// Initialize seenJobs set if it doesn't exist
if (!staticData.seenJobs) {
  staticData.seenJobs = {};
}

// Build a set of existing DB entries (normalized company:role)
const dbJobSet = new Set();
for (const item of existingDbJobs) {
  const company = (item.json.company || '').toLowerCase().trim();
  const role = (item.json.role || '').toLowerCase().trim();
  if (company && role) {
    dbJobSet.add(`${company}:${role}`);
  }
}

// Filter out jobs that already exist in DB or static data
const newJobs = [];

for (const item of parsedJobs) {
  const job = item.json;
  const company = (job.company || '').toLowerCase().trim();
  const role = (job.role || '').toLowerCase().trim();
  const key = `${company}:${role}`;

  // Skip if already in PostgreSQL
  if (dbJobSet.has(key)) continue;

  // Skip if already seen in previous workflow runs
  if (staticData.seenJobs[key]) continue;

  // This is a new job — mark it as seen
  staticData.seenJobs[key] = new Date().toISOString();
  newJobs.push({ json: job });
}

// Log summary for debugging
if (newJobs.length === 0) {
  return [{ json: { _noNewJobs: true, message: 'No new jobs found after deduplication.' } }];
}

return newJobs;
