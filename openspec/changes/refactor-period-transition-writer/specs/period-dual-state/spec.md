## ADDED Requirements

### Requirement: Lifecycle Transitions Go Through a Single Transition Writer

Every code path that mutates a `Report`'s lifecycle representation MUST do so
by invoking the single Period transition module, never by hand-assembling the
field set inline. The module governs exactly these lifecycle fields:
`periodState`, the legacy `status` and `archived` tuple, `periodStatus`, the
`autoPublished` / `autoArchived` audit flags, and the
`publishedAt` / `publishedById` / `reopenedAt` timestamps. The period identity
tuple (`year`, `week`, `quarter`) is written only at creation and is NOT
governed by this requirement.

Each transition (`create`, `schedule`, `open`, `publish`, `autoPublish`,
`reopen`, `archive`, `autoArchive`, `unarchive`) MUST produce the complete field
set for that transition so that no representation can be written without the
others.

#### Scenario: Writer mutates lifecycle state via the transition module

- **WHEN** any repository, service, or scheduler transitions a `Report`'s
  lifecycle state
- **THEN** it calls the transition module's apply function within its own
  Prisma transaction
- **AND** the resulting `report.update` writes the complete governed field set
  for that transition in a single round-trip

#### Scenario: Auto-publish writes the full lifecycle set atomically

- **WHEN** the auto-publisher promotes a draft `Report` past its deadline
- **THEN** `status`, `periodStatus`, `periodState`, and `autoPublished` are
  written in the same transaction
- **AND** the published report's `periodStatus` is `"published"` (not left at
  the default `"open"`), matching the manual publish path
- **AND** there is no committed state where `status` is `"published"` while
  `autoPublished` is still `false`

### Requirement: Raw Lifecycle-Field Writes Are Forbidden Outside the Module

A continuous-integration gate MUST fail the build when a `report.update` or
`report.create` call writes any governed lifecycle field outside the Period
transition module. This converts the dual-state contract from a review-only
convention into a machine-checked invariant.

A write that is demonstrably NOT a lifecycle transition — specifically a
snapshot restoration that reinstates independently-persisted values rather than
coupling the three machines into one intent — MAY opt out via an explicit,
reviewed call-site marker that names a follow-up reference. Deriving such a
write through the transition module would corrupt legitimately-divergent rows
(a reopened period is `status="published"` while `periodState="open"`). Every
other governed-field write outside the module MUST fail the gate.

#### Scenario: A new writer bypasses the transition module

- **WHEN** code is added that writes `periodState`, `status`, `periodStatus`,
  `archived`, `autoPublished`, or `autoArchived` directly via Prisma outside the
  transition module
- **THEN** the CI gate fails and the build is rejected

#### Scenario: A non-transition restore opts out via an explicit marker

- **WHEN** a write that reinstates persisted values (not a transition) carries
  an explicit call-site opt-out marker naming a follow-up reference
- **THEN** the CI gate skips that specific call site
- **AND** the same write WITHOUT the marker still fails the gate, so the opt-out
  is per-site and reviewable, never a blanket off-switch
