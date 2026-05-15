-- UAT 2026-05-15: persist the Risk dialog severity chip.
--
-- The UI has an explicit At Risk / Blocked selector, but the old contract
-- only persisted risk/impact/mitigation/stage. On refresh every risk mapped
-- back to "at-risk", so choosing "Blocked" appeared to do nothing.

ALTER TABLE "Risk"
  ADD COLUMN "severity" TEXT NOT NULL DEFAULT 'at-risk';

ALTER TABLE "Risk"
  ADD CONSTRAINT "Risk_severity_check"
  CHECK ("severity" IN ('at-risk', 'blocked'));
