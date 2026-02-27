import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'applai_db',
  user: process.env.PG_USER || 'applai_user',
  password: process.env.PG_PASSWORD || 'applai_random',
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

export async function getJobs({ limit = 50, offset = 0, status, minScore } = {}) {
  let sql = 'SELECT * FROM jobs WHERE 1=1';
  const params = [];
  let paramIndex = 1;

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

export async function getJobVersions(company, role, userEmail = 'jenilmahy25@gmail.com') {
  return query(
    'SELECT id, version, score, status, created_at FROM jobs WHERE user_email = $1 AND company = $2 AND role = $3 ORDER BY version DESC',
    [userEmail, company, role]
  );
}

export async function getStats() {
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
  `);
  
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
    WHERE score > 0
    GROUP BY range
    ORDER BY range DESC
  `);

  const recentJobs = await query(`
    SELECT id, company, role, score, match_level, status, created_at 
    FROM jobs 
    ORDER BY created_at DESC 
    LIMIT 5
  `);

  return { totals, scoreDistribution, recentJobs };
}

export default pool;
