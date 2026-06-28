## Context

Admin org mutations all funnel through one write path. A caller service
(`SnapshotAdminService`, `ProjectAdminService`, `ReminderAdminService`) reads
the whole `AdminSnapshot` via `getSnapshot`, mutates one entry in memory, then
calls `AdminRepository.saveSnapshot(wholeSnapshot)`. The repository's
`saveSnapshot` (`admin-snapshot-write.queries.ts`) runs five sequential
`await`s — `upsertGroups`, `upsertUsers`, `upsertProjects`, `upsertPeriods`,
`upsertReminderRules` — with NO transaction, and each phase reconciles
destructively: any DB row absent from the in-memory snapshot is deleted (users,
reminder rules) or archived (projects).

Two independent defects fall out of this shape:

- **Partial-restore corruption.** A throw between phases (e.g. after users are
  deleted, before projects/rules are written) leaves the org half-restored with
  no rollback.
- **Concurrent-insert data loss.** `getSnapshot` reads at T0 (in the caller,
  outside any transaction); a row created at T1 (e.g. a SAML just-in-time user)
  is seen at T2 by `saveSnapshot` as "present in DB, absent from snapshot" and
  reconciled away — even though no admin touched it.

Backlog: BL-SNAPSHOT-RECONCILE (P1), findings AQ-2 / admin-svc-1 / admin-svc-2.

### Before / after data flow

Before (e.g. edit one user):

```
caller.getSnapshot()  ──read whole org @T0──▶ snapshot
caller mutate users[i] in memory
repo.saveSnapshot(snapshot)
  └─ no $transaction:
     upsertGroups · upsertUsers(+delete absent) · upsertProjects(+archive absent)
     · upsertPeriods · upsertReminderRules(+delete absent)   ← any throw = partial
```

After:

```
caller.upsertUser(user)              ← one entity in
repo.upsertUser(user)                ← targeted upsert by id, no whole-snapshot reconcile
caller.removeUser(id)
repo.removeUser(id)                  ← explicit guarded delete by id

(full saveSnapshot, where still used) wraps its phases in
  prisma.$transaction(async (tx) => { upsert* against tx })   ← all-or-nothing
  then PolicyApplicator.applyToPeriod(...) AFTER commit       ← unchanged timing
```

## Goals / Non-Goals

**Goals:**

- Make the multi-entity write all-or-nothing (transaction) — fixes
  partial-restore.
- Make each admin add/edit/remove touch only the named entity — fixes
  concurrent-insert data loss.
- Preserve the three documented behaviors at their current sites: post-commit
  PolicyApplicator, the FK-reference + P2003 guard on user delete, and the
  non-transition `resolveLifecycle` period write.

**Non-Goals:**

- No new DB constraint, schema column, or migration (the concurrency window is
  closed at the application layer by removing the destructive reconcile, not by
  a DB lock).
- No change to PolicyApplicator timing or to the `getSnapshot` read shape.
- No admin UI surface change.

## Decisions

### D1 — Targeted entity methods over "opt-in destructive reconcile"

The finding offers two routes: (a) narrow each mutation to the changed entity
(targeted upsert/delete by id), or (b) keep the whole-snapshot signature and
make destructive deletes opt-in per edited collection.

Choose (a). The destructive reconcile is currently the delete _mechanism_ —
`removeUser`/`removeProject`/`removeReminderRule` work by filtering the entity
out of the snapshot and letting the reconcile drop the now-absent row. Route (b)
keeps the stale-read window for every untouched collection and keeps the
whole-snapshot payload as the unit of consistency; it only narrows which
collections may delete. Route (a) eliminates the stale-read/absent-row inference
entirely: an edit is an upsert by id, a removal is a delete/archive by id. It is
the more direct fix and matches how the rest of the admin surface already works
(`saveReportingGroup`, `saveStageAssignment`, the GroupProduct edges).

Trade-off: route (a) is a wider diff — it adds entity-level methods to the
`AdminRepository` contract and rewires three caller services and the in-memory
test repo. Accepted; the blast radius is enumerated in tasks.md.

### D2 — Keep `saveSnapshot` for true whole-snapshot restore, made atomic

Some paths legitimately restore a whole snapshot (e.g. importing an
`AdminSnapshot`). Keep `saveSnapshot` for that use, but wrap its phases in one
interactive `prisma.$transaction(async (tx) => …)`. The per-entity caller
mutations (D1) stop going through it. Where a whole-snapshot restore must still
support removals, deletions stay explicit to the supplied set rather than
inferred from absence — or the import path is documented as additive. Settle the
exact whole-restore removal contract during implementation (see Open Questions).

### D3 — Thread the transaction client through the upsert helpers

Inside `$transaction(async (tx) => …)` the helpers receive
`Prisma.TransactionClient`, which lacks `$transaction`/`$connect`. The
`upsert*` helpers currently type their first parameter as `PrismaService`; widen
it to the transaction-client type so the same functions run under `tx`. This is
the pattern already used in `lead-form.prisma-repository.ts` and
`report-sections.prisma-repository.ts`.

### D4 — PolicyApplicator stays strictly post-commit

`applyToPeriod` runs in a loop AFTER the transaction returns, never inside it
(the existing comment at lines 293–301 is deliberate: an applicator failure must
not roll back the periods). The transaction boundary ends before the applicator
loop begins.

## Risks / Trade-offs

- [Removing the destructive reconcile silently breaks removals if callers are
  not rewired] → Rewire all three caller services to call the new explicit
  delete/archive methods in the same change; cover each with a test that proves
  only the named row changes.
- [Tests encode the destructive reconcile as intended behavior] →
  `admin.service.test.ts` (60 KB) and the integration/contract tests are
  audited; cases asserting "absent row gets deleted/archived" are re-expressed
  against targeted mutations rather than weakened or deleted.
- [Transaction-client typing churn] → Widen the helper parameter type once;
  no behavior change, caught by `pnpm typecheck`.
- [The in-memory test repository must mirror the new contract] → Add the
  entity-level methods to the fake repo so contract tests stay representative.

### Invariants

- **Preserved:** period dual-state (`resolveLifecycle` non-transition write,
  D-spec requirement), the user-delete FK guard, post-commit PolicyApplicator,
  role-coverage gate (no tRPC procedure signature change), destructive-db guard
  (no schema/DB-name change).
- **Relaxed:** the implicit "absent from snapshot ⇒ delete/archive" reconcile
  rule is removed in favor of explicit per-id removal.

## Migration Plan

No data migration. Pure application-layer change. Rollback is reverting the
commit; no schema or DB state to undo. Deploy is a normal API build — the
`getSnapshot` wire shape and all tRPC procedures are unchanged, so apps/web
needs no coordinated change.

## Open Questions

- For a genuine whole-snapshot import via `saveSnapshot`, is the removal
  contract additive-only (never delete absent rows) or does it delete only
  within an explicitly supplied id set? Resolve before implementing D2; default
  to additive-only unless an import caller needs deletions.
