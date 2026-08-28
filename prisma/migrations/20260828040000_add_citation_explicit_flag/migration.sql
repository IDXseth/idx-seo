-- Splits "citations" into two distinct signals: sources a platform explicitly
-- cited/quoted in its answer text (isExplicitCitation = true, the default —
-- existing rows are all of this kind) vs. sources its search step merely
-- retrieved without directly citing (isExplicitCitation = false).
ALTER TABLE "Citation" ADD COLUMN IF NOT EXISTS "isExplicitCitation" BOOLEAN NOT NULL DEFAULT true;
