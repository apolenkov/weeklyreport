## ADDED Requirements

### Requirement: The worker's terminal-attempt check matches BullMQ's post-increment attemptsMade

The `pdf-export` worker's `failed` event handler MUST decide whether a job
export has exhausted its retries by comparing `job.attemptsMade` directly
against the job's configured `attempts` (`job.attemptsMade >=
maxAttempts`), never by adding an extra increment on top of
`job.attemptsMade`. BullMQ increments `attemptsMade` before emitting the
`failed` event, so for a job configured with `attempts: N` the handler
observes `attemptsMade` values `1..N` across its retries, and only the
`N`th failure is truly terminal — a retry is still queued for every earlier
value. `markExportFailed` MUST fire only on that true terminal failure, not
one attempt early.

#### Scenario: A penultimate attempt with a retry still queued does not mark the export failed

- **GIVEN** a pdf-export job configured with `attempts: 3`
- **AND** the Worker's `failed` event fires with `attemptsMade: 2`
- **WHEN** the `failed` handler runs
- **THEN** `markExportFailed` is NOT called
- **AND** the export row is left for the still-pending third attempt

#### Scenario: The true terminal attempt marks the export failed

- **GIVEN** a pdf-export job configured with `attempts: 3`
- **AND** the Worker's `failed` event fires with `attemptsMade: 3`
- **WHEN** the `failed` handler runs
- **THEN** `markExportFailed` is called with the job's `jobId` and the
  error message

#### Scenario: The check matches the DLQ monitor's terminal definition

- **GIVEN** the same job and the same `attemptsMade`/`attempts` values
- **WHEN** both the `pdf-export` worker's `failed` handler and the DLQ
  monitor's exhausted-retry check evaluate that job
- **THEN** they agree on whether the job has exhausted its retries
