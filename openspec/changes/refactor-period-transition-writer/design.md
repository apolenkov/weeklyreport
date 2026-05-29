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
- `admin.prisma-repository.ts` — create, archive, edit
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

### Why accept `tx` rather than own it

`publishPeriod` builds and writes the published snapshot from the **updated**
row inside the same `$transaction`. If the module opened its own transaction the
snapshot write could no longer be atomic with the state write. Callers that have
no transaction of their own use a one-line convenience wrapper.

## Invariant impact

This change **preserves and strengthens** `period-dual-state`. Because every
transition returns the complete field set, it becomes structurally impossible to
write one representation without the others. The module is the single
enforcement point; the new CI gate (forbid raw lifecycle-field writes outside
the module) converts the spec's review-only contract into a machine-checked one.

The auto-publisher two-transaction divergence is fixed as a side effect: the
`autoPublish` transition writes the legacy fields and `periodState` in one
update, closing the window.

## Rollout — strangler, one writer per commit

1. Land the pure builder + apply helper (no callers migrated yet).
2. Migrate `auto-publisher` first (it carries the live bug).
3. Migrate `publishPeriod` / `reopenPeriod`.
4. Migrate `admin` create/archive/edit.
5. Migrate `auto-archiver` and `period-creator`.
6. Add the CI gate + the spec-required atomicity integration test.
7. Delete the `period-state.ts` shim once no caller imports it.

Each step keeps gates green (`pnpm typecheck && pnpm lint && pnpm test`).
