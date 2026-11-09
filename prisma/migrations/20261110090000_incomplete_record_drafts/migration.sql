BEGIN;

-- Forward-only and additive: an author may save a risk or decision before its
-- details are written. NULL marks the missing detail; existing complete rows
-- are not rewritten. Primary text, severity, owner, parent XOR, stage and
-- lineage constraints and the generated search columns stay as they are.
ALTER TABLE "Risk"
  ALTER COLUMN "impact" DROP NOT NULL,
  ALTER COLUMN "mitigation" DROP NOT NULL;

ALTER TABLE "Decision"
  ALTER COLUMN "impact" DROP NOT NULL;

-- Frozen per-section totals of the incomplete records left out of a published
-- report. Both NULL on sections frozen before omissions were counted: unknown,
-- never zero.
ALTER TABLE "PublishedSectionScope"
  ADD COLUMN "omittedRisks" INTEGER,
  ADD COLUMN "omittedDecisions" INTEGER;

ALTER TABLE "PublishedSectionScope"
  ADD CONSTRAINT "PublishedSectionScope_omission_totals_check"
  CHECK (
    ("omittedRisks" IS NULL AND "omittedDecisions" IS NULL)
    OR ("omittedRisks" >= 0 AND "omittedDecisions" >= 0)
  );

COMMIT;
