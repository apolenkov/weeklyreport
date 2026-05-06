-- 39-05 (PERF-05): full-text search infrastructure.
--
-- Each searchable model gains a STORED generated tsvector column populated
-- from `to_tsvector('russian', ...)` on its content fields, plus a GIN
-- index on that column for sub-millisecond `@@` lookups.
--
-- The 'russian' text-search config covers Cyrillic stemming for the
-- weekly-report content this app actually stores; English tokens stem
-- well enough through the same config (Postgres falls back to default
-- snowball stemming for non-Cyrillic input).
--
-- Generated columns are READ-ONLY from Prisma's perspective — the schema
-- declares the field as `Unsupported("tsvector")?` so prisma generate
-- does not attempt to write to it. All search queries use $queryRaw with
-- `plainto_tsquery('russian', $1)` (auto-sanitises operator chars).

-- Item.text → searchTsv
ALTER TABLE "Item" ADD COLUMN "searchTsv" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('russian', coalesce("text", ''))
  ) STORED;

CREATE INDEX "Item_searchTsv_idx" ON "Item" USING GIN ("searchTsv");

-- Risk.risk + impact + mitigation → searchTsv
ALTER TABLE "Risk" ADD COLUMN "searchTsv" tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'russian',
      coalesce("risk", '') || ' ' ||
      coalesce("impact", '') || ' ' ||
      coalesce("mitigation", '')
    )
  ) STORED;

CREATE INDEX "Risk_searchTsv_idx" ON "Risk" USING GIN ("searchTsv");

-- Decision.text → searchTsv
ALTER TABLE "Decision" ADD COLUMN "searchTsv" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('russian', coalesce("text", ''))
  ) STORED;

CREATE INDEX "Decision_searchTsv_idx" ON "Decision" USING GIN ("searchTsv");

-- Project.name → searchTsv
ALTER TABLE "Project" ADD COLUMN "searchTsv" tsvector
  GENERATED ALWAYS AS (
    to_tsvector('russian', coalesce("name", ''))
  ) STORED;

CREATE INDEX "Project_searchTsv_idx" ON "Project" USING GIN ("searchTsv");
