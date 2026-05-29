# Design: lossless Period lifecycle in admin snapshots

## Captured field set

`reportPeriodSchema` gains the full governed lifecycle set, mirroring the fields
the `period-dual-state` invariant protects. All new fields are **optional** so
snapshots taken before this change still parse.

| Field           | Type                                   | New?          | Notes                                  |
| --------------- | -------------------------------------- | ------------- | -------------------------------------- |
| `status`        | `draft \| published`                   | no            | already captured                       |
| `periodState`   | `scheduled\|open\|published\|archived` | no (optional) | already in schema, NOT captured today  |
| `periodStatus`  | `open \| published \| reopened`        | yes           | the field whose absence caused the bug |
| `archived`      | boolean                                | yes           | absence un-archives on restore         |
| `autoPublished` | boolean                                | yes           | audit flag                             |
| `autoArchived`  | boolean                                | yes           | audit flag                             |
| `publishedAt`   | date \| null                           | yes           | timestamp                              |
| `publishedById` | string \| null                         | yes           | timestamp/actor                        |
| `reopenedAt`    | date \| null                           | yes           | timestamp                              |

Identity (`periodStart` / `periodEnd` / `deadline`) is already captured and is
out of scope.

## Why NOT route through the transition module

A restore reinstates three independently-persisted state machines; it is not an
intent. `buildTransition` couples them (e.g. `publish` forces
`periodStatus="published"`). Running a reopened period
(`status="published"`, `periodState="open"`, `periodStatus="reopened"`) through
any single transition kind would overwrite at least one machine and corrupt the
row — the exact reason the `refactor-period-transition-writer` gate _exempted_
this site rather than migrating it. The correct fix writes the persisted values
back verbatim. This change therefore lives entirely outside the transition
module.

## Capture (`getSnapshot`)

`prisma.report.findMany()` already returns every column, so the period mapper
just forwards the new fields into `reportPeriodSchema.parse({ ... })`. No query
change.

## Restore (`applySnapshot`)

Both branches of the period upsert loop write the full governed set:

```
update / create data: {
  ...identity (periodStart, periodEnd, deadline, [id]),
  ...resolveLifecycle(period),
}
```

`resolveLifecycle(period)` returns the governed fields verbatim when present.
For a **legacy snapshot** (new fields absent) it falls back to the one
documented backfill — the same rule the original `periodState` SQL migration
used — so old snapshots restore coherently instead of divergently:

- `periodState` ← `period.periodState` ?? (`archived` ? `archived` : `status==="published"` ? `published` : `open`)
- `archived` ← `period.archived` ?? `false`
- `periodStatus` ← `period.periodStatus` ?? (`status==="published"` ? `published` : `open`)
- `autoPublished`/`autoArchived` ← `?? false`
- `publishedAt`/`publishedById`/`reopenedAt` ← `?? null`

Because `archived`/`periodStatus` aren't in legacy snapshots, a legacy archived
period cannot be perfectly recovered — but the fallback at least keeps the
restored row internally consistent (the failure mode today is an _inconsistent_
row, which is strictly worse). This is the same lossiness the original migration
accepted and is documented, not silently swallowed.

## The gate exemption STAYS; only the TODO debt is resolved

This is the key correction to make up front: after the fix, `applySnapshot`
writes _more_ governed fields, not fewer. A restore can never route through
`buildTransition` (it would corrupt divergent rows), so it remains a
non-transition writer and the two `lifecycle-write-gate-allow` markers must
**stay** — that is exactly the case the gate's opt-out exists for.

What changes is the _reason_: today the marker comment reads "buggy, see
`TODO(snapshot-lifecycle-restore)`"; after this change it reads a stable
"snapshot restore reinstates independently-persisted values, not a transition."
Delete the `TODO(snapshot-lifecycle-restore)` line (the debt is paid); keep the
marker.

Implementation note: write the governed fields via a spread of
`resolveLifecycle(period)` for readability, but keep the marker regardless — the
exemption documents _intent_ (this is a deliberate non-transition write) and
must survive even though a spread happens not to trip the literal-key detector.
Do not rely on the spread to "hide" from the gate; mark it explicitly so the
opt-out stays greppable and reviewable.

## Risk / compatibility

- **Backward compatibility:** all new schema fields optional; legacy snapshots
  parse and restore via the fallback. New snapshots are a superset.
- **No migration:** the `Report` columns already exist; this is a shared-schema
  - repository change only.
- **Test surface:** unit tests for `resolveLifecycle` (present vs legacy
  fallback, incl. the reopened-period round-trip that must NOT be flattened);
  an integration test asserting a published and a reopened period survive a
  `getSnapshot` → `applySnapshot` round-trip with every field intact.
