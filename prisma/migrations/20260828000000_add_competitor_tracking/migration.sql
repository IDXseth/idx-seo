-- Competitor tracking: named competitors matched against the existing prompt set.
CREATE TABLE IF NOT EXISTS "Competitor" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "brandName" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "aliases" TEXT NOT NULL DEFAULT '',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One row per (Result, Competitor), mirroring Result.isMentioned/isCited/sentiment.
CREATE TABLE IF NOT EXISTS "CompetitorMention" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "resultId" TEXT NOT NULL REFERENCES "Result"("id") ON DELETE CASCADE,
  "competitorId" TEXT NOT NULL REFERENCES "Competitor"("id") ON DELETE CASCADE,
  "isMentioned" BOOLEAN NOT NULL DEFAULT false,
  "isCited" BOOLEAN NOT NULL DEFAULT false,
  "sentiment" TEXT NOT NULL DEFAULT 'neutral',
  UNIQUE ("resultId", "competitorId")
);

CREATE INDEX IF NOT EXISTS "Competitor_userId_idx" ON "Competitor"("userId");
CREATE INDEX IF NOT EXISTS "CompetitorMention_competitorId_idx" ON "CompetitorMention"("competitorId");
CREATE INDEX IF NOT EXISTS "CompetitorMention_resultId_idx" ON "CompetitorMention"("resultId");
