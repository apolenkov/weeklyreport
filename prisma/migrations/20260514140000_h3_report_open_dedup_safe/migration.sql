-- H-3: prod-safe generic dedup for duplicate open Report rows.
--
-- Migration c2 (20260512110000_c2_report_open_unique) deleted a specific
-- dev UUID and then created the PARTIAL UNIQUE INDEX. That hardcoded DELETE
-- is a no-op on any environment that never had that exact row (prod, staging).
-- If prod somehow has duplicate open periods with *different* UUIDs, c2's
-- CREATE UNIQUE INDEX would fail before this migration existed.
--
-- This migration runs AFTER c2 and adds a generic content-based dedup so
-- any remaining duplicates (any UUID) are removed before the unique index
-- is enforced. The CREATE INDEX uses IF NOT EXISTS so it is idempotent when
-- the index already exists (dev / staging that already ran c2 successfully).

-- Generic dedup: for each (periodStart, periodEnd) pair that has more than
-- one open Report, keep the row with the most authored content (ReportSection
-- count DESC), tiebreak by createdAt DESC (newest wins).
WITH ranked AS (
  SELECT r.id,
         ROW_NUMBER() OVER (
           PARTITION BY r."periodStart", r."periodEnd"
           ORDER BY
             (SELECT COUNT(*) FROM "ReportSection" rs WHERE rs."reportId" = r.id) DESC,
             r."createdAt" DESC
         ) AS rn
  FROM "Report" r
  WHERE r."periodState" = 'open'
)
DELETE FROM "Report"
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Idempotent guard: ensures the invariant index exists even on environments
-- where c2 was skipped or rolled back.
CREATE UNIQUE INDEX IF NOT EXISTS "Report_one_open_per_boundary"
  ON "Report" ("periodStart", "periodEnd")
  WHERE "periodState" = 'open';
