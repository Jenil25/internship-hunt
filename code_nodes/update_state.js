// ============================================================
// Node 15: Update State
// ============================================================
// Persists all processed company:role pairs into workflow static data.
// Also prunes entries older than 90 days to prevent unbounded growth.
// ============================================================

const staticData = $getWorkflowStaticData('global');

// Initialize if needed
if (!staticData.seenJobs) {
  staticData.seenJobs = {};
}

// Update last run timestamp
staticData.lastRun = new Date().toISOString();

// Increment run counter
staticData.runCount = (staticData.runCount || 0) + 1;

// Prune entries older than 90 days to prevent unbounded growth
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const now = Date.now();
let pruned = 0;

for (const [key, timestamp] of Object.entries(staticData.seenJobs)) {
  const entryDate = new Date(timestamp).getTime();
  if (now - entryDate > NINETY_DAYS_MS) {
    delete staticData.seenJobs[key];
    pruned++;
  }
}

const totalTracked = Object.keys(staticData.seenJobs).length;

return [{
  json: {
    status: 'state_updated',
    lastRun: staticData.lastRun,
    runCount: staticData.runCount,
    totalTrackedJobs: totalTracked,
    prunedEntries: pruned
  }
}];
