## ADDED Requirements

### Requirement: Cache invalidation preserves its freshness fence

The read-through cache's prefix invalidation MUST remove matching data entries while retaining its own generation metadata. A full-prefix or metadata-matching prefix MUST NOT reset the generation fence used by in-progress computations.

#### Scenario: Full-prefix invalidation preserves metadata

- **WHEN** cache invalidation is requested with an empty prefix
- **THEN** matching data entries are removed
- **AND** the generation metadata retains the advanced generation

#### Scenario: A metadata-matching prefix cannot delete the fence

- **WHEN** invalidation matches both generation metadata and ordinary data keys
- **THEN** the data keys are deleted
- **AND** the generation metadata remains available
