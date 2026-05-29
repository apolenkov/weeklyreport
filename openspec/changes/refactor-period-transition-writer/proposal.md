# Refactor: single Period transition writer

## Problem

A published report can end up permanently inconsistent. The `Report` row
carries three coupled lifecycle machines — `periodState` (canonical),
`periodStatus` (reopen flavour), and the legacy `status`/`archived` tuple —
plus audit flags (`autoPublished`/`autoArchived`) and timestamps. No database
constraint ties them together; the `period-dual-state` invariant is the only
contract, and it relies on every writer remembering the full field set.

Today **nine write statements across five files** each hand-assemble that set,
each slightly differently. The `period-state.ts` helper that exists to mint the
new column from the legacy fields is _passive_ — `publishPeriod`,
`reopenPeriod`, and the auto-publisher inline their assignments and never call
it. Only `initialPeriodState()` is actually used.

The concrete failure: `auto-publisher` writes the legacy fields in one
transaction (`publishAuto`) and `periodState` in a **second** transaction. The
candidate query selects `status: "draft"`, so if the first transaction commits
and the second fails, the now-published report is never re-selected and stays
permanently divergent (`status="published"`, `periodState` stale). This is a
live violation of the invariant's "never in separate database round-trips" rule.

## Solution

Introduce one deep module that owns every legal lifecycle transition. Callers
express intent (`publish`, `autoPublish`, `reopen`, `archive`, `autoArchive`,
`schedule`, `open`, `create`); the module produces the **complete** field set
for that transition in a single atomic write. A pure builder
(`buildTransition(kind, ctx) → Prisma.ReportUpdateInput`) is unit-testable
without a database and absorbs `period-state.ts`; a thin applicator runs inside
the caller's `tx` and returns the row (so `publishPeriod` can still build its
snapshot atomically). A CI gate forbids raw `report.update`/`create` writes of
lifecycle fields outside the module — giving the invariant the machine
enforcement the spec admits it currently lacks.

## Non-goals

- **Path B — collapsing the duality.** Migrating the ~45 reader files off the
  legacy fields and dropping `status`/`archived`/`periodStatus` is a separate,
  much larger effort with no current owner. This change makes that migration
  _safer_ later; it does not attempt it.
- **A database CHECK constraint** across the columns. Deferred; the MVP
  `migrate reset` freedom makes it premature.
- **The period identity tuple** (year/week/quarter). It is written only at
  creation, does not transition, and is out of scope for this module.
