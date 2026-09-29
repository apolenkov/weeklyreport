BEGIN;

-- Reviewer reason recorded with a changes_requested verdict; NULL for approvals and legacy rows.
ALTER TABLE "SectionReview" ADD COLUMN IF NOT EXISTS "comment" TEXT;

COMMIT;
