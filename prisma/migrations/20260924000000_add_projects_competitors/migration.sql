-- Multi-brand support: a Project is one tracked brand/domain. Batches, prompts
-- and competitors are attached to a project. Additive and idempotent — safe to
-- re-run. Existing rows are attached by scripts/backfill-projects.ts.

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

-- New columns on existing tables
ALTER TABLE "Batch" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
CREATE INDEX IF NOT EXISTS "Batch_projectId_idx" ON "Batch"("projectId");

ALTER TABLE "Prompt" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
ALTER TABLE "Prompt" ADD COLUMN IF NOT EXISTS "entityName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Prompt" ADD COLUMN IF NOT EXISTS "segments" JSONB;
CREATE INDEX IF NOT EXISTS "Prompt_projectId_idx" ON "Prompt"("projectId");

ALTER TABLE "Competitor" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
CREATE INDEX IF NOT EXISTS "Competitor_projectId_idx" ON "Competitor"("projectId");

ALTER TABLE "Result" ADD COLUMN IF NOT EXISTS "brandPosition" INTEGER;
ALTER TABLE "CompetitorMention" ADD COLUMN IF NOT EXISTS "position" INTEGER;

-- Foreign keys (Postgres has no ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Project_userId_fkey') THEN
    ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Batch_projectId_fkey') THEN
    ALTER TABLE "Batch" ADD CONSTRAINT "Batch_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Prompt_projectId_fkey') THEN
    ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Competitor_projectId_fkey') THEN
    ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Same reasoning as the Competitor tables: only reached through Prisma as the
-- postgres superuser, so RLS with no policies just closes the Supabase API surface.
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
