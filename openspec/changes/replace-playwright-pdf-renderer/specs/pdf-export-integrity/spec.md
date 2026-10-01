# Spec Delta

## MODIFIED Requirements

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

### Requirement: PDF export behavior has colocated product tests

PDF repository persistence, authorization, queue payloads, render-ready
coordination, and processor failure behavior MUST be covered by tests
colocated with the API product modules. Those tests MUST stub the renderer
at its HTTP boundary (the worker's render port or an intercepted HTTP
request) and MUST NOT launch a real browser or renderer process. The real
end-to-end render is proven by the runtime acceptance matrix, not by a
per-suite browser harness.

#### Scenario: Repository persistence is exercised

- **WHEN** the API integration suite uses the real Prisma repository
- **THEN** it verifies job creation, terminal state, artifact URL, checksum,
  and requester-bound queue data through fresh reads

#### Scenario: Rendering does not depend on global network idle

- **WHEN** the processor's render request reaches the print page's explicit
  ready contract
- **THEN** its colocated tests verify capture proceeds without waiting for
  unrelated browser connections

#### Scenario: Worker or render fails

- **WHEN** the render outcome or worker reaches terminal failure
- **THEN** no success artifact is persisted and the integration assertion
  fails with the terminal reason

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: The worker's terminal-attempt check matches BullMQ's post-increment attemptsMade

**Reason**: An unrecoverable renderer rejection is terminal while `attemptsMade` is still below `attempts`, so the attempt count alone cannot decide terminality.

**Migration**: Terminal handling reads the current generation-scoped queue state under the export-row lock, per the modified readiness requirement and "Terminal queue states reconcile…".

### Requirement: A PDF export job reaches `failed` only on the terminal BullMQ attempt

**Reason**: Same as above — the count comparison is replaced by queue-state reconciliation.

**Migration**: A retryable attempt (`delayed`, `waiting`, `active`) leaves the row queued; only a terminal queue job with matching identities writes `failed`.
