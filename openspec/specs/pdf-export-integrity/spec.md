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

### Requirement: The export button's success signal is gated on artifact delivery

The export button MUST open the result tab synchronously within the
triggering click handler (or via a held-open tab navigated once the
artifact is ready), never from an asynchronous status-poll callback, so
browser popup blockers do not silently discard the open request. This
governs `ExportPdfButton`
(`apps/web/src/features/pdf-export/ui/export-pdf-button.tsx`). The button
MUST NOT report success (`toast.success`) unless the artifact was actually
handed to the user — either the tab navigated to the artifact URL, or, when
`window.open` returns `null`, a visible fallback download link was
rendered.

#### Scenario: Ready job opens without a false-success toast under a popup blocker

- **GIVEN** a browser with default popup-blocker settings
- **WHEN** a user clicks Export PDF and the job reaches `ready`
- **THEN** either a new tab shows the PDF, or a visible download link
  appears in the page
- **AND** `toast.success` fires only in the branch that actually delivered
  the artifact to the user

### Requirement: Status-poll failure recovers the button to a clickable state

`ExportPdfButton`'s status-poll query MUST handle `isError` by clearing the
held `jobId` and surfacing an error toast, mirroring the existing
`requestMut.onError` / `"failed"` recovery path. The button MUST NOT remain
disabled/spinning indefinitely after the poll's retries are exhausted.

#### Scenario: Status endpoint fails after the job is enqueued

- **GIVEN** an export job has been enqueued and the status poll is running
- **WHEN** the status endpoint errors past the poll's retry budget
- **THEN** the button clears its generating state, becomes clickable again,
  and an error toast is shown
- **AND** no page reload is required to recover

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
