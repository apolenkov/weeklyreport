## ADDED Requirements

### Requirement: Seeded product groups match effective user groups

The canonical `demo`, `full`, and `stress` seed profiles MUST assign every seeded product's explicit reporting-group edge to the effective reporting group of its seeded lead after all profile-specific user-group assignments are applied. Profile validation MUST fail when a product edge and its lead's effective group disagree. The lead Section Preview route MUST therefore render the populated draft products of every seeded lead whose edit form is populated.

#### Scenario: Finance lead opens a populated draft preview

- **WHEN** the `full` profile is seeded and the Finance lead opens `/lead/report/:reportId/preview` for the active report
- **THEN** the preview shows that lead's populated draft products and records
- **AND** it does not show the no-submissions empty state

#### Scenario: Product-group ownership drifts during seed composition

- **WHEN** a seeded product points to a reporting group different from its seeded lead's effective reporting group
- **THEN** profile validation exits nonzero
- **AND** the profile is not accepted as executable product proof
