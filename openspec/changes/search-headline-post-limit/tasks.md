## 1. Defer `ts_headline` to post-limit rows

- [ ] 1.1 In `search.prisma-repository.ts`, rewrite the `item` chunk as an
      inner subquery (id, projectId, reportId, reportSectionId, createdAt,
      title, rank, and the raw `i."text"` document) ordered by `rank DESC,
"createdAt" DESC` and limited to `perType`, wrapped by an outer
      `SELECT` that adds `ts_headline('russian', <inner document column>,
plainto_tsquery('russian', ${q}), ${headlineOpts}) AS "snippet"` over
      only those inner rows
- [ ] 1.2 Apply the same restructuring to the `risk` chunk — carry the raw
      `coalesce(r."risk", '') || ' — ' || coalesce(r."impact", '') || ' — '
|| coalesce(r."mitigation", '')` concatenation expression (not just
      `r."risk"`) through the inner subquery as the document column the outer
      `ts_headline` call consumes
- [ ] 1.3 Apply the same restructuring to the `decision` chunk (`d."text"`)
- [ ] 1.4 Apply the same restructuring to the `project` chunk (`p."name"`),
      preserving the existing `excludeTypes.includes("project")` short-circuit
      that omits the whole chunk (and its `UNION ALL`) when projects are
      excluded
- [ ] 1.5 Keep the outer union's final `ORDER BY "rank" DESC, "createdAt" DESC
LIMIT ${limit}` and the `RawHit`/`SearchHit` mapping unchanged — this
      task only moves where `ts_headline` is computed, not what is returned
- [ ] 1.6 Rewrite the class doc comment: keep the existing "why one query"
      rationale, and add that each chunk defers `ts_headline` to a
      post-rank-and-limit outer projection specifically so an expensive
      per-document headline re-parse runs only over the `perType` survivors,
      not over every row matching the `tsvector` predicate

## 2. Verification

- [ ] 2.1 `EXPLAIN ANALYZE` a query with a high-frequency term against a
      seeded dataset with thousands of matching rows for one type; confirm
      the `ts_headline`-bearing projection node now sits above a node that
      has already applied the rank `ORDER BY`/`LIMIT` (bounded to `perType`
      rows), not above the raw bitmap/index scan
- [ ] 2.2 Result-equivalence check: run the same query (same `q`, `scope`,
      `groupIds`, `excludeTypes`, `limit`) against the pre-change and
      post-change code and diff the returned `SearchHit[]` — same hits, same
      `snippet` text, same order; the restructuring MUST NOT change output,
      only when `ts_headline` is computed
- [ ] 2.3 `pnpm --filter @customreport/api db:generate`
- [ ] 2.4 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 2.5 `openspec validate search-headline-post-limit --strict`
