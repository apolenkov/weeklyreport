# Design: single Period transition writer

## Governed field set

The transition module is the sole writer of the **lifecycle** fields on
`Report`. Naming them explicitly resolves the looseness in the current
`period-dual-state` spec (whose Purpose mentions the year/week/quarter identity
tuple, while its scenarios imply `status` is also protected):

| Field                                          | Machine        | Notes                                      |
| ---------------------------------------------- | -------------- | ------------------------------------------ |
| `periodState`                                  | canonical      | scheduled \| open \| published \| archived |
| `status`                                       | legacy tuple   | draft \| published                         |
| `archived`                                     | legacy tuple   | boolean                                    |
| `periodStatus`                                 | reopen flavour | open \| published \| reopened              |
| `autoPublished` / `autoArchived`               | audit          | set by the auto-\* transitions             |
| `publishedAt` / `publishedById` / `reopenedAt` | timestamps     | per transition                             |

Out of scope (not governed here): `year` / `week` / `quarter` identity tuple
(written once at creation, never transitions).

## Actual write sites being consolidated

Verified against the working tree — nine `periodState` write statements in five
files (the spec's named "six writers" — lead-save, carry-over, archive,
restore-from-snapshot — do **not** write `periodState`; that enumeration is
aspirational and is re-grounded by this change):

- `period.prisma-repository.ts` — `publishPeriod`, `reopenPeriod`
- `publication.prisma-repository.ts` — assemble/publish path
- `admin.prisma-repository.ts` — `createPeriodManual` (create), `archivePeriod`
  (archive), `unarchivePeriod` (unarchive). NB: `updatePeriodManual` (the Edit
  dialog) writes only the date/label envelope, never a lifecycle field, so it
  is **not** governed and the CI gate must not flag it.
- `period/auto-publisher.scheduler.ts`, `period/auto-archiver.scheduler.ts`
- `period/period-creator.scheduler.ts` — create + SCHEDULED→OPEN flip

## Before / after data flow

```
BEFORE — each writer hand-assembles the field set, helper bypassed
  publishPeriod   ─▶ tx.report.update({ status, periodStatus, periodState, publishedAt, publishedById })
  reopenPeriod    ─▶ tx.report.update({ periodStatus, periodState, reopenedAt })
  auto-publisher  ─▶ publishAuto() [tx1: status, periodStatus]
                     then prisma.report.update [tx2: periodState, autoPublished]   ← divergence window
  auto-archiver   ─▶ tx.report.update({ archived, periodState, autoArchived })
  admin/publication/period-creator ─▶ ...each its own shape

AFTER — intent in, complete atomic field set out
  caller ─▶ applyTransition(tx, reportId, kind, ctx) ─▶ tx.report.update({ <full set> }) ─▶ row
                           │
                           └─ buildTransition(kind, ctx) → Prisma.ReportUpdateInput   (pure, no DB)
```

## Module shape

- `modules/period/period-transition.ts` — **pure** `buildTransition(kind, ctx)`.
  No Nest, no Prisma client. Encodes the asymmetry (reopen → `periodState:"open"`
  but `periodStatus:"reopened"`) and the audit/timestamp rules. Absorbs
  `legacyTupleToState` / `stateToLegacyTuple` / `initialPeriodState`.
- `modules/period/period-transition.apply.ts` — thin `applyTransition(tx,
reportId, kind, ctx)` that runs `tx.report.update` and returns the row.
  Accepts the caller's transaction client; never opens its own.

### Return type and the `create` / `update` split

`buildTransition` returns a plain **governed-field subset** object (only the
lifecycle keys it owns: `periodState`, `status`, `archived`, `periodStatus`,
`autoPublished` / `autoArchived`, the timestamps). The object is assignable to
both `Prisma.ReportUpdateInput` and `Prisma.ReportCreateInput` because every
value is a bare scalar (never a `{ set }` update wrapper).

- **Existing-row transitions** (`publish`, `autoPublish`, `reopen`, `archive`,
  `autoArchive`, `open`, `unarchive`) flow through `applyTransition`, which runs
  `tx.report.update({ data: buildTransition(...) })`.
- **`create`** is special: it is a `report.create`, and the row also needs the
  non-governed identity envelope (`periodStart` / `periodEnd` / `deadline` /
  `weekLabel`) that the module does **not** own. The caller spreads the
  governed subset into its own create:
  `report.create({ data: { ...identity, ...buildTransition("create", ctx) } })`.
  There is no create variant of `applyTransition`. The CI gate stays satisfied
  because the lifecycle keys arrive via the `buildTransition(...)` spread, not
  as inline literals.
- The SCHEDULED→OPEN flip in `period-creator` is an `updateMany`, not a
  single-row update; it spreads `buildTransition("open", …)` into the
  `updateMany` data for the same reason.

To keep `buildTransition` pure and unit-testable, transitions that stamp a
timestamp (`publish`, `autoPublish`, `reopen`) take `now` via `ctx` rather than
calling `new Date()` internally.

### Why accept `tx` rather than own it

`publishPeriod` builds and writes the published snapshot from the **updated**
row inside the same `$transaction`. It therefore calls
`tx.report.update({ data: buildTransition("publish", ctx), include: … })`
directly (still sourcing every lifecycle value from the module) rather than
`applyTransition`, because it needs the snapshot `include` on the same call. If
the module opened its own transaction the snapshot write could no longer be
atomic with the state write. Callers that have no transaction of their own use a
one-line convenience wrapper.

## Invariant impact

This change **preserves and strengthens** `period-dual-state`. Because every
transition returns the complete field set, it becomes structurally impossible to
write one representation without the others. The module is the single
enforcement point; the new CI gate (forbid raw lifecycle-field writes outside
the module) converts the spec's review-only contract into a machine-checked one.

The auto-publisher divergences are fixed as a side effect. The `autoPublish`
transition writes `status`, `periodStatus`, `periodState`, and `autoPublished`
in one update — closing the torn-write window (tx2 can no longer fail
independently) and correcting the permanent `periodStatus="open"` drift that
the current auto path leaves on every published report (it never wrote
`periodStatus` at all).

## Rollout — strangler, one writer per commit

1. Land the pure builder + apply helper (no callers migrated yet).
2. Migrate `auto-publisher` first (it carries the live bug).
3. Migrate `publishPeriod` / `reopenPeriod`.
4. Migrate `admin` create/archive/edit.
5. Migrate `auto-archiver` and `period-creator`.
6. Add the CI gate + the spec-required atomicity integration test.
7. Delete the `period-state.ts` shim once no caller imports it.

Each step keeps gates green (`pnpm typecheck && pnpm lint && pnpm test`).
