## Why

BL-03 (P0), `docs/reviews/repo-excellence-review-2026-07-14.md`.

`flipDueScheduledToOpen`
(`apps/api/src/modules/period/infrastructure/period-creator.scheduler.ts`,
lines 34-72) writes each due row with an unconditional PK-only update:
`report.update({ where: { id: row.id }, data: buildTransition("open", {}) })`
— no `periodState: 'scheduled'` re-assertion. Every sibling lifecycle writer
in this codebase guards its write instead: `AutoArchiverScheduler` uses
`updateMany({ where: { id, archived: false, periodStatus: 'published' }, ... })`
and treats `count === 0` as a benign concurrent-writer skip (see
`auto-archiver.scheduler.ts` lines 93-104); publish/reopen use the same
compare-and-set idiom. The scheduled→open flip is the one exception: if an
admin archives (or otherwise transitions) the row between the `findMany` scan
(line 39) and the `update` (line 50) — both inside the once-daily cron tick —
the unconditional update silently overwrites that concurrent write, resetting
`archived: false` and `periodState: 'open'` (TOCTOU lost-update).

Separately, `Report_one_open_per_boundary` (`prisma/migrations/20260530162224_init/migration.sql`,
lines 506-508) is `WHERE periodState = 'open'` only. Two concurrent creators
(e.g. an overlapping cron re-entry, or a login-create racing the cron) can
each insert a `scheduled` row for the same boundary with no `P2002` — the
uniqueness guarantee only starts once a row transitions to `open`. A
duplicate `scheduled` row that loses the later open-boundary race is never
cleaned up: it sits permanently orphaned, re-scanned and warn-logged every
tick (`period-creator.scheduler.ts` lines 65-69 handle the open-side
collision but do not delete the loser).

## What Changes

- `flipDueScheduledToOpen`'s per-row write becomes a guarded
  `updateMany({ where: { id: row.id, periodState: 'scheduled' }, data:
buildTransition('open', {}) })`. A `count === 0` result is a logged skip
  (mirroring the auto-archiver's `count === 0` branch) — the row was
  concurrently transitioned away from `scheduled` by another writer (e.g. an
  admin archive) and the flip correctly backs off instead of clobbering that
  write.
- Duplicate-`scheduled`-row prevention: broaden the boundary uniqueness
  guarantee to also cover `scheduled` rows (extend the partial unique index,
  or an equivalent reconcile/delete-orphan step at flip time), so two
  concurrent creators cannot both persist a `scheduled` row for the same
  `(periodStart, periodEnd)` boundary.
- The factory's docstring blanket "one row per boundary" claim
  (`period-factory.ts`) is corrected to describe the actual guarantee once
  the fix lands (either "one row per boundary across scheduled AND open," if
  the index is broadened, or the precise narrower guarantee if a
  reconcile-based fix is chosen instead).

## Claim disposition

| Sub-claim                                                                                         | Disposition   | Note                                                                                              |
| ------------------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------- |
| Unconditional PK-only update can clobber a concurrent archive inside the cron tick                | **Confirmed** | read directly from `flipDueScheduledToOpen`; contrasts with every sibling writer's guarded update |
| Partial unique index only covers `open`, not `scheduled`                                          | **Confirmed** | read directly from `migration.sql` line 508                                                       |
| Two concurrent creators can mint duplicate `scheduled` rows for the same boundary with no `P2002` | **Confirmed** | mechanism follows directly from the index's `WHERE` predicate                                     |
| Orphaned duplicate `scheduled` row self-heals or gets cleaned up today                            | **Refuted**   | current code only handles the `open`-side collision (logs, does not delete)                       |
| Fix requires touching `AutoArchiverScheduler` or `AutoPublisherScheduler`                         | **Non-goal**  | those already use the guarded pattern; this change only ports it to the scheduled→open flip       |

## Non-goals

- Not changing `AutoArchiverScheduler`'s or `AutoPublisherScheduler`'s
  already-correct guarded-write pattern — this change ports their idiom to
  `flipDueScheduledToOpen`, it does not touch them.
- Not changing the daily `@Cron("5 0 * * *")` schedule or the
  `runOnce(now)` test-seam contract.
- Not changing `ensureCurrentPeriod`'s create-path race guard
  (`isOpenBoundaryConflict` / `P2002` recovery on the open-boundary insert)
  — that mechanism is correct and orthogonal; this change addresses the
  scheduled-boundary gap it does not cover.
- Not adding audit-logger wiring changes — `period-scheduler-wiring`'s
  existing audit-sink requirements are unaffected; this change ADDs new
  requirements to that spec file, it does not modify the audit ones.

## File manifest

- `apps/api/src/modules/period/infrastructure/period-creator.scheduler.ts` —
  guard `flipDueScheduledToOpen`'s update with `periodState: 'scheduled'` and
  handle `count === 0` as a logged skip.
- `apps/api/src/modules/period/infrastructure/period-creator.scheduler.test.ts`
  — new test: a concurrent archive committed between scan and flip is not
  clobbered; the flip skips and logs instead.
- `apps/api/src/modules/period/application/period-factory.ts` — correct the
  docstring's "one row per boundary" claim to match the actual (post-fix)
  guarantee; touch the duplicate-scheduled-row prevention here if the chosen
  fix is a reconcile/delete-orphan step rather than an index change.
- `apps/api/src/modules/period/application/period-factory.test.ts` — test
  coverage for whichever duplicate-prevention mechanism is chosen.
- `prisma/migrations/20260530162224_init/migration.sql` — hand-edit
  `Report_one_open_per_boundary` (or add a new partial unique index) if the
  chosen fix broadens the index to cover `scheduled`, per the MVP-phase rule
  that the single init migration is hand-edited directly, not appended to.
- `prisma/schema.prisma` — matching index declaration/comment update if the
  migration SQL changes (Prisma's schema DSL cannot express the partial
  `WHERE`, so this stays a schema-level index annotation the migration SQL
  implements by hand, per the existing pattern at lines 494-508 of the
  migration).

## Verification

- `pnpm --filter @customreport/api db:generate`
- `pnpm typecheck && pnpm lint && pnpm test`
- `cd apps/api && pnpm test:integration` — required: this is a DB write-path
  fix (guarded update + a partial unique index / reconcile step) that must
  be proven against real Postgres constraint behavior, not just mocked
  Prisma calls.
- If the migration SQL changes: `prisma migrate reset` (per-DB, MVP-phase
  hand-edited-migration rule) then re-run the integration suite to confirm
  the new/broadened index actually enforces uniqueness against concurrent
  inserts.

## Sequencing

Independent of `lead-draft-save-integrity` and `cross-author-comments-privacy`
(different subsystem). If a migration SQL change is chosen for the
duplicate-scheduled-row fix, land this before any other in-flight change
that also hand-edits `prisma/migrations/20260530162224_init/migration.sql`,
to avoid a merge collision on the single init migration file.
