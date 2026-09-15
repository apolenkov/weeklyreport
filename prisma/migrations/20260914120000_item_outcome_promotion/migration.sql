BEGIN;

-- MOVE-NEXT-CURRENT: promotion replaces the active result with the linked
-- commitment and appends an audit event. Widening the allowed outcome set is
-- additive: no existing row, constraint or column is rewritten.
ALTER TABLE "ItemOutcomeEvent"
  DROP CONSTRAINT "ItemOutcomeEvent_outcome_check";

ALTER TABLE "ItemOutcomeEvent"
  ADD CONSTRAINT "ItemOutcomeEvent_outcome_check"
  CHECK ("outcome" IN ('done', 'continue', 'plan_next', 'wont_do', 'restore', 'promote'));

COMMIT;
