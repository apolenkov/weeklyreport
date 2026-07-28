## ADDED Requirements

### Requirement: Stage-selection fields describe their values truthfully

Report record read models, write payloads, UI state, and validation errors SHALL
name arrays of SDLC stage labels `stageNames`. The `stageIds` spelling MUST NOT
remain in `apps/*` or `packages/*`. Fields that carry real stage UUIDs, including
the singular assignment `stageId`, SHALL retain their identifier spelling.

#### Scenario: A record crosses the full write/read boundary

- **WHEN** a client writes a record with `stageNames: ["Development"]`
- **THEN** the API persists the value in the existing `stageNames` database column
- **AND** the read model returns the same `stageNames` value
- **AND** no mapper translates between a name-valued `stageIds` field and
  `stageNames`

### Requirement: Persisted product settings never materialize schema defaults

`appSettingsSchema` SHALL require every persisted setting returned by the
repository. Missing columns or incomplete mappers MUST fail parsing instead of
inventing product behavior in the wire schema. `appSettingsUpdateSchema` SHALL
remain partial so omitted update keys are left untouched.

#### Scenario: A repository omits a persisted setting

- **WHEN** an AppSettings read omits any persisted field
- **THEN** `appSettingsSchema` rejects the object
- **AND** no timezone, deadline, reopen, notification, or presentation behavior
  is synthesized by Zod

#### Scenario: An update changes one setting

- **WHEN** an AppSettings update contains one valid field
- **THEN** `appSettingsUpdateSchema` accepts it
- **AND** absent fields remain absent from the parsed output

## MODIFIED Requirements

### Requirement: Three ratchet counters move in one direction only

`filesOnFloor` (product files at `cls: "A"`) MUST NOT decrease.
`overrideBlocks` (count of `files:` entries in `eslint.config.ts`) MUST NOT
increase. `liveSuppressions` (count of inline `eslint-disable*` directives)
MUST NOT increase without a matching justification stored in the same baseline
change.

The repository SHALL store the accepted counter baseline in version control
and SHALL enforce both the current tree against that baseline and a changed
baseline against its first-parent predecessor. The ratchet check SHALL run as
part of `pnpm lint`.

`productTotal` SHALL also match the current-tree baseline so catalogue scope
drift is visible, but it is diagnostic rather than a directional counter:
adding, deleting, or reclassifying a product file MAY update it in the same
commit.

#### Scenario: Current source regresses

- **WHEN** the current source has fewer floor files, more override blocks, or
  more live suppressions than the stored baseline
- **THEN** the exemplary-floor check exits nonzero
- **AND** `pnpm lint` fails

#### Scenario: A commit weakens the baseline without justification

- **WHEN** a changed baseline lowers `filesOnFloor` or raises either debt
  counter relative to the first-parent baseline
- **AND** no stored justification matches the counter and exact first-parent
  transition
- **THEN** the exemplary-floor check exits nonzero even if the current tree
  matches the weakened baseline

#### Scenario: A justified classification change lowers the absolute floor count

- **WHEN** an A-class product-only fixture moves into test utilities
- **AND** the baseline records the counter, previous value, current value, and
  reason
- **THEN** the first-parent comparison accepts that exact transition
- **AND** unrelated or mismatched regressions still fail

#### Scenario: A slice improves a counter

- **WHEN** a slice raises `filesOnFloor` or lowers a debt counter
- **THEN** the same commit updates the stored baseline to the measured value
- **AND** the current-tree and first-parent comparisons both pass

#### Scenario: Product scope changes intentionally

- **WHEN** a product file is added, deleted, or reclassified
- **THEN** the same commit updates `productTotal` to the current-tree value
- **AND** first-parent history does not treat that diagnostic change as a
  ratchet regression
