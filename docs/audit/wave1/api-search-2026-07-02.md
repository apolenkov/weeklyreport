# Per-file audit — apps/api/src/modules/search (2026-07-02)

Read-only calibration audit, wave 1.

3 files reviewed (`search.prisma-repository.ts`, `search.service.ts`, `search.module.ts`).

13 findings kept, 0 killed by verification.

## search.prisma-repository.ts (8 findings)

| Lines                                               | Dimension       | Severity | Finding                                                                                                                                                                                                                                                            | Suggestion                                                                                                                                                                                   | Your verdict |
| --------------------------------------------------- | --------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 50-227                                              | size-complexity | high     | `search()` is ~177 lines, far over the 50-line hard function limit, mixing mine-scope filters, group filters, published-report join, optional project chunk, raw SQL union, and row-to-`SearchHit` mapping. Cognitive complexity also well over the <10 threshold. | Split into named helpers: `buildMineFilter`, `buildGroupFilter`, `buildPublishedJoin`, `buildProjectChunk`, `buildSearchQuery`, `mapRowsToHits`. `search()` becomes a ~25-line orchestrator. |              |
| 125,126,132,147,148,156,169,171,174,182,194,195,203 | constants       | high     | The text-search language literal `'russian'` is repeated ~15 times inline across every `ts_headline`/`ts_rank`/`plainto_tsquery` call; a language change means editing 15 call sites with room for a mismatch.                                                     | Extract `const SEARCH_LANGUAGE = 'russian' as const;` (documented: matches the GIN index's tsvector config) and interpolate via `Prisma.raw`/`Prisma.sql` at every call site.                |              |
| 25-45                                               | comments        | medium   | 20-line JSDoc header narrates strategy and repeats SQL-injection-safety rationale — load-bearing but far exceeds the 3-line comment budget.                                                                                                                        | RELOCATE the strategy/safety rationale into an openspec spec or ADR; leave a ≤2-line pointer comment here.                                                                                   |              |
| 97-106                                              | comments        | medium   | 10-line comment block ("viewer-report-surface-parity (Decision 1)...") explains a real cross-module correctness contract (periodStatus vs status gating) but is over budget and references a change/decision name (archaeology).                                   | RELOCATE the periodStatus-vs-status rationale to the viewer-report-surface-parity spec; leave a ≤2-line pointer here.                                                                        |              |
| 146,167,193                                         | constants       | medium   | The title-snippet cap `120` is a magic number duplicated identically in the item/risk/decision SQL chunks.                                                                                                                                                         | Extract `const TITLE_SNIPPET_MAX_CHARS = 120;` and reference it in all three fragments.                                                                                                      |              |
| 65                                                  | constants       | low      | `headlineOpts = "MaxWords=12,MinWords=4,StartSel=<<,StopSel=>>"` bakes four magic values into one opaque string; the `<<`/`>>` markers are also a cross-file contract with the web-side snippet parser (`search-input.tsx:99`).                                    | Name the constituent values (MAX_WORDS, MIN_WORDS, SNIPPET_START/END_MARKER) in `packages/shared` since the markers are a cross-file UI/API contract; compose `headlineOpts` from them.      |              |
| 85-87                                               | comments        | low      | Comment references a ticket/change code ("TD-03") — change-log archaeology the policy says to delete (also repeated in `search.service.ts:32,107`).                                                                                                                | Drop the "TD-03" prefix; keep only the plain-English WHY, trimmed to the 3-line budget.                                                                                                      |              |
| 8-12                                                | comments        | low      | `RawHit` interface JSDoc drifts toward narration ("post-processing folds them into typed SearchHit records") that just repeats what the code below already shows.                                                                                                  | Trim to one line stating only the non-obvious part (all four UNION chunks must share this exact column list); drop the narration.                                                            |              |

Already good: SQL injection safety is handled correctly and consistently — `q` is always bound through `Prisma.sql` template params, never string-concatenated, and `plainto_tsquery` sanitizes operator characters. Excluded hit types are omitted from the SQL entirely (chunk + UNION ALL) rather than fetched-then-filtered, so they never consume a LIMIT slot — a real perf/correctness detail done right.

## search.service.ts (4 findings)

| Lines   | Dimension       | Severity | Finding                                                                                                                                                                                                                                                                                                     | Suggestion                                                                                                                                       | Your verdict |
| ------- | --------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 58-68   | env-config      | high     | Logger construction reads `process.env.LOG_DIR`/`LOG_LEVEL` ad-hoc at class-field level with an unchecked `as` cast and a silent `?? "info"` default, bypassing the validated `env.schema.ts` (which already declares `LOG_LEVEL` as a required enum). Hides a missing `LOG_LEVEL` instead of failing loud. | Read env via the validated config service/schema (`requireEnv`-style), not raw `process.env`; drop the `?? "info"` fallback.                     |              |
| 111-118 | duplication     | high     | `groupIds` derivation reimplements the per-role logic already centralized in `computeAllowedGroupIds` (`apps/api/src/lib/group-scope.ts:128-138`); the file's own comment ("matching groupScopeFilter semantics") acknowledges the duplication and risk of drift.                                           | Call `computeAllowedGroupIds(session)` for the non-admin branches instead of re-deriving inline.                                                 |              |
| 58-68   | duplication     | medium   | This exact 8-line logger-construction block (service name aside) is duplicated verbatim in `review.service.ts:71`, `weekly-report.service.ts:95`, `report-sections.service.ts:193` — propagates the env-config violation above to every copy.                                                               | Factor a shared `createServiceLogger(serviceName: string)` in `lib/logger.ts` that resolves `LOG_DIR`/`LOG_LEVEL` once via the env schema.       |              |
| 91-165  | size-complexity | medium   | `query()` is ~74 lines, mixing authorization, group-scope derivation, exclude-type policy, repository call, sorting, logging, and output parsing — over the 50-line hard limit.                                                                                                                             | Extract `assertScopeAuthorized(parsed, session)`, `resolveGroupIds(session)`, `resolveExcludeTypes(session)`; `query()` becomes an orchestrator. |              |

Already good: the authorization gate (lead cannot use `scope='all'`) is a single clear early check, and the empty-groupIds short-circuit (return `[]` without hitting the repository) is a clean, defensive way to keep zero-access sessions from ever forming a query. `SearchRepository` is a Prisma-free interface at the service boundary, enabling in-memory fakes for unit tests.

## search.module.ts (1 finding)

| Lines | Dimension | Severity | Finding                                                                                     | Suggestion                                                                                                                                                              | Your verdict |
| ----- | --------- | -------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 6-10  | comments  | low      | Module-level JSDoc header cites a ticket code ("39-05 (PERF-05)") — change-log archaeology. | Drop the ticket prefix; if the DI-wiring rationale is worth keeping, state it plainly in ≤2 lines (or delete — the pattern is self-evident from the useFactory wiring). |              |

Already good: minimal, single-purpose NestJS module wiring the Prisma repository behind the service via a factory provider — no scope creep, easy to scan.

## Rollup

**By dimension:** comments 5 (2 medium, 3 low) · constants 3 (1 high, 1 medium, 1 low) · duplication 2 (1 high, 1 medium) · size-complexity 2 (1 high, 1 medium) · env-config 1 (high).

**By severity:** high 4 · medium 5 · low 4.

**Top-3 highest impact:**

1. `search.prisma-repository.ts:50-227` — `search()` at 177 lines / high complexity is the single biggest maintainability risk in the module; any future filter change touches this monolith.
2. `search.service.ts:58-68` — env-config bypass of the validated schema (silent `?? "info"` default) is a boot-time correctness risk, not just style, and it's copy-pasted into 3 other services.
3. `search.service.ts:111-118` — reimplementing `computeAllowedGroupIds` inline is an authorization-scope duplication; a future edit to the centralized helper won't reach this copy, a real drift-to-leak risk.

**Overlaps with pending OpenSpec changes — handle there, not as a standalone style sweep:**

- `observability-and-perf-hardening` — covers the env-config logger violation (`search.service.ts:58-68`) and its 3-file duplication (same block in review/weekly-report/report-sections services); fix logger construction once, centrally, under that change rather than patching `search.service.ts` alone.
- `tighten-code-quality-ratchet` — covers the size-complexity splits (`search()`, `query()`) and the magic-number/constant extractions (search language, snippet cap, headline options); these are exactly the kind of function-size/magic-literal ratchet that change is meant to enforce repo-wide.
- `tighten-comment-policy` — covers all 5 comment findings (module header narration, JSDoc over-budget, ticket-code archaeology); apply the comment trims module-by-module under that change instead of one-off here.

Not mapped to any pending change: `search.service.ts:111-118` (groupIds duplication of `computeAllowedGroupIds`) — no pending change owns cross-module authz-helper reuse; fix directly in this file.

## Killed by verification

None — all 13 findings held up.
