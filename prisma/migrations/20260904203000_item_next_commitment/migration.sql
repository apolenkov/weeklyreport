BEGIN;

-- Keep the authored weekly result separate from its next-period commitment.
ALTER TABLE "Item" ADD COLUMN "nextStepText" TEXT;

ALTER TABLE "Item" DROP CONSTRAINT "Item_type_status_check";
ALTER TABLE "Item"
  ADD CONSTRAINT "Item_type_status_check"
  CHECK (
    ("type" = 'current' AND "workflowStatus" IN ('planned', 'in_progress', 'paused', 'done'))
    OR
    ("type" = 'next' AND "workflowStatus" IN ('planned', 'postponed'))
  );

ALTER TABLE "Item"
  ADD CONSTRAINT "Item_next_step_check"
  CHECK ("nextStepText" IS NULL OR (
    "type" = 'current' AND "workflowStatus" <> 'done'
    AND btrim("nextStepText") <> ''
  ));

COMMIT;
