BEGIN;

-- Week placement and progress are independent. Widen the constraint for
-- databases that already applied the historical next-commitment migration.
ALTER TABLE "Item" DROP CONSTRAINT "Item_type_status_check";
ALTER TABLE "Item"
  ADD CONSTRAINT "Item_type_status_check"
  CHECK (
    ("type" = 'current' AND "workflowStatus" IN ('planned', 'in_progress', 'paused', 'postponed', 'done'))
    OR
    ("type" = 'next' AND "workflowStatus" IN ('planned', 'in_progress', 'paused', 'postponed', 'done'))
  );

COMMIT;
