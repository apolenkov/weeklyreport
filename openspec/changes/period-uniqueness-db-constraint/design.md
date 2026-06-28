## Context

The `Report` model comment (`prisma/schema.prisma` ~line 223) advertises a
partial unique index `Report_one_open_per_boundary` "defined via raw
migration", but the init migration's hand-written tail
(`prisma/migrations/20260530162224_init/migration.sql`, after line 723)
contains only two hand-edited constructs: `Risk_severity_check` and
`ReopenRequest_one_pending_per_section`. The promised period index is
absent.

Period uniqueness is currently best-effort at the application layer:

- Admin manual create/update — `period-admin.service.ts` calls
  `findOverlappingPeriod` (a `findFirst` half-open intersect over ALL
  states) and then `createPeriodManual` / the update issues a bare
  `report.create` / `report.update`. Read and write are separate
  round-trips with no transaction → classic time-of-check/time-of-use
  race.
- First login — `auth.routes.ts::ensureWeeklyReport` does `findFirst`
  (draft + week range) then `report.create` with `periodState` defaulting
  to `'open'`. Two first-logins in the same week both miss the read and
  both insert.

There is no DB backstop, so today the race silently produces duplicate
open periods. Once the index exists the loser of the race gets a Prisma
`P2002`; without a catch that becomes a 500.

This is the period-creation analog of `reopen-request-lifecycle (D5)`,
which already pairs a hand-written partial unique index with a `P2002`
catch (`report-sections/lead-form.prisma-repository.ts::createReopenRequest`
→ `ReopenRequestError`). This change reuses that exact pattern.

## Goals / Non-Goals

**Goals:**

- Make the schema comment true: add `Report_one_open_per_boundary` so the
  DB rejects two open periods sharing a boundary.
- Convert the `P2002` into the existing friendly outcomes: `AdminPeriodOverlapError`
  on the admin paths, a transparent re-read on the login path.
- Prove the index has teeth with a real-DB test and prove each catch
  guards a real translation.

**Non-Goals:**

- True cross-range overlap of distinct boundaries (e.g. `[1..7]` vs
  `[4..10]`) and overlap involving a `scheduled` period. These stay
  application best-effort via `findOverlappingPeriod`.
- A `btree_gist` exclusion constraint (the only DB tool that backstops
  true range overlap). Considered and deferred — see Decisions.
- Any change to the period state machine's transition LOGIC, the field set
  `buildTransition` emits, or the `period-dual-state` invariant. This change
  does wrap the writers that move a row into `periodState = 'open'` with a
  `P2002` catch (see D5), but it does not change what they write on success.

## Decisions

### D1 — Partial unique index, not a btree_gist exclusion constraint

Add exactly what the comment promised:

```sql
-- one open period per boundary: at most one Report may sit on a given
-- (periodStart, periodEnd) while periodState='open'. Prisma cannot express
-- a WHERE-clause partial unique index, so it is hand-written here next to
-- ReopenRequest_one_pending_per_section. Closed periods are unconstrained.
CREATE UNIQUE INDEX "Report_one_open_per_boundary"
  ON "Report"("periodStart", "periodEnd")
  WHERE "periodState" = 'open';
```

Alternative considered: a `btree_gist` exclusion constraint with a
`daterange(...) WITH &&` predicate restricted to `periodState='open'`. That
is the _correct_ tool for true non-overlap of distinct ranges. Rejected for
this change because: (a) the comment, the existing app gate's most common
collision (identical week bounds from the scheduler + manual + login
paths), and the actual reported race are all exact-boundary; (b) it pulls
in `CREATE EXTENSION IF NOT EXISTS btree_gist`, a new infra dependency; (c)
it is meaningfully more scope than "make the comment true". It is recorded
as the deferred upgrade if cross-range overlap ever becomes a real defect.

### D2 — MVP disposable-DB: hand-edit the init migration, then reset

Per the repo's MVP policy, do NOT author an incremental alter-table
migration. Edit the single init migration's hand-written tail, then
`prisma migrate reset` to re-apply. The hand-edited index lands ONLY via
`migrate reset` (a `migrate deploy` skips the same-named, already-applied
migration), and `_dev` / `_test` reset independently — resetting one does
not touch the other.

### D3 — Catch P2002 at the repository boundary, reuse existing domain error

Mirror `createReopenRequest`: wrap the `report.create` (and the update's
`report.update`) in try/catch, and on
`error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'`
throw `AdminPeriodOverlapError` with the same friendly message family the
pre-check raises. The error-mapper already maps `AdminPeriodOverlapError`
→ `BAD_REQUEST`, so no mapper change is needed. The narrow check is safe
because the only unique constraint on `Report` that an open-period insert
can hit is `Report_one_open_per_boundary`; defensively assert on
`error.meta.target` / index name so a future second unique constraint does
not get mis-translated.

### D4 — ensureWeeklyReport re-reads by the index predicate on P2002

On `P2002`, re-read the row that actually triggered the violation and
continue with its id; on any other error, re-throw unchanged (the spec's
"non-P2002 failures still propagate" scenario).

The re-read MUST key on the index predicate — the `Report` on the computed
week bounds with `periodState = 'open'` — NOT on `status = 'draft'`. The
index covers `periodState = 'open'`, which (per the schema comment at
schema.prisma lines 205-210 and the `period-dual-state` spec) ALSO covers a
reopened period: on reopen `periodState` reverts to `'open'` while `status`
stays `'published'` and `periodStatus = 'reopened'`. So when a period is
reopened within its own current week, the colliding row is published, both
`status = 'draft'` lookups in `ensureWeeklyReport` miss it, the create hits
`P2002`, and a `status = 'draft'` re-read would also miss it — leaving
recovery empty. Re-reading by boundary + `periodState = 'open'` resolves the
real blocker (draft or reopened) and makes concurrent first-logins
converge instead of 500.

### D5 — The index constrains UPDATEs into 'open', not just inserts, so every open-writer must catch P2002

A partial unique index fires on any row that ends up matching its predicate,
whether it arrived there via `INSERT` or via `UPDATE`. So the index does not
only guard the two insert paths in D3/D4 — it also rejects any UPDATE that
moves a second row into `(periodStart, periodEnd, periodState='open')`. The
writers that can do this, and the prescribed handling, are:

- `PeriodCreatorScheduler.report.create` (insert) — the proposal names the
  scheduler race (two API instances, scheduler vs manual/login) explicitly,
  yet D3/D4 only cover admin create/update and login. On `P2002` the cron
  tick MUST treat the period as already-created (re-read the open row on the
  boundary, or skip the tick) and return a non-error outcome; an uncaught
  `P2002` would crash the scheduled job. Unrelated errors re-throw.
- `PeriodCreatorScheduler` `scheduled → open` flip (`updateMany`, ~line 83) —
  flipping a scheduled row to `open` while another open row already holds the
  same boundary (or two scheduled rows sharing a boundary flip together)
  raises `P2002`. Handle the same way as the scheduler create: treat as a
  benign already-open collision, do not crash the tick.
- `reopenPeriod` (`period.prisma-repository.ts`) and `unarchivePeriod`
  (`admin-period.queries.ts`) — both can set `periodState = 'open'` on an
  existing row. If another open row already holds that boundary the update
  raises `P2002`. These are admin-triggered, so translate to the domain
  overlap error (→ `BAD_REQUEST`) like D3, never a 500.

The narrow `P2002`-on-`Report_one_open_per_boundary` assertion from D3
applies to all of these — an unrelated unique violation re-throws. The
`publication` "open" write (`publication.prisma-repository.ts` ~line 54) is
NOT in scope: it updates an already-open draft row to `open`, which is a
no-op against the predicate and cannot collide with a sibling.

## Before / After data flow

Admin manual create (collision case):

- Before: `findOverlappingPeriod` (miss, lost race) → `report.create` →
  duplicate open period committed, no error → two open periods for one
  boundary.
- After: `findOverlappingPeriod` (miss) → `report.create` → DB rejects with
  `P2002` → repository throws `AdminPeriodOverlapError` → tRPC `BAD_REQUEST`
  → admin sees the friendly overlap toast.

First login (collision case):

- Before: `findFirst` (miss) → `report.create` → second create succeeds →
  duplicate week period; or (post-index, no catch) → 500.
- After: `findFirst` (miss) → `report.create` → `P2002` caught → re-read by
  boundary + `periodState='open'` (resolves a draft OR a reopened-published
  blocker) → both logins resolve the same `reportId`.

Auto-period scheduler tick (collision case):

- Before: mostRecent check (miss, lost race vs another instance / manual) →
  `report.create` → duplicate open period; or (post-index, no catch) → the
  cron tick throws and the job fails.
- After: `report.create` → `P2002` caught → tick treats the period as
  already-created (re-read or skip) and returns a benign outcome; the
  `scheduled → open` flip catches the same `P2002` and degrades gracefully.

Admin reopen / unarchive into a contested boundary (collision case):

- Before (post-index, no catch): the lifecycle update raises `P2002` and the
  admin sees a 500.
- After: the update's `P2002` is translated to `AdminPeriodOverlapError`
  (→ `BAD_REQUEST`), surfacing the friendly overlap message instead.

## Invariants touched

- `period-dual-state` — preserved, untouched. The index keys only on
  `periodStart`, `periodEnd`, `periodState`; no writer's field set changes.
  The transition writers (`reopen` / `unarchive` / `scheduled → open`) are
  wrapped with a `P2002` catch (D5) but their emitted field set is unchanged,
  so the dual-state atomic-write invariant still holds on the success path.
- `destructive-db guard` — `migrate reset` runs under the standing MVP
  authorization; `_test`/`_dev` suffix rules still apply.
- `role-coverage gate`, `deferred-feature pattern` — not touched.

## Risks / Trade-offs

- [Existing duplicate open periods would make `migrate reset` fail to build
  the index] → in MVP the DB is reseeded from scratch on reset, and seeds
  produce at most one open period per boundary; verify post-reset that the
  index created cleanly.
- [Narrow `P2002` catch could mask a different future unique violation on
  `Report`] → assert on the index/constraint name in the catch, not just
  the bare code, so an unrelated `P2002` re-throws.
- [The index does NOT cover cross-range overlap or scheduled-vs-open
  overlap] → explicitly documented as best-effort in the comment and spec;
  `findOverlappingPeriod` remains the broader (non-atomic) guard.

## Migration Plan

1. Add the `CREATE UNIQUE INDEX` to the init migration tail; update the
   schema comment to state the truth + the best-effort caveat.
2. `prisma migrate reset` on `_dev`, then on `_test` (independent), with
   `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` set; `prisma generate`.
3. Add the `P2002` catch in the admin create/update repository path, in
   `ensureWeeklyReport`, in the `PeriodCreatorScheduler` create and
   `scheduled → open` flip, and in `reopenPeriod` / `unarchivePeriod` (D5).
4. Add the real-DB index test and the translation tests; run the full
   gate.

Rollback: drop the index and the catches; no data migration since the DB
is disposable.

## Open Questions

- None blocking. The cross-range / scheduled-overlap DB backstop
  (`btree_gist`) is deliberately deferred, not open.
