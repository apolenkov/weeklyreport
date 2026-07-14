## Why

BL-09, P1, `docs/reviews/repo-excellence-review-2026-07-14.md`.

`insertComment` (`apps/api/src/modules/review/infrastructure/review-actions.prisma-repository.ts:111-139`)
is a bare `prisma.recordComment.create` anchored to an Item/Risk/Decision by
raw PK, with no transaction and no lock. `getRecordAnchorGroup` (lines
74-101) resolves that anchor in a separate, earlier round-trip. Meanwhile
`saveSection` (`apps/api/src/modules/report-sections/infrastructure/report-sections.prisma-repository.ts`,
`$transaction` starting ~line 110) takes a `Report` row `SELECT ... FOR
UPDATE` (129-131), CASes `ReportSection.version` (147-157), captures existing
comments by stableId (`captureRecordComments`, line 169), then
delete-recreates Item/Risk/Decision/ProjectStatus/StageStatus/ActivityStatus
under new PKs (171-267) and reinserts only the captured survivors. Because
`insertComment` never joins that lock:

- (a) a reviewer's comment that commits after `captureRecordComments` reads
  but before the `deleteMany` runs is cascade-deleted (`RecordComment` FKs
  cascade) and never reinserted — silent loss, no error to the reviewer.
- (b) a comment insert whose anchor PK is deleted by a concurrent
  `saveSection` before the `create` executes raises Prisma `P2003` with no
  handler in `insertComment` — a raw, unhandled 500.

`postVerdict` (184-243) already solves the identical shape with a
transaction + version CAS; the comment write path was left version-blind.

## What Changes

- `insertComment` resolves its anchor and inserts the comment inside a
  single transaction that participates in the same lock order `saveSection`
  uses: either the transaction takes the `Report` row `FOR UPDATE` (same
  predicate `saveSection` uses) before the anchor lookup + insert, or it
  performs a `ReportSection.version` compare-and-set against the
  caller-supplied version so a concurrent `saveSection` that has already
  advanced the version is detected instead of silently racing.
- Anchor resolution keys off the record's durable `stableId` lineage (the
  same lineage `captureRecordComments`/`reinsert` already use), not the
  possibly-already-recreated raw PK, so a comment posted mid-save still
  lands on the record's logical identity.
- At minimum (belt-and-suspenders, independent of the transaction fix):
  `insertComment` catches Prisma `P2003` (FK violation — anchor no longer
  exists) and returns a typed conflict/not-found error instead of an
  unhandled 500.

## Claim disposition

| Claim (review doc)                                                                    | Disposition | Note                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) comment committing between capture and delete is cascade-lost                     | CONFIRMED   | `captureRecordComments` runs once at line 169, before the 171-267 delete-recreate block; nothing re-checks for comments written after that read within the same transaction, and `insertComment` runs in a wholly separate, unlocked transaction. |
| (b) anchor-PK race raises unhandled P2003                                             | CONFIRMED   | `insertComment` has no try/catch around `prisma.recordComment.create`; grep of the review module shows no P2003 handling anywhere in `review-actions.prisma-repository.ts`.                                                                       |
| "postVerdict already uses a version compare-and-set; comment path left version-blind" | CONFIRMED   | `postVerdict` 196-204 does a version-guarded `updateMany` CAS before writing `SectionReview`; `insertComment` has no equivalent.                                                                                                                  |

## Non-goals

- Not changing `postVerdict`'s existing CAS — it already does the right
  thing and is the pattern this change follows, not extends.
- Not adding a lock/CAS to comment _reads_ (`getRecordAnchorGroup` used for
  display) — only the write path (`insertComment`) is in scope.
- Not restructuring `saveSection`'s delete-recreate strategy itself (e.g.
  switching to in-place update) — out of scope; this change only makes the
  comment write coordinate with the existing strategy.

## File manifest

- `apps/api/src/modules/review/infrastructure/review-actions.prisma-repository.ts`
  — `insertComment` (111-139), `getRecordAnchorGroup`/`loadAnchorSectionGroup`
  (74-101): wrap in a transaction with the report-row lock or version CAS;
  resolve anchor by stableId; catch `P2003`.
- `apps/api/src/modules/report-sections/infrastructure/report-sections.prisma-repository.ts`
  — no functional change expected; read to confirm the exact `FOR UPDATE`
  predicate (129-131) and version-CAS shape (147-157) that `insertComment`
  must match, and to confirm the stableId lineage `captureRecordComments`
  uses.
- `apps/api/src/modules/review/infrastructure/review-actions.integration.test.ts`
  — add the concurrency-shaped tests below.
- `apps/api/src/modules/review/infrastructure/review-actions.prisma-repository.test.ts`
  — unit tests for the new P2003 handling and anchor-by-stableId lookup.

## Verification

- `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test`
- `cd apps/api && pnpm test:integration` — required: this is a
  transaction/locking fix across two repositories against the real DB.
- Concurrency-shaped integration test (two racing calls), single-thread per
  `integration-gate-single-thread-and-docker-up`:
  1. Start a `saveSection` transaction, pause it after
     `captureRecordComments` but before the delete-recreate (test hook or
     explicit two-phase transaction control).
  2. Concurrently call `insertComment` against the same record.
  3. Let `saveSection` complete.
  4. Assert: either the comment is preserved through the recreate (survives
     reinsert), or `insertComment` observes the version conflict and returns
     a typed error — never a silent drop and never a raw 500.
     Second scenario: delete the anchor record via `saveSection` first, then
     call `insertComment` against the now-deleted PK — assert a typed
     conflict/not-found response, not an unhandled `P2003`.

## Sequencing

No ordering dependency on other P1 changes in this batch. Independent of
`session-hydration-error-scoping` and `admin-entity-write-integrity` (no
shared files).
