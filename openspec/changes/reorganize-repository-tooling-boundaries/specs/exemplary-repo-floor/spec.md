## ADDED Requirements

### Requirement: Structural debt MUST be measured from the current tracked tree

The exemplary catalogue MUST derive direct-file density, ownership coverage,
orphan repository-test count, and production deep-import counts from the current
tracked tree. Stored structural baselines MUST be rejected when their source tree
identity is stale. Completion requires zero uncatalogued files, zero orphan
repository tests, zero unexplained over-threshold directories, and zero new
production deep-import edges.

#### Scenario: A stored structure baseline predates a move

- **WHEN** tracked source paths change after the structural baseline was generated
- **THEN** the exemplary gate requires regeneration from the current tree
- **AND** an older green inventory cannot establish completion

#### Scenario: Directory organization improves without coupling regression

- **WHEN** a concern migration lowers flat-directory debt
- **THEN** the same change updates the structural baseline to the measured value
- **AND** completion is rejected if production deep-import counts increase

### Requirement: Flat-directory debt counters MUST move toward zero

The repository SHALL store the set and direct-file count of every directory above
the structural threshold. The number of unexplained directories and each declared
exception count MUST NOT increase. A moved file MAY update path identity without
justification only when the current-tree measurement proves the same or lower
debt and no test/import ownership is lost.

#### Scenario: A new over-threshold directory appears

- **WHEN** current source contains an over-threshold directory absent from the accepted structural baseline
- **THEN** the exemplary gate fails
- **AND** completion requires splitting it or adding an explicit durable architecture decision with a non-increasing count
