## ADDED Requirements

### Requirement: Repeated print jobId is absent

The print route MUST type jobId as string or string array and MUST treat an array as absent, never authorizing a worker render from one repeated value.

#### Scenario: Worker receives repeated jobId

- **WHEN** a print worker request includes repeated jobId values
- **THEN** the route follows its absent-jobId redirect
- **AND** no export render read executes
