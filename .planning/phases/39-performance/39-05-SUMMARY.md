# Phase 39, Plan 05 — SUMMARY

**REQ-IDs:** PERF-05
**Status:** complete (migration applied locally; UI wired into both surfaces)

## What shipped

### Database

- `prisma/migrations/20260506090026_fts_search_indexes/migration.sql` — STORED generated tsvector columns + GIN indexes on Item / Risk / Decision / Project. Each tsvector is computed from `to_tsvector('russian', coalesce(<fields>, ''))`. Risk concatenates `risk + ' ' + impact + ' ' + mitigation` so a single FTS hit can surface any risk-field match. Migration applied to local DB; 52 Item rows have non-null `searchTsv` after re-population.
- `prisma/schema.prisma` — `searchTsv Unsupported("tsvector")?` declared on the four models. Read-only from Prisma's perspective: we never write to it, the database populates from the GENERATED ALWAYS expression. Prisma 7 handled `Unsupported("tsvector")` cleanly — no pivot to "no schema field" required.

### Backend (NestJS / tRPC)

- `apps/api/src/modules/search/search.service.ts` — `SearchService` with `query(input, session)` method. Validates input via `searchQueryInputSchema`, gates `scope='all'` to head/admin via `SearchAuthorizationError`, delegates to repository, sorts by rank desc + createdAt desc, slices to limit.
- `apps/api/src/modules/search/search.prisma-repository.ts` — `SearchPrismaRepository` running one `$queryRaw` with four UNION ALL chunks. Each chunk projects the same RawHit shape (`type, id, title, snippet, rank, projectId?, reportId?, reportSectionId?, createdAt`). All user input flows through `Prisma.sql` parameter binding; `plainto_tsquery('russian', $1)` neutralises ts_query operator chars. `ts_headline` returns `<<…>>` markers around matched tokens.
- `apps/api/src/modules/search/search.module.ts` — wires repository + service via NestJS DI factory (mirrors archive module pattern).
- `apps/api/src/modules/search/search.service.test.ts` — 12 unit tests covering: 2-char floor, scope='all' rejection for lead + viewer, scope='all' allowance for head + admin, userId forwarding, empty result, rank-desc ordering, createdAt tie-breaker, limit cap, Zod input validation (q too short / too long).
- `apps/api/src/infrastructure/trpc/trpc.router.ts` — `search.query` procedure under `protectedProcedure`. Maps `SearchAuthorizationError → TRPCError code FORBIDDEN`; other errors flow through `mapDomainError`.
- `apps/api/src/app.module.ts` + `apps/api/src/main.ts` — `SearchModule` registered, `SearchService` resolved into the router deps bag.

### Shared

- `packages/shared/src/schemas/search.ts` — `searchHitSchema`, `searchQueryInputSchema`, `searchQueryOutputSchema`, exported through `packages/shared/src/index.ts`.

### Frontend (Next.js)

- `apps/web/src/components/search/search-input.tsx` — debounced (300ms) search input with results dropdown. Mounts when `q.length >= 2`. Renders type badge + title + snippet (with `<<…>>` markers parsed into `<mark>`) + relative date. Keyboard: Esc clears, ↑/↓ navigates, Enter activates highlighted hit. Click → `next/router.push(targetUrlFor(hit))`.
- `apps/web/src/components/search/search-input.test.tsx` — 9 component tests covering: render, 2-char floor, debounce + query firing, marker → `<mark>` conversion, empty state, Enter routing, Escape clear, scope forwarding, project routing.
- `apps/web/src/app/(app)/lead/history/page.tsx` — `<SearchInput scope="mine" />` mounted at the top of the sidebar, above the existing Reporting Overview / Recent Pattern cards.
- `apps/web/src/components/admin/products-tab.tsx` — `<SearchInput scope="all" />` mounted at the top of the tab body. UI gate is implicit (admin panel is already head/admin only); the tRPC layer is the actual auth gate.

### Documentation

- `.planning/PERF-AUDIT-2026-05.md` § 7 — old "FTS — NOT NEEDED in v8.0" note marked SUPERSEDED with a pointer to 39-05.

## Methodology

The user's directive ("ищи и в моих, ищи везде") drove three concrete decisions:

1. **Two scope surfaces, not one** — `mine` for the lead-personal sidebar, `all` for the admin top-of-products. Same procedure, different filter, role-gated server-side.
2. **2-char minimum, not 3** — Russian compounds and English abbreviations ("PR", "QA", "BI") are common in seed content. The Zod schema enforces 2..200.
3. **Snippet markers visible** — `ts_headline` with `StartSel=<<,StopSel=>>` and `MaxWords=12,MinWords=4`. The UI parses the markers and renders `<mark>` so users see _why_ a row matched.

## Test counts (pre / post)

| Layer    | Pre | Post | Delta                     |
| -------- | --- | ---- | ------------------------- |
| api unit | 623 | 635  | +12 (search.service.test) |
| web unit | 237 | 246  | +9 (search-input.test)    |

## Lint + typecheck

```
pnpm turbo typecheck   →   5/5 pass
pnpm turbo lint        →   4/4 pass, 0 errors / 0 warnings
```

## Verification recipe

```bash
cd /home/user/work/customreport
pnpm exec prisma migrate deploy --schema prisma/schema.prisma
pnpm exec prisma generate --schema prisma/schema.prisma
pnpm turbo typecheck
pnpm turbo lint --continue
cd apps/api && pnpm test src/modules/search/search.service.test
cd ../web && pnpm test src/components/search/search-input
```

Smoke from psql:

```sql
SELECT 'item' AS t,
       ts_rank("searchTsv", plainto_tsquery('russian', 'интеграция'))::float8 AS rank,
       substring("text", 1, 60)
FROM "Item"
WHERE "searchTsv" @@ plainto_tsquery('russian', 'интеграция')
ORDER BY rank DESC LIMIT 3;
```

Expected: 2+ matches with monotonically decreasing rank.

## Notes / spec ambiguity resolved

- **Click-through URL for content hits inside a historical report** — chose `/lead/report?period=<reportId>#section-<sectionId>` matching the current route shape. UX-15 plans to migrate to `/lead/report/[reportId]`; the search component centralises the target-URL logic in one helper (`targetUrlFor`) so that future migration is a one-line change.
- **Project-hit landing page** — `/admin?tab=products&filter=<projectId>`. The `filter` query param is not yet read by the products-tab component; that follow-up is implicit-best-effort UX (the tab opens, and a future tweak can scroll/highlight the matched project). Out of scope for this plan.

## Files

- `prisma/migrations/20260506090026_fts_search_indexes/migration.sql`
- `prisma/schema.prisma`
- `packages/shared/src/schemas/search.ts`
- `packages/shared/src/index.ts`
- `apps/api/src/modules/search/{search.module.ts, search.service.ts, search.prisma-repository.ts, search.service.test.ts}`
- `apps/api/src/app.module.ts`
- `apps/api/src/main.ts`
- `apps/api/src/infrastructure/trpc/trpc.router.ts`
- `apps/web/src/components/search/{search-input.tsx, search-input.test.tsx}`
- `apps/web/src/app/(app)/lead/history/page.tsx`
- `apps/web/src/components/admin/products-tab.tsx`
- `.planning/PERF-AUDIT-2026-05.md` (§ 7 SUPERSEDED note)
