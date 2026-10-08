-- Looker Studio reporting layer for AIVisTool
--
-- Creates a `reporting` schema of flat, Looker-friendly views over the app
-- tables, plus a read-only `looker_reader` role that can see ONLY those views
-- (no OAuth tokens, passwords, sessions, or raw AI response text).
--
-- How to apply: paste into the Supabase SQL editor for the AIVisTool project
-- and run. It is idempotent — safe to re-run after editing a view.
-- Before running, replace CHANGE_ME_STRONG_PASSWORD below (do not commit the
-- real password).
--
-- Looker Studio connection (PostgreSQL connector):
--   Host:     aws-0-<region>.pooler.supabase.com   (Session pooler — NOT the
--             6543 transaction pooler, and NOT db.<ref>.supabase.co which is
--             IPv6-only)
--   Port:     5432
--   Database: postgres
--   Username: looker_reader.<project-ref>
--   Password: the one set below
--   Enable SSL: on
--
-- This lives outside prisma/migrations on purpose: it contains a role
-- password, and Prisma does not manage the `reporting` schema.

CREATE SCHEMA IF NOT EXISTS reporting;

-- ---------------------------------------------------------------------------
-- reporting.ai_results
-- One row per AI result: prompt x platform x run session.
-- `mentioned` / `cited` are 0/1 integers so Looker Studio can AVG() them
-- into mention rate / citation rate directly.
-- `is_latest_run` marks rows from the most recent completed run session of
-- each project (batch) — filter on it for "current state" scorecards; leave
-- it off for trend charts over run_date.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW reporting.ai_results AS
WITH latest_session AS (
  SELECT DISTINCT ON (p."batchId")
    p."batchId" AS batch_id,
    rs.id       AS run_session_id
  FROM "Result" r
  JOIN "Prompt" p      ON p.id = r."promptId"
  JOIN "RunSession" rs ON rs.id = r."runSessionId"
  WHERE rs.status = 'done'
  ORDER BY p."batchId", rs."startedAt" DESC
),
citation_counts AS (
  SELECT "resultId" AS result_id, COUNT(*) AS citation_count
  FROM "Citation"
  GROUP BY "resultId"
)
SELECT
  r.id                                   AS result_id,
  r."runAt"                              AS run_at,
  (r."runAt" AT TIME ZONE 'America/Chicago')::date AS run_date,
  r."runSessionId"                       AS run_session_id,
  rs."startedAt"                         AS run_started_at,
  COALESCE(rs."triggeredBy", 'manual')   AS run_triggered_by,
  (ls.run_session_id IS NOT NULL)        AS is_latest_run,

  b.id                                   AS project_id,
  b.name                                 AS project_name,

  p.id                                   AS prompt_id,
  p."promptType"                         AS prompt_type,
  p.category                             AS category,
  p."communityName"                      AS community_name,
  p.city                                 AS city,
  p.market                               AS market,
  NULLIF(p."levelOfCare", '')            AS level_of_care,
  p."promptText"                         AS prompt_text,

  r.platform                             AS platform,
  CASE r.platform
    WHEN 'chatgpt'    THEN 'ChatGPT'
    WHEN 'claude'     THEN 'Claude'
    WHEN 'perplexity' THEN 'Perplexity'
    WHEN 'gemini'     THEN 'Gemini'
    WHEN 'google_aio' THEN 'Google AI Overviews'
    ELSE r.platform
  END                                    AS platform_label,

  r."isMentioned"                        AS is_mentioned,
  r."isCited"                            AS is_cited,
  r."isMentioned"::int                   AS mentioned,
  r."isCited"::int                       AS cited,
  r.sentiment                            AS sentiment,
  CASE r.sentiment
    WHEN 'positive' THEN 1
    WHEN 'negative' THEN -1
    ELSE 0
  END                                    AS sentiment_score,
  COALESCE(cc.citation_count, 0)         AS citation_count
FROM "Result" r
JOIN "Prompt" p             ON p.id = r."promptId"
JOIN "Batch" b              ON b.id = p."batchId"
LEFT JOIN "RunSession" rs   ON rs.id = r."runSessionId"
LEFT JOIN latest_session ls ON ls.batch_id = p."batchId"
                           AND ls.run_session_id = r."runSessionId"
LEFT JOIN citation_counts cc ON cc.result_id = r.id
-- google_ai_mode was removed from core analysis; keep it out of reports too.
WHERE r.platform <> 'google_ai_mode';

-- ---------------------------------------------------------------------------
-- reporting.ai_citations
-- One row per URL an AI platform cited, with the result's dimensions, for
-- "which domains get cited" reports.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW reporting.ai_citations AS
SELECT
  c.id                                   AS citation_id,
  c.url                                  AS url,
  c.title                                AS title,
  regexp_replace(lower(c.domain), '^www\.', '') AS domain,
  ar.result_id,
  ar.run_at,
  ar.run_date,
  ar.run_session_id,
  ar.is_latest_run,
  ar.project_id,
  ar.project_name,
  ar.prompt_id,
  ar.prompt_type,
  ar.category,
  ar.community_name,
  ar.city,
  ar.market,
  ar.level_of_care,
  ar.platform,
  ar.platform_label,
  ar.is_mentioned,
  ar.is_cited
FROM "Citation" c
JOIN reporting.ai_results ar ON ar.result_id = c."resultId";

-- GSC data is not part of this reporting layer; drop the view if an earlier
-- version of this script created it.
DROP VIEW IF EXISTS reporting.gsc_pages;

-- ---------------------------------------------------------------------------
-- Read-only role for Looker Studio
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'looker_reader') THEN
    CREATE ROLE looker_reader LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
  END IF;
END
$$;

ALTER ROLE looker_reader SET statement_timeout = '60s';
ALTER ROLE looker_reader SET default_transaction_read_only = on;

-- Only the reporting schema — nothing in public.
REVOKE ALL ON SCHEMA public FROM looker_reader;
GRANT USAGE ON SCHEMA reporting TO looker_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA reporting TO looker_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA reporting GRANT SELECT ON TABLES TO looker_reader;
