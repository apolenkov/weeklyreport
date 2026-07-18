## ADDED Requirements

### Requirement: A PDF export job reaches `failed` only on the terminal BullMQ attempt

The PDF export processor's `onJobFailed` handler MUST NOT mark a job's DB
status `failed` on a non-terminal retry attempt. It MUST compare the current
attempt count against the job's configured max attempts and only write the
terminal `failed` status when the attempt was the last one.

#### Scenario: A retryable failure does not surface as failed

- **GIVEN** a PDF export job configured with `attempts: 3`
- **WHEN** the job fails on attempt 1 or 2
- **THEN** the DB row's status is not written `failed`

#### Scenario: The terminal attempt writes the failed status

- **GIVEN** a PDF export job configured with `attempts: 3`
- **WHEN** the job fails on attempt 3
- **THEN** the DB row's status is written `failed` with the error message

### Requirement: PDF export status reads always enforce caller ownership

`getPdfExportStatus` MUST require a `requestedBy` argument and MUST reject
(or omit) any job whose `requestedBy` does not match the caller. The
ownership check MUST NOT be skippable by omitting the argument.

#### Scenario: A caller cannot read another user's export status by omitting the argument

- **GIVEN** a PDF export job owned by user A
- **WHEN** any caller invokes `getPdfExportStatus` for that job id
- **THEN** the ownership check always runs
- **AND** a caller who is not user A does not receive user A's job status

### Requirement: PDF export requests are rejected up front for reports outside the caller's group

`requestPdfExport` MUST check that the requested report is within the
caller's group scope before enqueueing a render job. A request for a
published report outside the caller's group MUST be rejected before any job
is added to the queue.

#### Scenario: A cross-group export request is rejected before enqueue

- **GIVEN** a published report belonging to a group the caller does not
  belong to
- **WHEN** the caller calls `requestPdfExport` for that report
- **THEN** the request is rejected
- **AND** no job is enqueued
