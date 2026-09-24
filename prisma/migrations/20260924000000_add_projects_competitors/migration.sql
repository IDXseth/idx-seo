-- Multi-brand support: projects (one per tracked domain), competitors, and
-- per-competitor detection results. Additive and idempotent — safe to re-run.
-- Existing rows are attached to a project by scripts/backfill-projects.ts.

-- Project
CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryDomain" TEXT NOT NULL,
    "additionalDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "brandNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sitemapUrl" TEXT,
    "sitemapPathPrefix" TEXT,
    "gscSiteUrl" TEXT,
    "segmentLabels" JSONB,
    "logoUrl" TEXT,
    "brandColor" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Project_userId_primaryDomain_key" ON "Project"("userId", "primaryDomain");

-- Competitor
CREATE TABLE IF NOT EXISTS "Competitor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Competitor_projectId_domain_key" ON "Competitor"("projectId", "domain");

-- ResultMention
CREATE TABLE IF NOT EXISTS "ResultMention" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "isMentioned" BOOLEAN NOT NULL DEFAULT false,
    "isCited" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER,
    "sentiment" TEXT NOT NULL DEFAULT 'neutral',

    CONSTRAINT "ResultMention_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ResultMention_resultId_competitorId_key" ON "ResultMention"("resultId", "competitorId");
CREATE INDEX IF NOT EXISTS "ResultMention_competitorId_idx" ON "ResultMention"("competitorId");

-- New columns on existing tables
ALTER TABLE "Batch" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
CREATE INDEX IF NOT EXISTS "Batch_projectId_idx" ON "Batch"("projectId");

ALTER TABLE "Prompt" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "Prompt" ADD COLUMN IF NOT EXISTS "entityName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Prompt" ADD COLUMN IF NOT EXISTS "segments" JSONB;
CREATE INDEX IF NOT EXISTS "Prompt_projectId_idx" ON "Prompt"("projectId");

ALTER TABLE "Result" ADD COLUMN IF NOT EXISTS "brandPosition" INTEGER;

-- Foreign keys (Postgres has no ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Project_userId_fkey') THEN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Competitor_projectId_fkey') THEN
    ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Batch_projectId_fkey') THEN
    ALTER TABLE "Batch" ADD CONSTRAINT "Batch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Prompt_projectId_fkey') THEN
    ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ResultMention_resultId_fkey') THEN
    ALTER TABLE "ResultMention" ADD CONSTRAINT "ResultMention_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ResultMention_competitorId_fkey') THEN
    ALTER TABLE "ResultMention" ADD CONSTRAINT "ResultMention_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
