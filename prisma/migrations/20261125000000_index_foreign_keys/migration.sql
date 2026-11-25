-- Postgres doesn't index foreign-key columns on its own. Without these,
-- deleting a prompt set cascades through its prompts, results and citations
-- with a full table scan per row, which can run past the database's
-- statement timeout, so the delete fails. They also speed up the
-- per-set and per-run reads behind the dashboard and the Run page.
CREATE INDEX IF NOT EXISTS "Prompt_batchId_idx" ON "Prompt"("batchId");
CREATE INDEX IF NOT EXISTS "Result_promptId_idx" ON "Result"("promptId");
CREATE INDEX IF NOT EXISTS "Result_runSessionId_idx" ON "Result"("runSessionId");
CREATE INDEX IF NOT EXISTS "Citation_resultId_idx" ON "Citation"("resultId");
CREATE INDEX IF NOT EXISTS "RunSession_batchId_idx" ON "RunSession"("batchId");
CREATE INDEX IF NOT EXISTS "RunSession_scheduleId_idx" ON "RunSession"("scheduleId");
CREATE INDEX IF NOT EXISTS "BatchRun_batchId_idx" ON "BatchRun"("batchId");
CREATE INDEX IF NOT EXISTS "BatchRun_runSessionId_idx" ON "BatchRun"("runSessionId");
CREATE INDEX IF NOT EXISTS "Schedule_batchId_idx" ON "Schedule"("batchId");
