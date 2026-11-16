-- Tokens, searches and estimated USD cost per result, for per-run and
-- per-project cost reporting. Existing rows stay null (not tracked).
ALTER TABLE "Result" ADD COLUMN IF NOT EXISTS "inputTokens" INTEGER;
ALTER TABLE "Result" ADD COLUMN IF NOT EXISTS "outputTokens" INTEGER;
ALTER TABLE "Result" ADD COLUMN IF NOT EXISTS "searchCount" INTEGER;
ALTER TABLE "Result" ADD COLUMN IF NOT EXISTS "costUsd" DOUBLE PRECISION;
