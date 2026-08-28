-- Query-level (search term) Search Console cache, alongside the existing
-- page-level GscMetric cache — gives the prompt-suggestion generator real
-- search demand to ground on.
CREATE TABLE IF NOT EXISTS "GscQuery" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "query" TEXT NOT NULL UNIQUE,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "position" DOUBLE PRECISION,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
