-- Competitor sites the user adds to ground prompt-suggestion research in
-- real competitor content (used by the domain-restricted web search in
-- lib/prompt-suggestions.ts).
CREATE TABLE IF NOT EXISTS "CompetitorSite" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitorSite_userId_domain_key" ON "CompetitorSite"("userId", "domain");

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
