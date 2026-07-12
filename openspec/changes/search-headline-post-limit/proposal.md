## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

`SearchPrismaRepository.search` builds each UNION ALL chunk (item, risk,
decision, project) as a single `SELECT` that projects `ts_headline(...)` in
the same target list as the `tsvector` predicate, then applies `ORDER BY rank
LIMIT perType`. Postgres evaluates a query's target list — including an
expensive function like `ts_headline`, which re-parses the source document —
for every row that survives the `WHERE` filter, before the `ORDER BY`/`LIMIT`
trims the result down. So a common token that matches thousands of rows
computes thousands of `ts_headline` calls per request, even though at most
`perType` rows are ever returned. The class doc comment justifies the
one-query design by the _output_ size ("≤ limit per type, ≤ 200 rows worst
case"), which describes the post-`LIMIT` row count, not the pre-`LIMIT`
projection cost that actually drives latency.

## What Changes

- In `apps/api/src/modules/search/search.prisma-repository.ts`, restructure
  each of the four UNION ALL chunks (item, risk, decision, project) into two
  stages: an inner subquery that ranks and limits over the `tsvector`
  predicate WITHOUT computing `ts_headline` (selecting only the id, title,
  rank, foreign keys, and the raw document text/expression needed for the
  headline), followed by an outer projection that computes `ts_headline` only
  over the `perType` survivors of that inner subquery.
- Rewrite the class doc comment (currently justifying the single-query design
  by post-`LIMIT` output size) to also state the headline-deferral invariant,
  so the next reader can't rely on the same false justification that masked
  this cost.
- No change to the outer query's final `ORDER BY rank DESC, "createdAt" DESC
LIMIT ${limit}`, to `SearchHit` shape, to scope/exclude-type filtering, or
  to any caller — this is a pre-`LIMIT` cost reduction with identical output.

## Impact

- `apps/api/src/modules/search/search.prisma-repository.ts`
- `openspec/specs/hot-path-query-performance/spec.md` (new requirement)

Non-goals: no index change, no change to `plainto_tsquery`/`ts_rank` usage,
no change to the per-type or overall `limit` values, no change to the
`published`/`mine`/`all` scope filters.
