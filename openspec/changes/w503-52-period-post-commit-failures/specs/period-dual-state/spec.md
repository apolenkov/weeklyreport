## ADDED Requirements

### Requirement: Post-commit reporting failures MUST NOT change a committed outcome

A failure of the step that reports a post-commit failure, or of the audit
emitted after an archive transaction, MUST NOT reject a committed publish, MUST
NOT skip the other post-commit side effect, and MUST NOT report a committed
archive as failed.

#### Scenario: the failure report of a publish side effect throws

- **WHEN** a publish has committed and a post-commit side effect fails
- **AND** the callback that reports that failure throws
- **THEN** the side-effect call resolves
- **AND** the remaining side effect still runs

#### Scenario: the audit of an auto-archive throws

- **WHEN** the auto-archiver has committed the archive of a period
- **AND** the audit emit for it throws
- **THEN** the period is listed as archived
- **AND** it is not counted as a failure
