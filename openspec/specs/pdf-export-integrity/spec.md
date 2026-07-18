## Purpose

Ensure PDF exports of the weekly report are captured only from a successfully rendered print page, never from a loading spinner or an error state.

## Requirements

### Requirement: The print template exposes a machine-detectable render outcome

The print template MUST stamp a stable `data-print-state` attribute on the root
element of every render branch, with exactly one of three values —
`loading`, `error`, or `ready` — so an out-of-band consumer (the PDF worker's
headless browser) can distinguish a successfully rendered report from a page that
is still loading or has terminally failed. A terminal query error, and the
`no-period` sentinel, MUST render a distinct, visible error state carrying
`data-print-state="error"` rather than the perpetual loading shell. The
successful render path MUST carry `data-print-state="ready"`, and only that path.

#### Scenario: Successful render is marked ready

- **GIVEN** the `weeklyReport.get` query resolves with a renderable report
- **WHEN** the print template renders
- **THEN** its root element carries `data-print-state="ready"`
- **AND** neither `data-print-state="loading"` nor `data-print-state="error"` is
  present

#### Scenario: Terminal query error renders a visible error state

- **GIVEN** the `weeklyReport.get` query settles into an error after its retries
  are exhausted
- **WHEN** the print template renders
- **THEN** it returns a distinct, visible terminal error state (not the loading
  shell) whose root carries `data-print-state="error"`
- **AND** the failure is conveyed on the page itself, not only through a toast

#### Scenario: No-period sentinel renders the error state, not a spinner

- **GIVEN** the query resolves with the `no-period` sentinel payload
- **WHEN** the print template renders
- **THEN** it returns the terminal error state with `data-print-state="error"`
  rather than the loading shell

### Requirement: The PDF worker asserts readiness before capturing the page

The PDF export worker MUST assert the print template's `ready` marker before
calling `page.pdf()`. After navigation reaches network idle and before capture,
the worker MUST wait for `[data-print-state="ready"]` within a bounded timeout,
and MUST fail the job — throwing so the existing `onJobFailed → markExportFailed`
path records the failure — when the `error` marker is present or the ready marker
never appears. `page.pdf()`, the file write, and `markExportCompleted` MUST run
only on the ready path, so a spinner or error page is never checksummed and
recorded as a completed export. The `data-print-state` token strings the worker
matches MUST stay identical to the ones the print template emits.

#### Scenario: A failed render fails the job instead of exporting a spinner

- **GIVEN** the print page settles into `data-print-state="error"` (or never
  reaches `ready`) inside the worker's headless browser
- **WHEN** the worker processes the export job
- **THEN** the readiness assertion fails and the worker throws before
  `page.pdf()`
- **AND** `markExportCompleted` is not called; the job routes through
  `onJobFailed → markExportFailed`
- **AND** no `.pdf` file is written for that job

#### Scenario: A ready render is captured and marked completed

- **GIVEN** the print page reaches `data-print-state="ready"` within the timeout
- **WHEN** the worker processes the export job
- **THEN** the readiness assertion passes and the worker calls `page.pdf()`
- **AND** it writes the artifact and calls `markExportCompleted` with a valid
  sha256 checksum

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

### Requirement: Legacy PDF-export synthetic session satisfies userSessionSchema

The legacy (pre-`requestedBy`) PDF-export synthetic session MUST parse successfully against `userSessionSchema`, including a `userId` that is a valid UUID accepted by `z.uuid()`.

#### Scenario: Legacy synthetic session parses against userSessionSchema

- WHEN `buildLegacyPdfExportSession(reportId)` constructs the synthetic
  session for an inbound PDF-export cookie with no `requestedBy` claim
- THEN `userSessionSchema.safeParse(session).success` is `true`

#### Scenario: Synthetic user id is composed only of hex digits and dashes

- WHEN the synthetic PDF-export `userId` constant is inspected
- THEN every character outside the UUID's dash separators is a hex digit
  (`0-9`, `a-f`)
