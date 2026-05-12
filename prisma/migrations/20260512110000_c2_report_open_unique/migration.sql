-- C2: Period-Integrity — dedupe duplicate open Report rows + unique boundary constraint
--
-- Root cause (A24/A21): two Report rows existed for the May 11-17 boundary both with
-- periodState='open'. This caused duplicate Draft displays in the UI (A21) and
-- dashboard data confusion (A28/A33). The PARTIAL UNIQUE INDEX enforces the invariant
-- at the DB level going forward.
--
-- Dedup rule: keep row with max content (sections + items + risks + decisions + priorities),
-- tiebreak by createdAt DESC.
--   a0000000-0000-4000-8000-000000000001: 7 empty ReportSections, 0 actual content → DELETE
--   09f975f2-4033-4a70-81dc-043f7dd019d8: 3 sections + 27 content items → KEEP
--
-- After manual dedup, add PARTIAL UNIQUE INDEX to prevent recurrence.

-- Step 1: cascade-delete the empty duplicate (ReportSection → Item/Risk/Decision/Priority
--         all have onDelete: Cascade in schema, so DELETE Report is sufficient)
DELETE FROM "Report"
WHERE id = 'a0000000-0000-4000-8000-000000000001';

-- Step 2: enforce one-open-per-boundary invariant at the schema level
CREATE UNIQUE INDEX "Report_one_open_per_boundary"
  ON "Report" ("periodStart", "periodEnd")
  WHERE "periodState" = 'open';
