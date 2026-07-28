## MODIFIED Requirements

### Requirement: Three ratchet counters move in one direction only

`filesOnFloor` (product files at `cls: "A"`) MUST NOT decrease.
`overrideBlocks` (count of `files:` entries in `eslint.config.ts`) MUST NOT
increase. `liveSuppressions` (count of inline `eslint-disable*` directives)
MUST NOT increase.

The repository SHALL store the accepted counter baseline in version control
and SHALL enforce both the current tree against that baseline and a changed
baseline against its first-parent predecessor. The ratchet check SHALL run as
part of `pnpm lint`.

#### Scenario: Current source regresses

- **WHEN** the current source has fewer floor files, more override blocks, or
  more live suppressions than the stored baseline
- **THEN** the exemplary-floor check exits nonzero
- **AND** `pnpm lint` fails

#### Scenario: A commit weakens the baseline

- **WHEN** a changed baseline lowers `filesOnFloor` or raises either debt
  counter relative to the first-parent baseline
- **THEN** the exemplary-floor check exits nonzero even if the current tree
  matches the weakened baseline

#### Scenario: A slice improves a counter

- **WHEN** a slice raises `filesOnFloor` or lowers a debt counter
- **THEN** the same commit updates the stored baseline to the measured value
- **AND** the current-tree and first-parent comparisons both pass
