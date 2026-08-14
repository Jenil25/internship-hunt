-- 001: split `status` into pipeline state and application state
--
-- `status` held two unrelated things in one column: what the automated pipeline
-- did to a job (scored / resume_generated / ineligible) and where the user is in
-- applying to it (applied / interviewing / rejected / ...). Because they shared a
-- column, marking a job `applied` erased the fact that a resume existed — which
-- is why /resumes showed 1 of 7 real resumes.
--
-- Model after this migration:
--
--   pipeline_state     what the pipeline concluded: 'scored' | 'ineligible'
--   application_state  where the user is:           'none' | 'applied' | ...
--   reviewed_at        when the user decided about this job (NULL = undecided)
--   resume presence    NOT a column — always derived from resume_file_path
--
-- Note there is deliberately no 'resume_generated' pipeline state. That value was
-- a second, drift-prone record of something resume_file_path already answers, and
-- letting the two disagree is the original bug. Anything that needs to know
-- whether a resume exists asks `resume_file_path IS NOT NULL`.
--
-- `status` is intentionally NOT dropped. The n8n workflows still INSERT it and
-- are hosted outside this repo, so dropping it would break ingestion. It is now
-- a legacy input column: the trigger below translates it, and nothing in the app
-- reads it. Drop it once the workflows write the new columns directly.
--
-- Reviewed against: local postgres-local container only.
-- Rollback is at the bottom of this file.

BEGIN;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS pipeline_state    VARCHAR(20),
  ADD COLUMN IF NOT EXISTS application_state VARCHAR(20),
  ADD COLUMN IF NOT EXISTS reviewed_at       TIMESTAMP;

-- ── Backfill from the old single column ──
-- A job the user acted on counts as reviewed, dated from when it last changed.
-- Jobs still sitting in scored/resume_generated were never decided on, so they
-- stay unreviewed and become the initial triage queue.
UPDATE jobs SET
  pipeline_state = CASE WHEN status = 'ineligible' THEN 'ineligible' ELSE 'scored' END,
  application_state = CASE status
    WHEN 'applied'      THEN 'applied'
    WHEN 'interviewing' THEN 'interviewing'
    WHEN 'accepted'     THEN 'accepted'
    WHEN 'rejected'     THEN 'rejected'
    WHEN 'no_response'  THEN 'no_response'
    WHEN 'pass'         THEN 'passed'
    ELSE 'none'
  END,
  reviewed_at = CASE
    WHEN status IN ('applied','interviewing','accepted','rejected','no_response','pass')
      THEN COALESCE(updated_at, created_at)
    ELSE NULL
  END
WHERE pipeline_state IS NULL;

-- ── Bridge for n8n, which still writes only `status` ──
-- Deliberately no column DEFAULT: a default would be indistinguishable from an
-- explicit value, so the trigger could not tell whether the caller meant it.
-- NULL means "caller did not set this", and BEFORE INSERT fills it in from
-- `status`. Remove this trigger once the workflows write the new columns.
CREATE OR REPLACE FUNCTION jobs_derive_states() RETURNS trigger AS $$
BEGIN
  IF NEW.pipeline_state IS NULL THEN
    NEW.pipeline_state := CASE WHEN NEW.status = 'ineligible' THEN 'ineligible' ELSE 'scored' END;
  END IF;
  IF NEW.application_state IS NULL THEN
    NEW.application_state := CASE NEW.status
      WHEN 'applied'      THEN 'applied'
      WHEN 'interviewing' THEN 'interviewing'
      WHEN 'accepted'     THEN 'accepted'
      WHEN 'rejected'     THEN 'rejected'
      WHEN 'no_response'  THEN 'no_response'
      WHEN 'pass'         THEN 'passed'
      ELSE 'none'
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS jobs_derive_states_trg ON jobs;
CREATE TRIGGER jobs_derive_states_trg
  BEFORE INSERT ON jobs
  FOR EACH ROW EXECUTE FUNCTION jobs_derive_states();

ALTER TABLE jobs
  ALTER COLUMN pipeline_state    SET NOT NULL,
  ALTER COLUMN application_state SET NOT NULL;

ALTER TABLE jobs
  DROP CONSTRAINT IF EXISTS jobs_pipeline_state_check,
  DROP CONSTRAINT IF EXISTS jobs_application_state_check;

ALTER TABLE jobs
  ADD CONSTRAINT jobs_pipeline_state_check
    CHECK (pipeline_state IN ('scored','ineligible')),
  ADD CONSTRAINT jobs_application_state_check
    CHECK (application_state IN ('none','applied','interviewing','accepted','rejected','no_response','passed'));

-- The triage queue's only read: highest-scoring undecided eligible job per user.
CREATE INDEX IF NOT EXISTS jobs_triage_idx
  ON jobs (user_email, score DESC)
  WHERE reviewed_at IS NULL AND pipeline_state = 'scored';

COMMIT;

-- ── Rollback ──
-- BEGIN;
-- DROP TRIGGER IF EXISTS jobs_derive_states_trg ON jobs;
-- DROP FUNCTION IF EXISTS jobs_derive_states();
-- DROP INDEX IF EXISTS jobs_triage_idx;
-- ALTER TABLE jobs
--   DROP CONSTRAINT IF EXISTS jobs_pipeline_state_check,
--   DROP CONSTRAINT IF EXISTS jobs_application_state_check,
--   DROP COLUMN IF EXISTS pipeline_state,
--   DROP COLUMN IF EXISTS application_state,
--   DROP COLUMN IF EXISTS reviewed_at;
-- COMMIT;
