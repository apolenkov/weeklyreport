## Context

See `proposal.md` for motivation. The exact source baseline is commit
`faa7122c3a60db8819deee7a18c474290adc64f0`, tree
`ba733d140861923dc42025c0e5035728cf6745a9`. Static verification passes 37 of
38 lint rows; only the directory-architecture row fails. Manual review also
found an application-level lifecycle precheck that reads status without the
archive fact, while its locked transaction gate already applies the complete
predicate.

The runtime-sweep modules are internal test infrastructure. Their relocation
must preserve behavior and catalogue identity. The report-section change is an
internal port refinement with no route, schema, error-code, or database change.

## Goals / Non-Goals

**Goals:**

- Restore the existing directory limit through explicit ownership groups.
- Make the early section-write gate and locked transaction gate use the same
  lifecycle facts.
- Reconcile durable specifications with the current architecture and tested UI.
- Produce a short source-bound evidence packet suitable for Sol review.

**Non-Goals:**

- No browser, runtime matrix, Playwright, Docker, database, Redis, release, or
  visual acceptance.
- No new architecture layer, public API, compatibility facade, gate exception,
  or relaxed baseline.

## Decisions

### 1. Move modules physically into three ownership groups

Move all 14 direct diagnostic-sidecar modules into `diagnostics/sidecar/`, all
16 direct launch-continuation modules into `launch/continuation/`, and the seven
shared reveal-continuation schema/limit/factory modules into
`reveal/continuation/contracts/`. Repair consumers and catalogue patterns to
point to those paths, then refresh the structural identity baseline.

This keeps direct counts at 17, 15, and 26 respectively. Physical moves are
preferred over copies or re-export shims because duplicate identities would
hide ownership and extend the migration indefinitely. Raising the 30-file limit
was rejected because it would erase the only failing architecture signal.

### 2. Return the complete lifecycle gate from one repository port

Rename the section-keyed repository method to describe a write gate and return
`{ periodStatus, archived } | null`. The Prisma adapter selects both facts from
the owning report. Both application prechecks evaluate the same editable-period
predicate already enforced by the transaction gate.

Before:

```text
sectionId -> status-only precheck -> validation -> locked full gate -> mutation
```

After:

```text
sectionId -> {periodStatus, archived} precheck -> validation
          -> locked {periodStatus, archived} gate -> mutation
```

The second gate remains mandatory: the early check improves fail-fast behavior,
while the locked gate remains the TOCTOU authority. Adding a second lookup or
moving the lock earlier was rejected because it would either duplicate policy
or broaden the transaction unnecessarily.

### 3. Correct specifications without changing current UI ownership

The Head report toolbar owns exactly one Agent-review placeholder in both form
and slides modes; the nested slide article does not duplicate it. The Head page
assembly remains behind `features/report-pages`, while `report-sections` remains
a lower-level slice. The obsolete contradictory clauses are updated or removed
rather than moving working code back to an older architecture.

### 4. Preserve load-bearing invariants

- Period dual-state: preserved; no period writer or tuple mutation changes.
- Role-coverage gate: preserved; no tRPC middleware chain changes.
- Destructive database guard: untouched; no database operation is in scope.
- Deferred-feature pattern: clarified, not relaxed; one inert canonical marker
  remains required on every applicable surface.

## Risks / Trade-offs

- [Missed relative import after bulk moves] -> use path-aware mechanical moves,
  focused tests, API/E2E typechecks, depcruise, and the full lint gate.
- [Catalogue identity drift] -> update catalogue patterns only after moves, then
  run catalogue and directory gates before refreshing the baseline.
- [Application precheck diverges again] -> name the port as a write gate, return
  both facts together, and pin archived-open and archived-reopened tests.
- [Large diff obscures product change] -> review the move-only tranche and the
  three-file product tranche separately before the final combined Sol review.

## Migration Plan

1. Apply the three move sets and repair imports/catalogue references.
2. Prove the focused runtime-sweep tests and static architecture gates.
3. Apply the repository-port refinement and focused API regressions.
4. Synchronize the three durable specifications.
5. Run the bounded static close and present the exact diff plus evidence to Sol.

Rollback is a path reversal plus import/catalogue restoration; there is no data
migration, feature flag, credential lifecycle, or deployment step.
