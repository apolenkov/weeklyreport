# Fix: snapshot restore must round-trip the full Period lifecycle

## Problem

The admin snapshot export/restore loses a `Report`'s lifecycle state and
silently re-introduces the divergence the `period-dual-state` invariant forbids.

`getSnapshot` (`admin.prisma-repository.ts`) captures each period as only
`{ id, periodStart, periodEnd, deadline, status }` — it never even writes the
`periodState` the schema already allows, and the schema (`reportPeriodSchema`)
has no slot for `periodStatus`, `archived`, or the `autoPublished` /
`autoArchived` / timestamp fields. `applySnapshot` then restores only `status`
(plus the date envelope):

- **Restoring a published period corrupts it.** The `create` branch omits
  `periodState`, so it defaults to `"open"` even though `status="published"`.
  The result reads `status="published"` / `periodState="open"` / the default
  `periodStatus="open"` — a published report that is **invisible to viewers**
  (`weekly-report.service` rejects a non-`published` `periodStatus`) and serves
  no published snapshot (`weekly-report.prisma-repository` gates on
  `periodStatus="published"`).
- **Restoring an archived period un-archives it.** `archived` is not captured
  or restored, so an archived snapshot comes back as a live period.

This write is the single site the `refactor-period-transition-writer` CI gate
had to exempt (`lifecycle-write-gate-allow` marker +
`TODO(snapshot-lifecycle-restore)`). The exemption is correct — a restore is
**not** a lifecycle transition — but it papers over a real data-loss bug.

## Solution

Make the snapshot a faithful, lossless record of the governed lifecycle field
set, then restore it verbatim.

1. Extend `reportPeriodSchema` with the full governed set (`periodState`,
   `periodStatus`, `archived`, `autoPublished`, `autoArchived`, `publishedAt`,
   `publishedById`, `reopenedAt`), all **optional** so pre-existing snapshots
   still parse.
2. `getSnapshot` captures every governed field.
3. `applySnapshot` writes the captured fields verbatim on both the create and
   update branches. When a field is absent (legacy snapshot), fall back to a
   single, explicit legacy-tuple derivation — the same backfill the original
   `periodState` migration used — so old snapshots restore to a coherent state
   instead of a divergent one.
4. Resolve the `TODO(snapshot-lifecycle-restore)` debt: the restore now writes
   the complete, faithful set. The `lifecycle-write-gate-allow` marker **stays**
   (a restore remains a non-transition writer — it can never go through
   `buildTransition`), but its comment is rewritten from "buggy, to be fixed"
   to a stable "reinstates persisted values, not a transition" rationale.

The restore deliberately does **not** go through `buildTransition`: it reinstates
independently-persisted values. Deriving the coupled set from one field would
corrupt legitimately-divergent rows — a reopened period is `status="published"`
while `periodState="open"` / `periodStatus="reopened"`.

## Non-goals

- **Changing the transition module.** `buildTransition` / `applyTransition` and
  the nine migrated writers are untouched; this change only fixes the
  snapshot capture/restore pair and its schema.
- **A new migration of the `Report` table.** The columns already exist; this is
  a shared-schema + repository change, not a Prisma migration.
- **Versioning-snapshot work.** The published-report `publishedSnapshot` and the
  v8.4 autosave snapshots are unrelated; this is strictly the admin
  export/restore (`getSnapshot` / `applySnapshot`).
