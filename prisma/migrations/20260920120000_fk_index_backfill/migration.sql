BEGIN;

-- Backfill leftmost indexes for relation foreign keys so restrict, cascade,
-- and set-null writes do not force a sequential scan.
CREATE INDEX "SitepingFeedback_authorUserId_idx" ON "SitepingFeedback"("authorUserId");
CREATE INDEX "AgentationEvent_authorUserId_idx" ON "AgentationEvent"("authorUserId");
CREATE INDEX "AiPromptBundleRevision_baseRevisionId_idx" ON "AiPromptBundleRevision"("baseRevisionId");

COMMIT;
