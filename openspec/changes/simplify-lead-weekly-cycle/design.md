# Design

## Context

See [proposal.md](./proposal.md) for motivation. The existing carry-over path already has the required transaction, lineage key, `carriedOver` confirmation marker, source-snapshot selection, parent checks, and section-version protection. Its pure planner currently selects only Next items or Current items with `nextStepText`; its cloner always writes `workflowStatus: planned`. The Overview already derives `needsConfirmation` from `type=current && carriedOver`, clears the marker through the canonical draft patch, keeps Previous read-only, and opens the canonical editor. TASK-047 currently owns dirty edits in these same API and Web files.

## Goals / Non-Goals

**Goals:**

- Express rollover as one deterministic selection per lineage, then reuse the existing clone/write transaction.
- Reuse `carriedOver` as the sole unconfirmed marker and the existing open-work register for derived automatic pauses; avoid schema, Prisma, endpoint, or migration changes.
- Reduce the active-item action surface without creating a second editor or mutation path.
- Preserve the three-column projection, focus recovery, section autosave, and read-only history.

**Non-Goals:**

- No changes to decision carry-over, lifecycle transitions, role middleware, database guards, publication, risk derivation, or mobile layout.
- No cleanup of unrelated TASK-047 work and no parallel writes to overlapping files.

## Decisions

### 1. Select one rollover candidate per stable lineage before cloning

The pure carry-over planner will group eligible Item representations by `stableId` and choose in order: explicit commitment, then Current `in_progress` fallback. Resolved, done, paused, postponed, and uncommitted planned entries are filtered first. The existing open-work projection will classify the latter uncommitted Current `planned` lineage as automatically paused for the target period, with a fixed system explanation; it will not create a target Item or mutate the source. A missing `stableId` remains an independent legacy occurrence, matching the existing lineage constraint behavior.

This is smaller and safer than adding dedupe to the transaction: the writer already protects the target against existing lineages and races, while only the planner has the source context needed to apply commitment precedence.

### 2. Parameterize the existing clone result; do not add a new state field

The selected candidate supplies target text and target progress to the existing explicit write-field clone. Explicit commitments write `planned`; fallback Current continuations write `in_progress`. Both set `carriedOver: true`, which already drives `needsConfirmation`, submit-readiness, and the canonical confirmation patch.

Alternative rejected: add `confirmationStatus` or a second boolean. It would duplicate `carriedOver`, require a migration and shared-schema changes, and create contradictory states.

### 3. Consolidate UI actions around the canonical status/editor path

The Overview action component will render one primary status interaction for an active Item. For an unconfirmed carried item, saving through that canonical status/update flow clears `carriedOver`; no separate Confirm action remains. For ordinary active work it uses the same canonical editor/status flow. Edit details and rare movement share one secondary overflow. Restore and historical replanning remain conditional. Previous renders no write handlers.

The action policy will be expressed as a small pure derivation near the existing Overview item/action model so component tests can assert exact visible actions without introducing a new state store.

### 4. Preserve current architecture and invariants

Before:

```text
published/submitted source -> carry-over filter -> always-planned clone
  -> existing race-safe transaction -> carriedOver=true -> Confirm/Edit/Move/Update actions
```

After:

```text
published/submitted source -> per-stableId precedence selector
  -> existing clone (planned commitment | in-progress continuation)
  -> unchanged race-safe transaction -> carriedOver=true
  -> one primary status interaction + one conditional secondary overflow
```

- **Period dual-state:** preserved; no Report lifecycle writer changes.
- **Role-coverage gate:** preserved; no tRPC procedure or middleware changes.
- **Destructive-db guard:** preserved; no migration/reset is required.
- **Write integrity:** preserved; target editability, transaction locks, version increments, and execution/record audit remain unchanged.

## Risks / Trade-offs

- **TASK-047 changes the same files** → do not start apply until ownership is handed off; capture baseline hashes and review the combined diff before each edit.
- **Two source representations share one lineage** → planner tests cover every ordering and prove explicit commitment wins independent of array order.
- **`carriedOver` means both planned commitment and continued work** → progress distinguishes the cases; UI copy says planned or continued while the marker consistently means not yet confirmed this week.
- **Action reduction hides a necessary recovery path** → keep Restore and historical replanning conditional, and test the finite state/action matrix plus keyboard focus.
- **No new database marker for “updated this week”** → accepted for the MVP because the existing canonical update clears `carriedOver`; add a separate field only if later reporting must distinguish confirmation from substantive edits.
- **Automatic pause is a derived registry state** → keep the source immutable and show one fixed system reason; add persisted pause events only if later auditing requires more than source lineage plus period provenance.

## Migration Plan

1. Wait for a safe TASK-047 handoff and record the exact source baseline.
2. Land pure planner/cloner tests and implementation; no data migration or feature flag.
3. Land the Overview action-policy tests and minimal component changes using the existing editor and draft patch.
4. Run focused suites, full repository gates, and a finite agent-browser acceptance matrix on synthetic local records.
5. Roll back by reverting the bounded API/Web diff; stored rows remain valid because no schema or vocabulary changes.
