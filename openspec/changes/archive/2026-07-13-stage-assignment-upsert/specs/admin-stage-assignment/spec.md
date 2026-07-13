## ADDED Requirements

### Requirement: Stage Assignment Save Is Atomic Against The Composite Unique Constraint

Saving a stage assignment MUST use a single atomic `upsert` keyed on the
`StageAssignment` composite unique constraint (`stageId`, `projectId`)
instead of a separate existence read followed by a `create` or `update`.
Two concurrent saves for the same stage/project pair MUST both resolve
successfully, with the row left in a state matching one of the two calls,
and MUST NOT raise an unhandled unique-constraint error to either caller.

#### Scenario: Concurrent reassign of the same stage/project resolves without error

- **GIVEN** a `Stage` and `Project` with no existing `StageAssignment` row
- **WHEN** two `saveStageAssignment` calls for that same `stageId`/`projectId`
  pair, naming different users, run concurrently
- **THEN** both calls resolve without throwing
- **AND** exactly one `StageAssignment` row exists for that stage/project pair
- **AND** its `userId` matches one of the two concurrent callers.

#### Scenario: Sequential reassign still updates the existing row in place

- **GIVEN** an existing `StageAssignment` row for a stage/project pair
- **WHEN** `saveStageAssignment` is called again for the same pair with a
  different `userId`
- **THEN** the same row `id` is returned with the new `userId`
- **AND** no second row is created for that stage/project pair.
