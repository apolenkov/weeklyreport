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

The concrete failure (verified against the tree): `auto-publisher` publishes in
two database round-trips. `publishAuto → saveAssembledReport` (tx1) writes
`status` and `periodState` together — but **never `periodStatus`** — then the
scheduler's own `report.update` (tx2) adds `autoPublished` (and a redundant
`periodState`). Two distinct divergences result:

1. **Permanent, even when both transactions succeed.** Manual `publishPeriod`
   writes `periodStatus="published"`; the auto path writes it in neither tx1
   nor tx2, so an auto-published report is stuck at the default
   `periodStatus="open"` forever. The reopen-flavour machine silently disagrees
   with `status`/`periodState` on every auto-published report.
2. **A torn-write window.** If tx1 commits and tx2 fails, the candidate query
   (`status: "draft"`) never re-selects the now-`published` row, so
   `autoPublished` stays `false` permanently.

Both are live violations of the invariant's "assemble the complete field set in
one round-trip" rule — the auto path assembles the set neither completely nor
atomically.

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
