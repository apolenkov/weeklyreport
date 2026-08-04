## ADDED Requirements

### Requirement: Current period wire models require a complete consistent lifecycle tuple

The current `reportPeriodSchema` and `periodReadModelSchema` surfaces MUST require the canonical state, legacy status and archived fields, period status, audit flags, and applicable timestamps, and MUST reject every contradictory tuple. Legacy snapshot compatibility MUST use a separately named versioned decoder that returns a value accepted by the strict current schema.

#### Scenario: Current payload omits a lifecycle field

- **WHEN** a current report-period or period-read-model payload omits any governed lifecycle field
- **THEN** shared schema parsing fails instead of manufacturing a default or falling back to the legacy tuple

#### Scenario: Supported legacy snapshot is decoded

- **WHEN** an explicitly versioned supported legacy snapshot omits fields that did not exist in that version
- **THEN** the legacy decoder derives one complete consistent tuple and the result passes the strict current schema

#### Scenario: Legacy snapshot is ambiguous or contradictory

- **WHEN** a legacy payload cannot determine exactly one valid current lifecycle tuple
- **THEN** decoding fails with a typed incompatibility error and no current read model is produced

### Requirement: Lifecycle narrowing is exhaustive and fail-closed

The period factory, `resolveActiveWorkspace`, and manual period creation surfaces MUST accept only their explicitly allowed lifecycle states and MUST reject `published`, `archived`, null, missing, or contradictory state rather than coercing it to `open`.

#### Scenario: Factory receives an unexpected persisted state

- **WHEN** a draft lookup returns a row whose canonical state is published, archived, missing, or inconsistent with the legacy tuple
- **THEN** the factory returns a typed integrity failure and MUST NOT advertise the row as open

#### Scenario: Manual creation receives a widened state

- **WHEN** a direct service or repository caller supplies any state other than scheduled or open
- **THEN** manual creation rejects the input before constructing or writing a transition

#### Scenario: Session lookup encounters an archived draft

- **WHEN** the newest legacy-draft report is archived or has a non-live canonical state
- **THEN** `resolveActiveWorkspace` excludes it and MUST NOT embed its section as an editable workspace for any role

### Requirement: Unarchive is a tuple-guarded compare-and-set

`unarchivePeriod` MUST derive and write its transition in one transaction whose update predicate contains the complete lifecycle tuple read for the decision. The operation MUST succeed only when exactly one row still matches that tuple.

#### Scenario: Lifecycle changes between decision and write

- **WHEN** publish, reopen, archive, or another unarchive changes any governed field after the unarchive decision is formed
- **THEN** the guarded update affects zero rows, returns a typed stale-state conflict, and preserves the concurrent transition

#### Scenario: Boundary uniqueness conflicts

- **WHEN** a valid unarchive collides with a row holding the same scheduling boundary
- **THEN** the transaction rolls back without a partial lifecycle tuple and returns the typed overlap conflict

### Requirement: Lifecycle write enforcement is semantic and conservative

The lifecycle write gate MUST resolve Prisma Report delegate aliases and data values through the TypeScript program. Any governed write outside the transition owner, or any governed write whose data provenance cannot be resolved, MUST fail the gate.

#### Scenario: Equivalent bypass forms are planted

- **WHEN** probes write governed fields through direct, aliased, computed, variable, helper-returned, conditional, or spread-produced forms
- **THEN** every form fails unless it consumes the sanctioned transition result inside the transition owner

#### Scenario: Exemption marker is malformed or unreferenced

- **WHEN** a write carries an unknown, unreferenced, or out-of-owner exemption marker
- **THEN** the lifecycle gate fails rather than accepting the marker as evidence
