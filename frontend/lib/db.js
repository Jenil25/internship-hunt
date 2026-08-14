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

/**
 * Fetch a page of jobs plus the total number of rows matching the filters.
 *
 * `total` is the count BEFORE limit/offset (window functions run before LIMIT),
 * so it costs no extra round trip and tells callers how much they did not receive.
 * `statuses` takes an array so grouped columns (e.g. Ready = scored +
 * resume_generated) filter in SQL rather than after truncation.
 */
export async function getJobs(
  userEmail,
  { limit = 100, offset = 0, applicationStates, pipelineState, minScore } = {}
) {
  let sql = 'SELECT *, COUNT(*) OVER() AS total_count FROM jobs WHERE user_email = $1';
  const params = [userEmail];
  let paramIndex = 2;

  if (applicationStates?.length) {
    sql += ` AND application_state = ANY($${paramIndex++})`;
    params.push(applicationStates);
  }
  if (pipelineState) {
    sql += ` AND pipeline_state = $${paramIndex++}`;
    params.push(pipelineState);
  }
  if (minScore) {
    sql += ` AND score >= $${paramIndex++}`;
    params.push(minScore);
  }

  sql += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
  params.push(limit, offset);

  const rows = await query(sql, params);
  // No rows means no matches; the window function had nothing to report a count on.
  const total = rows.length ? Number(rows[0].total_count) : 0;
  return { jobs: rows.map(({ total_count, ...job }) => job), total };
}

/**
 * Fetch a job the caller owns. `userEmail` is required and always part of the
 * WHERE clause — a caller that forgets it sends NULL, `user_email = NULL` is
 * never true, and the result is zero rows. Fail-closed by construction, so a
 * future caller cannot accidentally read across accounts.
 *
 * Callers should treat null as "not found" and return 404 without
 * distinguishing "wrong owner" from "no such id" — see requireOwnedJob().
 */
export async function getJobById(id, userEmail) {
  const rows = await query(
    'SELECT * FROM jobs WHERE id = $1 AND user_email = $2',
    [id, userEmail]
  );
  return rows[0] || null;
}

export async function getJobVersions(company, role, userEmail) {
  return query(
    'SELECT id, version, score, status, created_at FROM jobs WHERE user_email = $1 AND company = $2 AND role = $3 ORDER BY version DESC',
    [userEmail, company, role]
  );
}

export async function getStats(userEmail) {
  // resumes_generated counts files that actually exist. Reading it off a status
  // value is what made the dashboard report 1 resume when 7 were on disk: the
  // count vanished as soon as a job moved on to `applied`.
  // avg/max/min ignore ineligible rows, whose score is 0 and would drag the mean.
  const [totals] = await query(`
    SELECT
      COUNT(*) as total_jobs,
      COUNT(resume_file_path) as resumes_generated,
      COUNT(CASE WHEN application_state = 'none' AND pipeline_state = 'scored' THEN 1 END) as undecided,
      COUNT(CASE WHEN pipeline_state = 'ineligible' THEN 1 END) as ineligible,
      ROUND(AVG(score) FILTER (WHERE pipeline_state = 'scored')::numeric, 1) as avg_score,
      MAX(score) FILTER (WHERE pipeline_state = 'scored') as max_score,
      MIN(score) FILTER (WHERE pipeline_state = 'scored' AND score > 0) as min_score
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
    WHERE score > 0 AND user_email = $1 AND pipeline_state = 'scored'
    GROUP BY range
    ORDER BY range DESC
  `, [userEmail]);

  const recentJobs = await query(`
    SELECT id, company, role, score, match_level,
           pipeline_state, application_state, created_at
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

/**
 * Move a job through the application funnel.
 *
 * Ownership is enforced in the UPDATE's own WHERE clause rather than by a
 * separate SELECT first — one statement, so there is no window between the
 * check and the write. Only application_state and reviewed_at are writable
 * here; the column list is fixed, so a request body cannot reach user_email,
 * score, or pipeline_state.
 *
 * Any move off 'none' is a decision, so it stamps reviewed_at and the job
 * leaves the triage queue. Moving back to 'none' clears it and the job returns
 * to the queue, which is what dragging a card back on the board should mean.
 */
export async function setApplicationState(id, applicationState, userEmail) {
  const rows = await query(
    // $1 is cast explicitly: it appears both as a column value and inside a
    // comparison, and without the casts Postgres deduces conflicting types
    // for the same parameter and rejects the statement.
    `UPDATE jobs
        SET application_state = $1::varchar,
            reviewed_at = CASE
              WHEN $1::varchar = 'none' THEN NULL::timestamp
              ELSE COALESCE(reviewed_at, NOW())
            END,
            updated_at = NOW()
      WHERE id = $2 AND user_email = $3
      RETURNING id, application_state, reviewed_at, updated_at`,
    [applicationState, id, userEmail]
  );
  return rows[0] || null;
}

/**
 * The triage queue: highest-scoring jobs the user has not decided on yet.
 *
 * Ineligible jobs are excluded — there is nothing to decide. Unscored jobs sort
 * last rather than first, which NULLS LAST guarantees regardless of the score
 * column's nullability.
 */
export async function getTriageQueue(userEmail, limit = 10) {
  return query(
    `SELECT id, company, role, location, score, match_level, reasoning, hook,
            job_description, source, source_url, resume_file_path, created_at
       FROM jobs
      WHERE user_email = $1
        AND reviewed_at IS NULL
        AND pipeline_state = 'scored'
      ORDER BY score DESC NULLS LAST, created_at DESC
      LIMIT $2`,
    [userEmail, limit]
  );
}

/** How many undecided jobs remain, so the queue can show progress. */
export async function getTriageCount(userEmail) {
  const [row] = await query(
    `SELECT COUNT(*)::int AS remaining
       FROM jobs
      WHERE user_email = $1 AND reviewed_at IS NULL AND pipeline_state = 'scored'`,
    [userEmail]
  );
  return row?.remaining ?? 0;
}

/**
 * Skip: reviewed, but never applied to. Distinct from 'passed' only in intent —
 * both mean "decided not to pursue" — so it records the same way and drops out
 * of the queue.
 */
export async function skipJob(id, userEmail) {
  const rows = await query(
    `UPDATE jobs
        SET application_state = 'passed', reviewed_at = COALESCE(reviewed_at, NOW()), updated_at = NOW()
      WHERE id = $1 AND user_email = $2
      RETURNING id, application_state, reviewed_at`,
    [id, userEmail]
  );
  return rows[0] || null;
}

/** Record a generated resume against a job. Used by the lazy generation path. */
export async function setResumePath(id, resumeFilePath, userEmail) {
  const rows = await query(
    `UPDATE jobs SET resume_file_path = $1, updated_at = NOW()
      WHERE id = $2 AND user_email = $3
      RETURNING id, resume_file_path`,
    [resumeFilePath, id, userEmail]
  );
  return rows[0] || null;
}

export default pool;
