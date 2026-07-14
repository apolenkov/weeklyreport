## Why

BL-12, P1, `docs/reviews/repo-excellence-review-2026-07-14.md`.

`getAssembledReport` (`apps/api/src/modules/publication/application/publication.service.ts`)
sorts sections by `left.authorName.localeCompare(right.authorName, "ru")`
(`compareSections`, lines 121-125) for the head's live preview. The durable
frozen snapshot every viewer/lead subsequently reads is built by
`buildAssembledReportFromPrismaRow` (`apps/api/src/modules/published-report-snapshot.ts:28-52`,
NOT under `publication/application/` despite the review doc's path — the
review doc's file location is slightly off, confirmed by reading the actual
tree) from `reportFullIncludeForSnapshot` (same file, lines 15-18):

```ts
export const reportFullIncludeForSnapshot = {
  sections: { include: reportSectionFullInclude },
  publishedBy: true,
} as const satisfies Prisma.ReportInclude;
```

There is no `orderBy` on the `sections` relation, and
`buildAssembledReportFromPrismaRow` maps `row.sections` directly with no
re-sort before schema validation. So the published artifact renders
sections in whatever order Postgres/Prisma happens to return for the
include — arbitrary, and able to shift across reads or across databases —
while the live preview is deterministically author-sorted. This include is
reused by `period.prisma-repository.ts:101` and
`publication.prisma-repository.ts` (lines 36, 55, 129), so the gap is not
confined to one call site.

## What Changes

- Add an `orderBy` on the `sections` relation in
  `reportFullIncludeForSnapshot` that matches `compareSections`'s ordering
  intent (author name), so the durable snapshot is deterministic at freeze
  time and agrees with the preview it is frozen from.
- Because Prisma's `orderBy` on a relation cannot apply a locale-aware
  `localeCompare("ru")` collation directly, use the DB-level ordering that
  best approximates it (e.g. `orderBy: { author: { name: "asc" } }` if
  `authorName` is sourced through a relation, or the raw column with
  Postgres's default collation) and confirm in review whether a follow-up
  DB-collation fix is needed for full Cyrillic-locale parity — record any
  residual gap as a documented limitation rather than silently accepting a
  mismatch.
- No change to `getAssembledReport`/`compareSections` itself — it remains
  the reference ordering; this change makes the snapshot match it, not the
  other way around.

## Claim disposition

| Claim (review doc)                                                   | Disposition | Note                                                                                                                                                                       |
| -------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Preview is author-sorted, durable snapshot has no orderBy            | CONFIRMED   | `reportFullIncludeForSnapshot` (`published-report-snapshot.ts:15-18`) has no `orderBy`; `buildAssembledReportFromPrismaRow` (28-52) does not re-sort.                      |
| File location `publication/application/published-report-snapshot.ts` | CORRECTED   | Actual path is `apps/api/src/modules/published-report-snapshot.ts` — one level up, not under `publication/application/`. `publication.service.ts` IS at the reviewed path. |
| Include reused by multiple repositories                              | CONFIRMED   | `period.prisma-repository.ts:101`, `publication.prisma-repository.ts:36,55,129`.                                                                                           |

## Non-goals

- Not changing `getAssembledReport`'s live-preview sort — it is already
  correct and is the target this change matches.
- Not adding re-sort logic downstream of the snapshot (e.g. in the router or
  read model) — the fix belongs at the query (`orderBy` in the include) so
  the DB does the work once, at freeze time, not on every read.
- If DB-level ordering cannot fully replicate `localeCompare("ru")`
  collation semantics, this change does not attempt an application-level
  post-sort as a workaround — that would reintroduce the "preview vs
  snapshot use different sort implementations" risk this change is meant to
  close. A documented residual gap is preferable to a second sort path.

## File manifest

- `apps/api/src/modules/published-report-snapshot.ts` —
  `reportFullIncludeForSnapshot` (15-18): add `orderBy` on `sections`.
- `apps/api/src/modules/publication/application/publication.service.ts` —
  read-only reference for `compareSections` (121-125); no change.
- `apps/api/src/modules/weekly-report/weekly-report.prisma-repository.ts` —
  read to confirm whether it independently queries sections without this
  shared include (review doc lists it among the affected files); apply the
  same `orderBy` there if it has its own separate query construction.
- `apps/api/src/modules/publication/application/publication.service.test.ts`
  — add a test that the snapshot path's section order matches
  `compareSections`'s ordering for the same input set.
- `apps/api/src/modules/publication/infrastructure/publication.prisma-repository.test.ts`
  — currently mocks `buildAssembledReportFromPrismaRow`/
  `reportFullIncludeForSnapshot` as stubs (lines 10, 12), so it does not
  exercise real ordering; add or extend an integration test instead (see
  Verification).
- `apps/api/src/modules/publication/publication.integration.test.ts` — add
  the determinism assertion against a real seeded multi-author report.

## Verification

- `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test`
- `cd apps/api && pnpm test:integration` — required: `orderBy` correctness on
  a real Postgres include can't be proven by a mocked repository test.
- Integration test: seed a report with sections from at least three authors
  in a non-alphabetical creation order; fetch the frozen snapshot twice
  (potentially forcing a heap-order-perturbing operation like a vacuum or a
  second unrelated write between reads, or at minimum asserting order
  equality across two independent reads); assert section order is stable
  and matches `compareSections`'s ordering of the same authors.

## Sequencing

No ordering dependency on other P1 changes in this batch. Independent of
`session-hydration-error-scoping`, `record-comment-save-coordination`,
`admin-entity-write-integrity`, and `group-scope-isolation-gaps` (no shared
files).
