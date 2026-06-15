# version-restore-fidelity (DRAFT delta — PARKED)

> DRAFT: this delta states the invariant versions v2 must satisfy.
> Captured for design ratification, NOT for implementation (parked in
> `openspec/deferred/`). The invariant below is the NARROWED owned-content
> invariant ratified in `design.md` (Codex-approved) and `proposal.md` — it
> supersedes the earlier "every field the page renders" wording.

## ADDED Requirements

### Requirement: A version fully determines the section's OWNED content

A version snapshot MUST capture the section's OWNED, author-editable content —
items, risks, decisions, and the owned status folds (`projects[].trafficLight`
and `ownedStages[].status`). Restoring a version MUST atomically replace that
entire owned surface in one transaction (unconditional wipe-then-recreate; no
partial or field-conditional wipe).

Master/foreign data (project name/archive, stage assignments, referenced-project
names, author identity) and lifecycle (`status`, `submittedAt`, `late`) are NOT
snapshotted and are NOT part of the round-trip equality set: they render LIVE and
are pinned from the CURRENT section at restore time. A version therefore
reproduces what the author authored, not the live framing around it.

Restore MUST NOT merge snapshot data with current state; a payload whose
`schemaVersion` has no registered migration path MUST be refused, leaving current
state untouched.

#### Scenario: Round-trip restore reproduces the captured OWNED content

- **WHEN** a snapshot of section S is captured, S is then edited (including its
  owned stage statuses and owned project traffic lights), and the snapshot is
  restored
- **THEN** the owned-content projection of the mapped read model deep-equals the
  owned-content projection at capture time — across both `trafficLight` fold
  branches (aggregate-wins and project-status-fallback)

#### Scenario: Lifecycle and master data stay LIVE across a restore

- **WHEN** the section's lifecycle (`status`/`submittedAt`/`late`) or master
  data (e.g. a referenced project's name) changes between capture and restore,
  and the snapshot is then restored
- **THEN** the restored section keeps its CURRENT live lifecycle and master data
  (they are pinned from the live section, never overwritten by the snapshot),
  while the owned content matches the captured snapshot

#### Scenario: A new renderable owned field fails the drift guard at compile time

- **WHEN** a new owned field is added to the section read model but not to the
  snapshot schema
- **THEN** the type-level `ExactDeep` drift guard (bound against the read-model
  owned slice) fails `typecheck`, forcing the field to be snapshotted or
  explicitly excluded

#### Scenario: Unknown schemaVersion is refused, never merged

- **WHEN** a restore is attempted with a payload whose `schemaVersion` has no
  registered migration to the current schema
- **THEN** the restore fails with a clear error and the section's current state
  is unchanged

#### Scenario: Restore creates a new version instead of rewriting history

- **WHEN** version N of a section is restored
- **THEN** a pre-restore safety snapshot of the current state is captured first,
  and the version list grows; no existing version row is mutated or deleted by
  the restore
