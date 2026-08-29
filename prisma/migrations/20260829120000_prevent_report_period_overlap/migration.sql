-- Refuse the migration before taking a schema lock when two editable live rows
-- already overlap. Published/archived rows remain valid historical republish
-- evidence and deliberately do not participate in this invariant.
DO $$
DECLARE
  conflict RECORD;
BEGIN
  SELECT
    earlier."id" AS earlier_id,
    later."id" AS later_id,
    earlier."periodStart" AS earlier_start,
    earlier."periodEnd" AS earlier_end,
    later."periodStart" AS later_start,
    later."periodEnd" AS later_end
  INTO conflict
  FROM "Report" AS earlier
  JOIN "Report" AS later
    ON earlier."id" < later."id"
   AND earlier."periodState" IN ('open', 'scheduled')
   AND later."periodState" IN ('open', 'scheduled')
   AND earlier."periodStart" <= later."periodEnd"
   AND earlier."periodEnd" >= later."periodStart"
  ORDER BY earlier."periodStart", later."periodStart"
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Cannot enforce Report period non-overlap: report % [% - %] overlaps report % [% - %]',
      conflict.earlier_id,
      conflict.earlier_start,
      conflict.earlier_end,
      conflict.later_id,
      conflict.later_start,
      conflict.later_end
      USING ERRCODE = '23514';
  END IF;
END $$;

-- PostgreSQL range GiST support is built in; no extension is required. Closed
-- bounds preserve the product contract used by findOverlappingPeriod. The
-- predicate extends the old exact-boundary guarantee to arbitrary live ranges
-- without forbidding the durable republish history contract.
ALTER TABLE "Report"
  ADD CONSTRAINT "Report_no_live_period_overlap"
  EXCLUDE USING GIST (
    tsrange("periodStart", "periodEnd", '[]') WITH &&
  ) WHERE ("periodState" IN ('open', 'scheduled'));

-- The live-range exclusion constraint subsumes the old live-state
-- exact-boundary index. Keeping both would duplicate enforcement and error
-- translation.
DROP INDEX "Report_one_open_per_boundary";
