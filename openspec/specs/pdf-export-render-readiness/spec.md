# pdf-export-render-readiness Specification

## Purpose

Defines how the print template, the PDF worker and the printed layout prove a report rendered completely before it is captured and mapped onto job outcomes.

## Requirements

### Requirement: The print template exposes a machine-detectable render outcome

The print template MUST request the frozen publication through
`pdfExport.render({ jobId, reportId })` and MUST stamp a stable
`data-print-state` attribute on the root element of every render branch, with
exactly one of three values — `loading`, `error`, or `ready` — so the PDF worker
can distinguish a successfully rendered report from a pending or failed render.
A terminal render-query error MUST produce a distinct, visible error state
carrying `data-print-state="error"`, including when the bound job or its frozen
snapshot is unavailable. The renderer MUST NOT fall back to a live report query
or an active-period sentinel. The successful render path MUST carry
`data-print-state="ready"`, and only that path.

#### Scenario: Successful render is marked ready

- **GIVEN** the job-bound `pdfExport.render` query resolves with a renderable frozen report
- **WHEN** the print template renders
- **THEN** its root element carries `data-print-state="ready"`
- **AND** neither `data-print-state="loading"` nor `data-print-state="error"` is present

#### Scenario: Terminal query error renders a visible error state

- **GIVEN** the job-bound `pdfExport.render` query settles into an error after its applicable retry budget
- **WHEN** the print template renders
- **THEN** it returns a distinct, visible terminal error state (not the loading shell) whose root carries `data-print-state="error"`
- **AND** the failure is conveyed on the page itself, not only through a toast

#### Scenario: Unavailable job data renders the error state, not a spinner

- **GIVEN** the bound job or its frozen publication snapshot is unavailable and the render query settles into an error
- **WHEN** the print template renders
- **THEN** it returns the terminal error state with `data-print-state="error"` rather than the loading shell
- **AND** it does not substitute the current live report or an active-period lookup

### Requirement: The PDF worker asserts readiness before capturing the page

The PDF export worker MUST gate capture on the print template's `ready`
marker by delegating rendering to the internal renderer service with a
request that waits for `[data-print-state="ready"]` (and loaded fonts)
inside a bounded duration, without waiting for unrelated browser
connections. The worker MUST fail the current queue attempt when the
renderer wait cannot satisfy the ready marker, including when the page
settles on the `error` marker or never reaches `ready`. Its failed-event
handler MUST reconcile the current generation-scoped queue state under the
existing export-row lock: a retryable attempt whose current queue state is
`delayed`, `waiting`, or `active` MUST leave the durable export row queued;
the row becomes failed only after the current queue job is terminally failed
and its job, report, requester, and generation identities match. An
unrecoverable failure may be terminal while `attemptsMade` is still below the
configured retry count, so the handler MUST NOT use that count alone to
decide whether reconciliation is needed. The artifact write and
`markExportCompleted` MUST run only on the successful-render path, so a
spinner or error page is never checksummed and recorded as a completed
export. The `data-print-state` token strings the render gate matches MUST
stay identical to the ones the print template emits.

#### Scenario: A failed render fails the job instead of exporting a spinner

- **GIVEN** the print page settles into `data-print-state="error"` (or never
  reaches `ready`) inside the renderer
- **WHEN** the worker processes the export job
- **THEN** the readiness gate fails and the worker throws before any artifact
  write
- **AND** `markExportCompleted` is not called; terminal reconciliation writes
  `failed` only if the current generation-scoped queue job is terminal
- **AND** no `.pdf` file is written for that job

#### Scenario: A retryable render failure does not terminalize the export

- **GIVEN** a renderer attempt fails with an outcome that BullMQ will retry
- **AND** the current generation-scoped queue job is `delayed`, `waiting`, or
  `active`
- **WHEN** the failed-event handler re-reads queue state under the export-row
  lock
- **THEN** the durable export row remains queued and no artifact is written

#### Scenario: An unrecoverable render failure terminalizes before the retry limit

- **GIVEN** a pdf-export job has `attempts: 3` and the renderer rejects its URL
  with a deterministic forbidden response
- **WHEN** the worker fails the attempt with `UnrecoverableError` and BullMQ
  marks the current generation-scoped queue job `failed`
- **THEN** terminal reconciliation records the export row as failed even when
  `attemptsMade < 3`
- **AND** no later retry is scheduled and no artifact is written

#### Scenario: A ready render is captured and marked completed

- **GIVEN** the print page reaches `data-print-state="ready"` within the
  bounded wait
- **WHEN** the worker processes the export job
- **THEN** the readiness gate passes and the renderer returns PDF bytes
- **AND** the worker writes the artifact and calls `markExportCompleted`
  with a valid sha256 checksum

### Requirement: Job print preserves frozen Activity content

The job-bound print projection MUST render Activity-parented items, risks, and
decisions exclusively from the validated frozen publication snapshot. It MUST
preserve each record identity exactly once, identify its Activity, and retain
the persisted section author's id, name, and initials in the projection. A
status-only Activity MUST remain visible with its canonical frozen status.
Ranked Activity items MUST retain their priority rank on the printed record.
The print path MUST NOT read mutable live sections or merge display-only
Everyone content.
The Executive Summary MUST count blocked and at-risk Activities alongside
Products, and its decision total MUST include Activity-parented decisions.

#### Scenario: frozen Activity has records from multiple authors

- **GIVEN** a job snapshot whose own sections contain records for one Activity
  from multiple authors
- **WHEN** the print template reaches its ready state
- **THEN** every Activity item, risk, and decision is rendered exactly once
- **AND** the Activity name and each contributing author remain identifiable
- **AND** no mutable live or Everyone-only record is included

#### Scenario: frozen Activity has status but no records

- **GIVEN** a job snapshot containing a status-only Activity
- **WHEN** the print template renders Activity reports
- **THEN** the Activity and its canonical frozen status remain visible
- **AND** its section author remains identifiable as a contributor

#### Scenario: Activity content contributes to the executive summary

- **GIVEN** a frozen snapshot with an at-risk Activity and an Activity decision
- **WHEN** the print template renders the Executive Summary
- **THEN** the at-risk total includes the Activity
- **AND** the decision total includes the Activity decision

### Requirement: Printed next items preserve workflow meaning

Every printed next-week item MUST show a visible English workflow label. In
particular, Planned and Postponed MUST remain distinguishable through text so
their meaning survives grayscale printing. A ranked next item MUST also retain
its visible priority rank.

#### Scenario: planned and postponed items print together

- **GIVEN** a frozen snapshot with one Planned and one Postponed next item
- **WHEN** the job template renders the next-week list
- **THEN** each row shows its corresponding English workflow label
- **AND** the distinction does not rely on color

### Requirement: The PDF worker maps renderer outcomes onto job semantics

The worker MUST classify each render response before the artifact protocol
with a fail-safe bias: a `200` with a valid PDF body proceeds to artifact
publication; a `403` (URL forbidden by outbound filtering) MUST fail the job
without consuming retries (unrecoverable, reconciled to `failed` by the
retained terminal job); a failure the worker proves locally while
constructing the request, before any bytes leave, MUST fail unrecoverably;
and every other outcome — `400`, `409`, `503`, transport failure, client-side
timeout, or a `200` whose body is not a valid PDF — MUST consume the job's
normal retry budget, because those statuses are ambiguous between a
deterministic rejection and a transient print-page outage that was retryable
under the previous renderer.

#### Scenario: A forbidden render request does not retry

- **WHEN** the renderer rejects a conversion with `403`
- **THEN** the job fails unrecoverably on that attempt
- **AND** no further retry is scheduled by BullMQ

#### Scenario: A locally proven malformed request does not retry

- **WHEN** the worker cannot construct a valid render request for the job
- **THEN** the job fails unrecoverably before the request is dispatched
- **AND** no further retry is scheduled by BullMQ

#### Scenario: An ambiguous renderer failure stays retryable

- **WHEN** the renderer answers `400`, `409`, or `503`, or the request fails
  at the transport level
- **THEN** the attempt fails as a normal (retryable) job failure
- **AND** a later attempt can still complete the export

#### Scenario: A temporarily unreachable print page recovers on retry

- **GIVEN** the print origin was unreachable on the first attempt (renderer
  `409` — measured: a dead upstream surfaced through the pinning proxy as
  `502` — or a documented `400` main-page network error)
- **WHEN** the print origin becomes reachable before the job's attempts are
  exhausted
- **THEN** the same job completes with a valid artifact
- **AND** its durable row was never written `failed` for the transient
  attempt

#### Scenario: A renderer restart mid-conversion recovers the same job

- **GIVEN** the renderer is stopped while a conversion for the job is in
  flight, interrupting the HTTP request at the transport level
- **WHEN** the renderer is restarted before the job's attempts are exhausted
- **THEN** the interrupted attempt consumes the job's normal retry budget
  and the durable row is never written `failed` for it
- **AND** a later attempt of the same job completes with a valid artifact
- **AND** the dedicated renderer health signal reflects the outage and the
  recovery while `/health/ready` stays `up`
