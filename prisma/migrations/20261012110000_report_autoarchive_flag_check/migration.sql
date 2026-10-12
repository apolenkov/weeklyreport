BEGIN;

-- Forward-only mirror of currentPeriodLifecycleSchema's audit provenance:
-- autoArchived can describe only a currently archived report. Historical
-- contradictions block constraint validation; never repair unknown rows here.
ALTER TABLE "Report"
  ADD CONSTRAINT "Report_auto_archived_state_check"
  CHECK (NOT "autoArchived" OR "archived");

COMMIT;
