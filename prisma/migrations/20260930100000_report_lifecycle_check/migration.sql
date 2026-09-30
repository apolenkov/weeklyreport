BEGIN;

-- Database mirror of currentPeriodLifecycleSchema
-- (packages/shared/src/schemas/period/period-lifecycle.schema.ts): the six legal
-- (periodState, status, archived, periodStatus) tuples plus the timestamp and
-- audit-flag rules. Lifecycle writers already produce only these rows.
ALTER TABLE "Report"
  ADD CONSTRAINT "Report_lifecycle_tuple_check"
  CHECK (
    ("periodState"::text, "status"::text, "archived", "periodStatus"::text) IN (
      ('scheduled', 'draft', false, 'open'),
      ('open', 'draft', false, 'open'),
      ('open', 'published', false, 'reopened'),
      ('published', 'published', false, 'published'),
      ('archived', 'draft', true, 'open'),
      ('archived', 'published', true, 'published')
    )
    AND (
      "status" = 'published'
      OR (
        "publishedAt" IS NULL
        AND "publishedById" IS NULL
        AND "reopenedAt" IS NULL
        AND NOT "autoPublished"
        AND NOT "autoArchived"
      )
    )
    AND ("status" <> 'published' OR "publishedAt" IS NOT NULL)
    AND ("periodStatus" <> 'reopened' OR "reopenedAt" IS NOT NULL)
  );

COMMIT;
