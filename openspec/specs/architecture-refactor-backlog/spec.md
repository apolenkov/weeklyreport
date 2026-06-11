# architecture-refactor-backlog Specification

## Purpose

TBD - created by archiving change backlog-architecture-refactors. Update Purpose after archive.

## Requirements

### Requirement: The lead-form god component is a recorded decomposition target

The backlog MUST record that `apps/web/src/components/lead/lead-form.tsx`
(1936 LOC as of 2026-06-10; 300-line `max-lines` standard) is a
decomposition target being reduced in recorded slices, each captured as
its own grilled refactor change before work starts. The first slice is
`refactor-lead-mappers`: the pure cross-author and snapshot derivations
moved to tested adapters in `apps/web/src/lib/mappers/` (landed at
1658 LOC on 2026-06-11; the file stood at 1930 when the slice started).
The decomposition target itself stays open;
the deferred `ReportDataCoordinator` / `FormStateManager` objects MUST
NOT be built outside a future grilled change of their own.

#### Scenario: the lead-form size target is discoverable

- **WHEN** a maintainer looks for known oversized modules
- **THEN** the backlog names `lead-form.tsx` with its current LOC and
  the 300 target
- **AND** it lists the landed slices (first: `refactor-lead-mappers`)
  and marks the remaining decomposition as needing its own grilled
  refactor change before work starts

#### Scenario: a second slice starts

- **WHEN** an agent or maintainer picks up further lead-form
  decomposition work
- **THEN** a grilled OpenSpec change exists for that slice before any
  code is written
- **AND** the change cites the updated LOC evidence from the previous
  slice

### Requirement: The client permission model is a recorded centralization target

The backlog MUST record that web-client permission/authorization logic is
scattered across components rather than centralized, and SHOULD be consolidated
into a single client-side permission source. This is recorded as a deferred
design target.

#### Scenario: the permission-model target is discoverable

- **WHEN** a maintainer reviews client authorization
- **THEN** the backlog names the scattered-permission concern and its
  centralization target
- **AND** it is marked as needing its own grilled change before work starts

### Requirement: The traffic-light value is a recorded single-source-of-truth target

The backlog MUST record that the traffic-light (green/amber/red) / risk value is
re-typed across ~33 files instead of a single shared enum, and SHOULD be
unified into one source-of-truth in `packages/shared` schemas, consistent with
`schema-conventions`. This is recorded as a deferred target.

#### Scenario: the traffic-light SSOT target is discoverable

- **WHEN** a maintainer searches for duplicated domain enums
- **THEN** the backlog names the traffic-light re-typing with its ~33-file spread
  and the `packages/shared` SSOT target
- **AND** it links the work to `schema-conventions`

### Requirement: The repository Prisma-type leak is a recorded boundary target

The backlog MUST record that API repositories leak raw Prisma row types across
the domain boundary instead of mapping to shared/domain contracts, and SHOULD be
changed so repositories return domain types. This relates to the existing
`repository-scope-guard` spec and is recorded as a deferred target.

#### Scenario: the Prisma-leak target is discoverable

- **WHEN** a maintainer reviews the repository boundary
- **THEN** the backlog names the Prisma-type leak and the domain-mapping target
- **AND** it links the work to `repository-scope-guard`
