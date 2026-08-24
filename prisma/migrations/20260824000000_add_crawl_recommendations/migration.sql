-- Screaming Frog crawl import + Claude-generated page-level recommendations

CREATE TABLE IF NOT EXISTS "CrawlBatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "totalPages" INTEGER NOT NULL DEFAULT 0,
  "donePages" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CrawlPage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "crawlBatchId" TEXT NOT NULL REFERENCES "CrawlBatch"("id") ON DELETE CASCADE,
  "url" TEXT NOT NULL,
  "statusCode" INTEGER,
  "indexability" TEXT,
  "indexabilityStatus" TEXT,
  "title" TEXT,
  "titleLength" INTEGER,
  "metaDescription" TEXT,
  "metaDescriptionLength" INTEGER,
  "h1" TEXT,
  "wordCount" INTEGER,
  "canonicalUrl" TEXT,
  "inlinks" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("crawlBatchId", "url")
);

CREATE TABLE IF NOT EXISTS "PageRecommendation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "crawlPageId" TEXT NOT NULL UNIQUE REFERENCES "CrawlPage"("id") ON DELETE CASCADE,
  "priority" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "issues" TEXT[] NOT NULL DEFAULT '{}',
  "recommendations" TEXT[] NOT NULL DEFAULT '{}',
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
