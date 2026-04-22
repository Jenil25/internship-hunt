// ============================================================
// Node 4: Parse & Filter Jobs
// ============================================================
// Receives raw markdown from both GitHub repos (SimplifyJobs + SpeedyApply)
// SimplifyJobs uses HTML <table> format, SpeedyApply uses pipe-delimited tables.
// Parses both formats, extracts structured job entries,
// applies keyword + location filters, and skips closed/citizenship entries.
// ============================================================

const simplifyRaw = $('Fetch SimplifyJobs').first().json.data || '';
const speedyRaw = $('Fetch SpeedyApply').first().json.data || '';

// --- Configuration ---
const ROLE_KEYWORDS = [
  'swe', 'software', 'full stack', 'fullstack', 'full-stack',
  'backend', 'back-end', 'back end',
  'frontend', 'front-end', 'front end',
  'ai', 'ml', 'machine learning', 'artificial intelligence',
  'python', 'genai', 'generative ai',
  'data engineer', 'platform engineer', 'devops', 'cloud',
  'systems engineer', 'infrastructure', 'site reliability',
  'developer', 'engineering intern', 'web developer'
];

const LOCATION_KEYWORDS = [
  'boston', 'cambridge', 'somerville', 'waltham',
  'remote', 'ma', 'massachusetts', 'united states',
  'new york', 'ny', 'nyc', 'san francisco', 'sf',
  'hybrid', 'usa', 'anywhere'
];

// Emoji flags to skip
const SKIP_CLOSED = '🔒';
const SKIP_CITIZENSHIP = ['🛂', '🇺🇸'];

// --- Helper Functions ---

function extractFirstHtmlLink(text) {
  const match = text.match(/<a\s+href="([^"]*)"[^>]*>/i);
  if (match) return match[1].trim();
  return '';
}

function extractCompanyFromHtml(cellHtml) {
  // Extract company name and URL from <a href="url"><strong>Name</strong></a> or just <strong>Name</strong>
  const linkMatch = cellHtml.match(/<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
  if (linkMatch) {
    const url = linkMatch[1].trim();
    const innerText = linkMatch[2].replace(/<[^>]+>/g, '').trim();
    return { text: innerText, url: url };
  }
  // No link, just text (possibly with <strong>)
  const text = cellHtml.replace(/<[^>]+>/g, '').trim();
  return { text: text, url: '' };
}

function extractApplyUrl(cellHtml) {
  // The apply cell has one or two <a> tags with <img> inside
  // First <a> is the actual apply link, second is Simplify
  const links = [];
  const regex = /<a\s+href="([^"]*)"[^>]*>/gi;
  let match;
  while ((match = regex.exec(cellHtml)) !== null) {
    links.push(match[1].trim());
  }
  // Return the first link (actual job URL), skip simplify links
  for (const link of links) {
    if (!link.includes('simplify.jobs')) {
      return link;
    }
  }
  return links[0] || '';
}

function cleanText(text) {
  return text
    .replace(/<br\s*\/?>/gi, ', ')
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function shouldSkipEntry(rowText) {
  if (rowText.includes(SKIP_CLOSED)) return true;
  for (const flag of SKIP_CITIZENSHIP) {
    if (rowText.includes(flag)) return true;
  }
  return false;
}

function matchesRoleKeywords(role) {
  const roleLower = role.toLowerCase();
  return ROLE_KEYWORDS.some(keyword => roleLower.includes(keyword));
}

function matchesLocationKeywords(location) {
  const locLower = location.toLowerCase();
  return LOCATION_KEYWORDS.some(keyword => locLower.includes(keyword));
}

// --- Parse HTML Table (SimplifyJobs format) ---
function parseHtmlTable(markdown, source) {
  const jobs = [];
  let lastCompany = { text: '', url: '' };

  // Split into rows using <tr>...</tr>
  const rowRegex = /<tr>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(markdown)) !== null) {
    const rowHtml = rowMatch[1];

    // Skip header rows (contain <th>)
    if (rowHtml.includes('<th>')) continue;

    // Skip closed/citizenship entries
    if (shouldSkipEntry(rowHtml)) continue;

    // Extract cells
    const cellRegex = /<td>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1]);
    }

    if (cells.length < 4) continue;

    // Cell 0: Company (may be ↳ for sub-entries)
    const companyCell = cells[0].trim();
    const companyClean = cleanText(companyCell);

    let companyInfo;
    if (companyClean === '↳' || companyClean === '') {
      // Sub-entry, use last company
      companyInfo = lastCompany;
    } else {
      companyInfo = extractCompanyFromHtml(companyCell);
      // Clean emoji prefixes like 🔥
      companyInfo.text = companyInfo.text.replace(/^[🔥\s]+/, '').trim();
      lastCompany = companyInfo;
    }

    // Cell 1: Role
    const role = cleanText(cells[1]);

    // Cell 2: Location
    const location = cleanText(cells[2]);

    // Cell 3: Apply link
    const applyUrl = extractApplyUrl(cells[3]);

    // Cell 4: Date posted (if exists)
    const datePosted = cells.length >= 5 ? cleanText(cells[4]) : '';

    if (companyInfo.text && role) {
      jobs.push({
        company: companyInfo.text,
        companyUrl: companyInfo.url,
        role: role,
        location: location,
        applyUrl: applyUrl || companyInfo.url,
        datePosted: datePosted,
        source: source
      });
    }
  }

  return jobs;
}

// --- Parse Pipe-Delimited Markdown Table (SpeedyApply format) ---
function parsePipeTable(markdown, source) {
  const jobs = [];
  const lines = markdown.split('\n');
  let inTable = false;
  let headerParsed = false;
  let lastCompany = { text: '', url: '' };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed.startsWith('|')) {
      if (inTable && headerParsed) {
        inTable = false;
        headerParsed = false;
      }
      continue;
    }

    // Separator row
    if (trimmed.match(/^\|[\s\-:|]+\|$/)) {
      inTable = true;
      continue;
    }

    // Header row
    if (!headerParsed && inTable) {
      const lowerTrimmed = trimmed.toLowerCase();
      if (lowerTrimmed.includes('company') || lowerTrimmed.includes('role') || lowerTrimmed.includes('name')) {
        headerParsed = true;
        continue;
      }
    }

    if (!inTable) {
      const lowerTrimmed = trimmed.toLowerCase();
      if (lowerTrimmed.includes('company') && (lowerTrimmed.includes('role') || lowerTrimmed.includes('location') || lowerTrimmed.includes('title'))) {
        inTable = true;
        headerParsed = true;
        continue;
      }
      continue;
    }

    if (shouldSkipEntry(trimmed)) continue;

    const cells = trimmed.split('|').filter(c => c.trim() !== '');
    if (cells.length < 3) continue;

    // Company
    const companyCell = cells[0].trim();
    let companyInfo;
    if (cleanText(companyCell) === '↳') {
      companyInfo = lastCompany;
    } else {
      // Try HTML link first, then markdown link
      const htmlMatch = companyCell.match(/<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      const mdMatch = companyCell.match(/\[([^\]]*)\]\(([^)]*)\)/);
      if (htmlMatch) {
        companyInfo = { text: htmlMatch[2].replace(/<[^>]+>/g, '').trim(), url: htmlMatch[1].trim() };
      } else if (mdMatch) {
        companyInfo = { text: mdMatch[1].trim(), url: mdMatch[2].trim() };
      } else {
        companyInfo = { text: cleanText(companyCell), url: '' };
      }
      companyInfo.text = companyInfo.text.replace(/^[🔥\s]+/, '').trim();
      lastCompany = companyInfo;
    }

    const role = cleanText(cells[1]);
    const location = cleanText(cells[2]);

    // Apply URL
    let applyUrl = '';
    if (cells.length >= 4) {
      // Try HTML links first, then markdown links, then raw URLs
      const htmlLinks = [];
      const htmlRegex = /<a\s+href="([^"]*)"[^>]*>/gi;
      let m;
      while ((m = htmlRegex.exec(cells[3])) !== null) {
        htmlLinks.push(m[1].trim());
      }
      if (htmlLinks.length > 0) {
        applyUrl = htmlLinks.find(l => !l.includes('simplify.jobs')) || htmlLinks[0];
      } else {
        const mdMatch = cells[3].match(/\[([^\]]*)\]\(([^)]*)\)/);
        if (mdMatch) {
          applyUrl = mdMatch[2].trim();
        } else {
          const urlMatch = cells[3].match(/https?:\/\/[^\s)]+/);
          if (urlMatch) applyUrl = urlMatch[0];
        }
      }
    }

    let datePosted = '';
    if (cells.length >= 5) {
      datePosted = cleanText(cells[cells.length - 1]);
    }

    if (companyInfo.text && role) {
      jobs.push({
        company: companyInfo.text,
        companyUrl: companyInfo.url,
        role: role,
        location: location,
        applyUrl: applyUrl || companyInfo.url,
        datePosted: datePosted,
        source: source
      });
    }
  }

  return jobs;
}

// --- Main Execution ---

// SimplifyJobs uses HTML tables, so detect and use the right parser
let simplifyJobs = [];
if (simplifyRaw.includes('<table>') || simplifyRaw.includes('<tr>')) {
  simplifyJobs = parseHtmlTable(simplifyRaw, 'SimplifyJobs');
} else {
  simplifyJobs = parsePipeTable(simplifyRaw, 'SimplifyJobs');
}

// SpeedyApply – detect format too
let speedyJobs = [];
if (speedyRaw.includes('<table>') || speedyRaw.includes('<tr>')) {
  speedyJobs = parseHtmlTable(speedyRaw, 'SpeedyApply');
} else {
  speedyJobs = parsePipeTable(speedyRaw, 'SpeedyApply');
}

const allJobs = [...simplifyJobs, ...speedyJobs];

const filteredJobs = allJobs.filter(job => {
  const roleMatch = matchesRoleKeywords(job.role);
  const locationMatch = matchesLocationKeywords(job.location);
  return roleMatch && locationMatch;
});

const seen = new Set();
const uniqueJobs = filteredJobs.filter(job => {
  const key = `${job.company.toLowerCase().trim()}:${job.role.toLowerCase().trim()}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

return uniqueJobs.map(job => ({ json: job }));
