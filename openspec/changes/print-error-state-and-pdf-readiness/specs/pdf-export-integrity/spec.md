## ADDED Requirements

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
