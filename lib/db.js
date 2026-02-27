import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
});

export async function query(text, params) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getJobs(userEmail, { limit = 50, offset = 0, status, minScore } = {}) {
  let sql = 'SELECT * FROM jobs WHERE user_email = $1';
  const params = [userEmail];
  let paramIndex = 2;

  if (status) {
    sql += ` AND status = $${paramIndex++}`;
    params.push(status);
  }
  if (minScore) {
    sql += ` AND score >= $${paramIndex++}`;
    params.push(minScore);
  }

  sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params.push(limit, offset);

  return query(sql, params);
}

export async function getJobById(id) {
  const rows = await query('SELECT * FROM jobs WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function getJobVersions(company, role, userEmail) {
  return query(
    'SELECT id, version, score, status, created_at FROM jobs WHERE user_email = $1 AND company = $2 AND role = $3 ORDER BY version DESC',
    [userEmail, company, role]
  );
}

export async function getStats(userEmail) {
  const [totals] = await query(`
    SELECT 
      COUNT(*) as total_jobs,
      COUNT(CASE WHEN status = 'resume_generated' THEN 1 END) as resumes_generated,
      COUNT(CASE WHEN status = 'scored' THEN 1 END) as scored,
      COUNT(CASE WHEN status = 'ineligible' THEN 1 END) as ineligible,
      ROUND(AVG(score)::numeric, 1) as avg_score,
      MAX(score) as max_score,
      MIN(CASE WHEN score > 0 THEN score END) as min_score
    FROM jobs
    WHERE user_email = $1
  `, [userEmail]);
  
  const scoreDistribution = await query(`
    SELECT 
      CASE 
        WHEN score >= 90 THEN '90-100'
        WHEN score >= 80 THEN '80-89'
        WHEN score >= 70 THEN '70-79'
        WHEN score >= 60 THEN '60-69'
        WHEN score >= 50 THEN '50-59'
        ELSE 'Below 50'
      END as range,
      COUNT(*) as count
    FROM jobs
    WHERE score > 0 AND user_email = $1
    GROUP BY range
    ORDER BY range DESC
  `, [userEmail]);

  const recentJobs = await query(`
    SELECT id, company, role, score, match_level, status, created_at 
    FROM jobs 
    WHERE user_email = $1
    ORDER BY created_at DESC 
    LIMIT 5
  `, [userEmail]);

  return { totals, scoreDistribution, recentJobs };
}

export async function getProfile(userEmail, profileName = 'general') {
  const rows = await query(
    'SELECT id, user_email, profile_name, profile_json, updated_at FROM profiles WHERE user_email = $1 AND profile_name = $2',
    [userEmail, profileName]
  );
  return rows[0] || null;
}

export async function updateProfile(userEmail, profileName, profileJson) {
  const rows = await query(
    `UPDATE profiles SET profile_json = $1, updated_at = NOW()
     WHERE user_email = $2 AND profile_name = $3
     RETURNING id, user_email, profile_name, updated_at`,
    [JSON.stringify(profileJson), userEmail, profileName]
  );
  return rows[0] || null;
}

export async function updateJobStatus(id, status) {
  const rows = await query(
    'UPDATE jobs SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [status, id]
  );
  return rows[0] || null;
}

export default pool;
