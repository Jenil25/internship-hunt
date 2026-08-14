// ============================================================
// Node: Parse & Filter PM Jobs
// ============================================================
// Parses JSON data returned by 3 API endpoints:
// 1. Adzuna API (GET https://api.adzuna.com/v1/api/jobs/us/search/1)
// 2. JSearch API via RapidAPI (GET https://jsearch.p.rapidapi.com/search)
// 3. The Muse API (GET https://www.themuse.com/api/public/jobs)
// ============================================================

// --- Fetch Raw Outputs Safely ---
let adzunaRaw = [];
try {
  const node = $('Fetch Adzuna PM').first().json;
  adzunaRaw = node.results || [];
} catch (e) {
  console.log('No Adzuna data:', e.message);
}

let jsearchRaw = [];
try {
  const node = $('Fetch JSearch PM').first().json;
  jsearchRaw = node.data || [];
} catch (e) {
  console.log('No JSearch data:', e.message);
}

let museRaw = [];
try {
  const node = $('Fetch The Muse PM').first().json;
  museRaw = node.results || [];
} catch (e) {
  console.log('No The Muse data:', e.message);
}

// --- Configuration ---
const PM_PRODUCT_KEYWORDS = [
  'product manager', 'product management', 'project manager', 'project management',
  'program manager', 'program management', 'pmo', 'scrum', 'agile', 'product coordinator',
  'project coordinator', 'associate product manager', 'apm', 'product intern', 'pm intern',
  'project intern', 'program intern', 'product owner', 'product analyst', 'product associate'
];

const OPS_STRATEGY_KEYWORDS = [
  'operations', 'ops', 'strategy', 'strategic', 'bizops', 'business operations',
  'business ops', 'strategy intern', 'operations intern', 'ops intern',
  'corporate development', 'planning'
];

// Combine all keywords for general PM/Product/Ops/Strategy filtering
const ALL_PM_KEYWORDS = [...PM_PRODUCT_KEYWORDS, ...OPS_STRATEGY_KEYWORDS];

// --- Helper Functions ---
function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesKeywords(role, keywords) {
  const roleLower = role.toLowerCase();
  return keywords.some(keyword => roleLower.includes(keyword));
}

const jobs = [];

// 1. Parse Adzuna
adzunaRaw.forEach(item => {
  const company = item.company?.display_name || '';
  const role = item.title || '';
  const location = item.location?.display_name || '';
  const applyUrl = item.redirect_url || '';
  const datePosted = item.created || '';
  
  if (company && role && matchesKeywords(role, ALL_PM_KEYWORDS)) {
    jobs.push({
      company: cleanText(company),
      role: cleanText(role),
      location: cleanText(location),
      applyUrl: applyUrl,
      datePosted: datePosted,
      source: 'Adzuna'
    });
  }
});

// 2. Parse JSearch
jsearchRaw.forEach(item => {
  const company = item.employer_name || '';
  const role = item.job_title || '';
  const location = item.job_is_remote ? 'Remote' : (item.job_city && item.job_state ? `${item.job_city}, ${item.job_state}` : item.job_location || 'USA');
  const applyUrl = item.job_apply_link || '';
  const datePosted = item.job_posted_at_timestamp ? new Date(item.job_posted_at_timestamp * 1000).toISOString() : '';
  
  if (company && role && matchesKeywords(role, ALL_PM_KEYWORDS)) {
    jobs.push({
      company: cleanText(company),
      role: cleanText(role),
      location: cleanText(location),
      applyUrl: applyUrl,
      datePosted: datePosted,
      source: 'JSearch'
    });
  }
});

// 3. Parse The Muse
museRaw.forEach(item => {
  const company = item.company?.name || '';
  const role = item.name || '';
  const location = item.locations?.map(l => l.name).join(' | ') || 'USA';
  const applyUrl = item.refs?.landing_page || '';
  const datePosted = item.publication_date || '';
  
  if (company && role && matchesKeywords(role, ALL_PM_KEYWORDS)) {
    jobs.push({
      company: cleanText(company),
      role: cleanText(role),
      location: cleanText(location),
      applyUrl: applyUrl,
      datePosted: datePosted,
      source: 'The Muse'
    });
  }
});

// --- Deduplicate by Company + Role ---
const seen = new Set();
const uniqueJobs = jobs.filter(job => {
  const key = `${job.company.toLowerCase().trim()}:${job.role.toLowerCase().trim()}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

return uniqueJobs.map(job => ({ json: job }));
