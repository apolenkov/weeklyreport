# Per-file audit — apps/api/src/modules/archive (2026-07-02)

Read-only audit, wave 1 (no edits made).
4 files reviewed: `archive-cursor.ts`, `archive.module.ts`, `archive.prisma-repository.ts`, `archive.service.ts`.
7 findings kept, 0 killed by verification.

## archive.prisma-repository.ts (3 findings)

| Lines                 | Dimension  | Severity | Finding                                                                                                                                                                                                                                                                                                                                                  | Suggestion                                                                                                                                                                                                 | Your verdict |
| --------------------- | ---------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 28-41                 | comments   | high     | 14-line JSDoc on `PUBLISHED_FLOOR` mixes ticket/phase archaeology (`AUTH-04 (Phase 28-01)`, `A22:`) with load-bearing WHY (defense-in-depth floor semantics), 4-5x over the 3-line comment budget. The same rationale is re-explained in `archive.service.ts:19-27` and `:60-67` — stated three times across two files.                                  | Strip the ticket tags (git history owns those). Move the defense-in-depth contract to an openspec spec/ADR once; leave a <=2-line pointer here. Delete the duplicate restatements in `archive.service.ts`. |              |
| 223-227               | comments   | medium   | 5-line JSDoc on `sectionScopeWhere` opens with the ticket reference `UFB-040 / Phase 46-03` — change-log archaeology the comment-hygiene policy classifies as noise.                                                                                                                                                                                     | Remove the ticket/phase prefix; keep only the one-line WHY (`undefined means no scope filter applies`) within the 3-line budget.                                                                           |              |
| 47-58, 80-98, 100-117 | parameters | medium   | `ArchiveRepository.listArchiveReports`/`getArchiveReport` and the matching `ArchiveService` methods each take 3 positional optional/mixed parameters (pagination, filter/role, session) — at the profile's own >=3 threshold for switching to an options object; the shape is repeated identically across interface, service, and Prisma implementation. | Collapse to a single options object, e.g. `listArchiveReports(query: { pagination?; role?; session? })`, threaded through interface, service, and `archive.prisma-repository.ts` together.                 |              |

Already good: good decomposition into small private helpers (`fetchArchivePage`, `buildSummaries`, `loadFallbackGraphs`) each doing one thing; `PUBLISHED_FLOOR` is a single named constant enforcing the defense-in-depth floor rather than a scattered literal; `ArchiveListRow`/`ArchiveFullRow` typed via `Prisma.GetPayload` + `satisfies` keeps the query shape and its consumer in sync.

## archive.service.ts (2 findings)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                                                                                                    | Suggestion                                                                                                                                      | Your verdict |
| ----- | --------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 19-27 | comments  | medium   | 9-line JSDoc on `ArchiveReadFilter` carries the ticket ref `AUTH-04 (Phase 28-01)` and restates the same floor/widen-vs-narrow rationale already documented (also over-budget) on `PUBLISHED_FLOOR` in `archive.prisma-repository.ts:28-41` — duplicated WHY across files. | Delete the ticket prefix; keep at most a 2-line pointer to the single relocated ADR/spec explanation instead of re-deriving the rationale here. |              |
| 60-67 | comments  | medium   | 8-line JSDoc on `buildArchiveReadFilter` again carries `AUTH-04 (Phase 28-01)` and re-explains the same floor contract a third time (see lines 19-27 and `archive.prisma-repository.ts:28-41`).                                                                            | Collapse to a <=2-line pointer to the relocated spec/ADR; the function body plus the schema types already make the narrowing behavior legible.  |              |

Already good: thin domain service that stays Prisma-free (`ArchiveReadFilter` is a plain interface, not an import of `@prisma/client`), with a dedicated `ArchiveDomainError` instead of a generic throw, and `buildArchiveReadFilter` extracted as a small pure/testable function.

## archive-cursor.ts (2 findings)

| Lines | Dimension | Severity | Finding                                                                                                                                                                                     | Suggestion                                                                                                                                                                                                                 | Your verdict |
| ----- | --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 8-14  | comments  | low      | 7-line JSDoc on `encodeArchiveCursor` explaining why a keyset cursor is used instead of Prisma's cursor/skip — genuinely load-bearing WHY but more than double the 3-line comment budget.   | Trim to the essential sentence (keyset, not Prisma cursor: the coordinate is self-contained and survives the anchor row being deleted); if the fuller rationale is worth preserving, relocate it to a short ADR/spec note. |              |
| 22-27 | comments  | low      | 6-line JSDoc on `decodeArchiveCursor` is over the 3-line budget, restating why malformed cursors return null vs throw — but the throwing decision actually happens in the caller, not here. | Shorten to 1-2 lines; move the "why 400 not silent restart" rationale to `withArchiveKeyset` in `archive.prisma-repository.ts` where that decision is actually made (already partly duplicated there at lines 209-211).    |              |

Already good: small, pure, single-purpose encode/decode pair; `CURSOR_SEPARATOR` is a named constant instead of an inline `|`; malformed input returns null rather than throwing, pushing the throw/400 decision to the caller — clean layering.

## archive.module.ts — clean

Already good: minimal, consistent with the repo-wide `useFactory` DI pattern used across every other module (verified against organization/weekly-report/publication/etc.) — no bespoke wiring.

## Rollup

**By dimension:**

- comments: 6 (1 high, 3 medium, 2 low)
- parameters: 1 (medium)

**By severity:**

- high: 1
- medium: 4
- low: 2

**Top-3 highest-impact:**

1. `archive.prisma-repository.ts:28-41` (high) — the `PUBLISHED_FLOOR` JSDoc is the root of a 3-way duplicated rationale (also in `archive.service.ts:19-27` and `:60-67`); fixing it once and pointing the other two at it removes the bulk of this module's comment debt in one edit.
2. `archive.service.ts:19-27` and `:60-67` (medium x2) — same AUTH-04 restatement, downstream of finding #1.
3. `archive.prisma-repository.ts:47-58,80-98,100-117` (medium) — 3-positional-parameter shape repeated across interface/service/repository; the options-object refactor touches three files at once, so it's worth batching with any other archive-module signature change rather than doing it in isolation.

**Overlap with pending openspec changes:** none.
All 7 findings are pure code-hygiene (comment archaeology/duplication, parameter-count) confined to `apps/api/src/modules/archive`. None of them touch archive-related pending changes in the list (`fix-manual-publish-archive-race`, `transactional-snapshot-restore`, `scope-period-lifecycle-authz`, etc.) — those are behavioral/authz/concurrency work, not the surface these findings sit on. Safe to treat as a standalone style sweep, not folded into an in-flight change.

## Killed by verification

None — all 7 raised findings were verified and kept as-is.
