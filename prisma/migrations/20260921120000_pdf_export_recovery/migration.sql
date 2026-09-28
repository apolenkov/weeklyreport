BEGIN;

-- Quarantine state for aged pending exports whose generation-scoped queue job
-- is confirmed absent. The added value is never referenced inside this
-- transaction: PostgreSQL forbids using a fresh enum value before commit.
ALTER TYPE "PdfExportStatus" ADD VALUE IF NOT EXISTS 'recovery_required';

-- Monotonic dispatch generation; all existing rows start at generation 1.
ALTER TABLE "PdfExportJob" ADD COLUMN IF NOT EXISTS "generation" INTEGER NOT NULL DEFAULT 1;

COMMIT;
