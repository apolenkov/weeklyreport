## Purpose

Ensure PDF exports of the weekly report are captured only from a successfully rendered print page, never from a loading spinner or an error state.

## Requirements

### Requirement: PDF export tokens are bound to their requester

Every PDF-export token MUST contain a non-empty `requestedBy` user identifier.
The verifier MUST reject tokens that omit the claim, and the worker session MUST
be rebuilt from that requester so export authorization cannot fall back to a
synthetic identity.

#### Scenario: A token without requestedBy is rejected

- WHEN a PDF-export token omits `requestedBy`
- THEN verification fails before a worker session is established

#### Scenario: A current token rebuilds the requester session

- WHEN a valid PDF-export token includes `requestedBy`
- THEN the worker session is resolved from that user and its current access
  state is checked

### Requirement: A PDF job is an immutable scoped publication

When a PDF export is requested, the job MUST atomically persist the publication
timestamp, the frozen publication snapshot, its indexed publication group ids,
and the initial dispatch generation. The requester MUST be authorized against
that same frozen snapshot and a non-admin request with an empty frozen scope
MUST be rejected. The queue dispatch payload MUST carry the report id, the job
id, the requester id, and the generation being dispatched, and the print route
MUST render the snapshot stored on that job. It MUST NOT re-read the mutable
report publication for rendering after reopen or republish.

#### Scenario: Republish cannot change an already queued export

- GIVEN a queued export for publication P1
- WHEN the report is reopened and republished as P2 before the worker renders
- THEN the worker renders P1 from the job snapshot
- AND P2 cannot authorize, replace, or broaden that job's payload

#### Scenario: A scoped export never leaks another group

- GIVEN a head or viewer authorized for group A and a publication containing A
  and B
- WHEN the export job is created
- THEN its persisted snapshot contains only the caller's frozen scope
- AND the print render and download contain no group-B sections

#### Scenario: The dispatch payload carries the exact generation

- WHEN a PDF export job is enqueued for rendering
- THEN its queue payload contains `jobId`, `reportId`, `requestedBy`, and the
  integer `generation` of the durable row being dispatched

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

### Requirement: PDF export eligibility excludes reopened periods

PDF export eligibility MUST require both companion `status: 'published'` and
`periodStatus: 'published'`. The repository MUST return `null`, the service
MUST raise `PdfExportDomainError` without creating or enqueueing a job, and the
web export control MUST remain disabled while a period is reopened.

#### Scenario: A reopened report cannot be exported

- **GIVEN** a report with `status: 'published'` and `periodStatus: 'reopened'`
- **WHEN** PDF export is requested
- **THEN** the request raises `PdfExportDomainError`
- **AND** no export job is created or enqueued

#### Scenario: The web control agrees with backend eligibility

- **GIVEN** a report whose `periodStatus` is `'reopened'`
- **WHEN** the Export PDF control renders
- **THEN** the control is disabled

#### Scenario: A genuinely published report remains exportable

- **GIVEN** a report with `status: 'published'` and `periodStatus: 'published'`
- **WHEN** PDF export is requested by an in-scope caller
- **THEN** the request proceeds normally

### Requirement: PDF export renders the immutable publication snapshot

`PdfExportPrismaRepository.getPublishedReportForExport` MUST read the selected report's
`publishedSnapshot` and MUST NOT load or assemble the mutable live section
graph. A report eligible for export with an absent, malformed, or
identity-mismatched snapshot MUST fail closed with an integrity error. The
snapshot returned to the renderer MUST retain the persisted publication data
until the export job completes.

The render path MUST build its `WeeklyReportReadModel` exclusively from the
validated, job-bound frozen snapshot; it MUST NOT load mutable live sections.

#### Scenario: A published report uses its frozen snapshot

- **GIVEN** a report with `status: 'published'`, `periodStatus: 'published'`,
  and a valid `publishedSnapshot`
- **WHEN** the PDF repository loads the report
- **THEN** it returns the validated snapshot
- **AND** it does not query or derive live sections

#### Scenario: A published report without a valid snapshot is rejected

- **GIVEN** an eligible report whose snapshot is absent, malformed, or names
  another report
- **WHEN** the PDF repository loads the report
- **THEN** it raises a published-snapshot integrity error

### Requirement: Terminal queue states reconcile to the durable export row

The PDF export runtime MUST periodically inspect retained terminal BullMQ jobs
and reconcile them to the matching pending database row. A failed terminal job
MUST mark the row failed with its failure reason; a completed terminal job MUST
only mark the row completed when its return value contains the canonical
artifact URL and checksum. Existing database terminal states MUST never be
regressed, and a missing or malformed queue result MUST remain observable
without inventing a successful artifact. The reconciliation MUST run after
startup and on a bounded schedule so a process restart repairs a row left
queued by an unavailable database or worker event handler.
Every terminal mutation MUST bind the queue job id to the payload's `jobId`,
`generation`, `reportId`, and `requestedBy`, and then verify all four against
the persisted job before updating the database. A terminal queue job whose
generation does not match the row's current generation MUST NOT update the row.

#### Scenario: A terminal failure repairs a stranded queued row

- **GIVEN** BullMQ retains a failed PDF job while its database row is still
  queued at the same generation
- **WHEN** the reconciliation pass runs
- **THEN** the row becomes failed with the BullMQ failure reason

#### Scenario: A completed queue result repairs a stranded row

- **GIVEN** BullMQ retains a completed PDF job with the canonical artifact URL
  and checksum in its return value while its database row is queued at the same
  generation
- **WHEN** the reconciliation pass runs
- **THEN** the row becomes completed with that artifact and checksum

#### Scenario: Reconciliation never regresses a terminal row

- **GIVEN** the database row is already completed or failed
- **WHEN** a retained terminal BullMQ job is inspected
- **THEN** no database update regresses or overwrites that terminal state

#### Scenario: An incomplete completion result fails closed

- **GIVEN** BullMQ retains a completed PDF job without a canonical artifact
  URL or checksum
- **WHEN** the reconciliation pass runs
- **THEN** the database row is not marked completed and an error is logged

#### Scenario: A stale queue payload cannot terminalize another export

- **GIVEN** a retained terminal BullMQ job whose Redis id or payload identity
  does not match the persisted export row
- **WHEN** the failure listener or reconciliation pass runs
- **THEN** no export row is updated

#### Scenario: An older generation's terminal job cannot rewrite the row

- **GIVEN** a durable export row that advanced to generation g+1
- **WHEN** a retained terminal BullMQ job for generation g is inspected
- **THEN** no database update is applied for the older generation

### Requirement: PDF artifact download is authorized by frozen job ownership

The authenticated PDF download handler MUST authorize a completed artifact by
the immutable `PdfExportJob.requestedBy` user identity persisted at enqueue
time. It MUST NOT re-run mutable report-read, group-membership, section, or
admin visibility checks when serving the bytes. The export request itself still
checks report scope before creating the job; download authorization is a
separate owner-only boundary for the already-created artifact.

#### Scenario: Later group reassignment does not transfer an artifact

- **GIVEN** a completed PDF job owned by user A
- **WHEN** the report's groups or live sections are reassigned after the job was
  created
- **THEN** user A can still download the completed artifact
- **AND** a different user cannot download it merely because their current
  report scope now includes the report

#### Scenario: Artifact access ends only with invalid owner identity

- **GIVEN** a completed PDF job whose `requestedBy` is user A
- **WHEN** user A's identity is no longer valid for session authentication
- **THEN** the download is rejected by the session/authentication boundary
- **AND** the handler does not substitute mutable report or group authorization

### Requirement: Successful PDF delivery creates no blank browser tab

The PDF export React action in `ExportPdfButton`
(`apps/web/src/features/pdf-export/ui/export-pdf-button.tsx`) MUST remain in
the current page and MUST NOT create a temporary browser tab. After a
completed owned job returns a valid artifact URL, it MUST attempt one
same-origin attachment download and MUST expose a persistent fallback
download link. The artifact link MUST use the canonical relative
`/pdfs/{jobId}.pdf` path and resolve to the current page's origin. Re-running
the completion effect for the same job MUST NOT attempt a second download. The
generating spinner MUST use a CSS animation with a reduced-motion override and
MUST NOT use inline animation. Failed jobs MUST return the export control to a
retryable error state without creating a tab.

#### Scenario: Completed artifact is delivered in the current page

- **WHEN** a completed owned PDF job returns a valid artifact URL
- **THEN** one attachment download is attempted, no browser tab is opened,
  and the visible fallback link exposes the same artifact URL

#### Scenario: Automatic download is suppressed

- **WHEN** browser policy suppresses the automatic attachment download
- **THEN** the user can still activate the visible fallback download link
  without restarting the export job

#### Scenario: Export fails

- **WHEN** job creation or status polling reaches a terminal error
- **THEN** no browser tab exists and the export control returns to a retryable
  error state

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

### Requirement: PDF completion persistence fails closed before terminal metadata is written

The `PdfExportPrismaRepository.saveExportJob` consumer MUST reject any
completion request whose domain status is not `completed`, whose artifact URL
is not exactly `/pdfs/{jobId}.pdf`, whose checksum is null or empty, or whose
generation does not match the pending row's generation. Such an invalid request
MUST perform zero database updates and MUST NOT create a completed row.

#### Scenario: Queued completion is rejected without a database write

- **WHEN** `saveExportJob` receives a job with status `queued`
- **THEN** it rejects before calling the Prisma update operation
- **AND** the export row remains unchanged

#### Scenario: Failed completion is rejected without a database write

- **WHEN** `saveExportJob` receives a job with status `failed`
- **THEN** it rejects before calling the Prisma update operation
- **AND** the export row remains unchanged

#### Scenario: Null completion metadata is rejected without a database write

- **WHEN** `saveExportJob` receives a completed job with a null artifact URL or
  null checksum
- **THEN** it rejects before calling the Prisma update operation
- **AND** the export row remains unchanged

#### Scenario: Non-canonical completion URL is rejected without a database write

- **WHEN** `saveExportJob` receives a completed job whose artifact URL is not
  `/pdfs/{jobId}.pdf`
- **THEN** it rejects before calling the Prisma update operation
- **AND** the export row remains unchanged

#### Scenario: A completion for another generation is rejected or ignored

- **WHEN** `saveExportJob` receives a completed job whose generation differs
  from the durable row's current generation
- **THEN** it performs no update that touches the current row
- **AND** it never relabels the stored artifact to the wrong generation

### Requirement: PDF export terminal state transitions preserve the first terminal winner

The `PdfExportPrismaRepository` MUST atomically transition an export row from
pending to one terminal state, fenced to the generation the write claims. A
failure update that finds an existing completed or failed row, or a pending row
at a different generation, MUST be an idempotent no-op; a failure update for a
missing row MUST reject with a domain error. A completion update that loses a
terminal or generation race MUST not overwrite the existing row, and an
identical completed artifact MUST be returned as an idempotent success.

#### Scenario: Missing failure target is distinguishable from a terminal race

- **WHEN** `markExportFailed` is called for an absent export row
- **THEN** it rejects with `PdfExportDomainError`
- **AND** it does not report a successful failure transition

#### Scenario: Failure after completion preserves completed metadata

- **WHEN** completion wins and a later `markExportFailed` call observes the
  completed row
- **THEN** the failure call is a no-op
- **AND** status, artifact path, checksum, and error fields remain coherent for
  the completed artifact

#### Scenario: Identical completion is idempotent

- **WHEN** `saveExportJob` observes an already completed row with the same
  canonical artifact URL and checksum and no error
- **THEN** it returns the completed row without changing it

#### Scenario: A stale-generation terminal write cannot touch the current row

- **GIVEN** an export row that has advanced to a newer generation
- **WHEN** a completion or failure write arrives for an older generation
- **THEN** the write is a no-op
- **AND** status, generation, artifact path, checksum, and error fields of the
  current row are unchanged

### Requirement: PDF artifact publication is immutable across concurrent attempts

The PDF export processor MUST publish each render through an attempt-owned
temporary file in the canonical artifact directory, make the temporary bytes
durable before publication, and publish the generation-scoped canonical
`${jobId}-g${generation}.pdf` path without replacing an existing entry. It MUST
verify the canonical entry as a regular non-symlink file and persist the
checksum of the bytes that remain at that canonical path. An existing valid
canonical file for the same generation MAY be adopted by a retry, but an
existing symlink or invalid entry MUST be rejected. The public artifact URL
remains `/pdfs/{jobId}.pdf`; only the completed row's recorded generation
determines which physical file that URL serves, so an old generation can never
overwrite, adopt, or publish a newer generation's artifact.

#### Scenario: Concurrent attempts cannot overwrite the winning bytes

- **WHEN** two attempts of the same generation publish distinct bytes for the
  same job and one canonical publication wins before either completion CAS is
  observed
- **THEN** the canonical file retains the winner's bytes
- **AND** the completed database row records the checksum of those surviving
  bytes
- **AND** the losing attempt does not unlink or replace the canonical file

#### Scenario: Failure after publication cannot make an artifact servable

- **WHEN** an attempt publishes the canonical file but the database transition
  reaches `failed`
- **THEN** the export row has no completed artifact metadata
- **AND** the download authorization path does not serve the canonical bytes

#### Scenario: A retry adopts a canonical file published before a crash

- **WHEN** a worker crashes after canonical publication but before completion
  persistence
- **AND** a retry of the same generation finds the existing regular canonical
  file
- **THEN** the retry verifies and adopts that file without replacing its bytes
- **AND** it can complete with the checksum computed from the adopted bytes

#### Scenario: EEXIST adoption rejects a symlink canonical entry

- **WHEN** canonical publication encounters an existing symlink at the artifact
  path
- **THEN** the worker rejects the attempt without following the symlink
- **AND** no temporary cleanup operation removes the canonical entry

#### Scenario: Terminal cleanup is limited to attempt-owned temporary files

- **WHEN** completion persistence loses a terminal race or repeats an identical
  completion
- **THEN** cleanup removes only the current attempt's temporary file
- **AND** it never unlinks the canonical file belonging to the terminal row

#### Scenario: An old generation cannot overwrite or adopt a newer artifact

- **GIVEN** an export row that advanced to generation g+1 and a stale worker
  still holding rendered bytes for generation g
- **WHEN** the stale worker publishes
- **THEN** it writes only `${jobId}-g${g}.pdf`, never the newer generation's
  file
- **AND** the public `/pdfs/{jobId}.pdf` URL continues to resolve the completed
  row's generation

#### Scenario: A deployment keeps one canonical-writer protocol

- **WHEN** a deployment changes the canonical artifact-write or dispatch
  protocol, including the introduction of generation-scoped identifiers
- **THEN** the `pdf-export` queue is drained or quiesced and old-protocol
  workers are stopped before workers using a different protocol overlap
- **AND** replace-capable and no-replace canonical writers, or
  generation-aware and pre-generation dispatchers, never run concurrently

### Requirement: PDF export status polling continues until a terminal result

The web PDF export action MUST keep its status query scheduled while no status has arrived or while the observed job state is non-terminal. Polling MUST stop only after the canonical terminal status `completed`, `failed`, or `recovery_required` is observed. A cold worker that takes longer than one polling interval MUST therefore still deliver its completed artifact or surface its terminal failure without a page reload.

#### Scenario: A cold export remains queued across multiple checks

- **GIVEN** a PDF export has started and the worker has not recorded a terminal result
- **WHEN** the status query initially has no data or returns `queued` on successive checks
- **THEN** the client keeps the existing two-second polling interval
- **AND** the export control remains busy without losing the pending job identity

#### Scenario: The worker completes after more than one interval

- **GIVEN** the client has already observed a non-terminal export status
- **WHEN** a later status check returns `completed` with its artifact URL
- **THEN** polling stops
- **AND** the current-page download and persistent fallback link are delivered exactly once

#### Scenario: The worker reaches terminal failure

- **WHEN** a status check returns `failed`
- **THEN** polling stops
- **AND** the existing retryable error recovery clears the busy state

#### Scenario: The row is quarantined for recovery

- **WHEN** a status check returns `recovery_required`
- **THEN** polling stops
- **AND** the export control exits its generating state and surfaces the
  recovery-required message

### Requirement: An active PDF export survives an in-tab control remount

After a successful enqueue, the web PDF export action MUST preserve the opaque active job ID in browser-tab-scoped storage under the current report identity. If the control remounts or the page reloads before a terminal result, the new instance MUST restore that exact job ID and resume the ownership-bound status query. The stored ID MUST be removed before the client clears its active state on completion, terminal failure, recovery quarantine, or a deterministic status-query error. A transient status-query failure MUST retain the ID and continue polling. No artifact content, bearer credential, or user identity may be stored.

#### Scenario: The export control remounts while the worker is running

- **GIVEN** enqueue succeeded and the active job ID was preserved for the current report and tab
- **WHEN** the export control unmounts and mounts again before the worker reaches a terminal state
- **THEN** the new instance restores the same job ID
- **AND** status polling resumes without starting a duplicate export

#### Scenario: The restored job completes

- **WHEN** the restored status query returns `completed` with its artifact URL
- **THEN** the current-page delivery and persistent fallback link are produced exactly once
- **AND** the stored active job ID is removed

#### Scenario: A restored job cannot be read or has failed

- **WHEN** the restored status query returns a deterministic client error or returns `failed` or
  `recovery_required`
- **THEN** the stored active job ID is removed
- **AND** the control returns to retryable idle, surfacing the
  recovery-required message for `recovery_required` and the existing clear
  error message for `failed` or the deterministic query error

#### Scenario: A restored job's status query fails transiently

- **WHEN** the status query fails because the API is temporarily unavailable
- **THEN** the stored active job ID remains and polling continues
- **AND** a later `completed` status delivers the same job's artifact once without another enqueue

### Requirement: Printed reports preserve bounded layout content across page boundaries

The job-bound print template MUST keep every accepted bounded Product and
Activity value within the printable page. Unbroken attention text, entity names,
and contributor names MUST wrap without clipping, truncation, or hiding the
entity status and contributor metadata. Product and Activity sections whose
records exceed one page MUST paginate instead of being treated as indivisible.
Each Product Reports or Activity Reports heading MUST remain on the same page as
its first entity header.

#### Scenario: An unbroken attention value stays within the printable edge

- **GIVEN** a frozen Product with an accepted 500-character unbroken attention value
- **WHEN** the job template renders the Product report
- **THEN** the complete attention value remains visible within the printable page
- **AND** no part of the value is clipped at the right edge

#### Scenario: A long entity header preserves all metadata

- **GIVEN** a frozen Product or Activity with an accepted 200-character unbroken name and contributor name
- **WHEN** the job template renders its entity header
- **THEN** the complete entity name, status, and contributor name remain visible within the printable page

#### Scenario: An oversized report section paginates without an orphan heading

- **GIVEN** a Product or Activity report whose accepted records require more than one page
- **WHEN** the job template paginates that report
- **THEN** its records continue across page boundaries without being suppressed
- **AND** the Product Reports or Activity Reports heading remains with the first entity header instead of occupying an otherwise empty page

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

### Requirement: PDF download streams release resources when the response closes

The download handler MUST destroy its owned file readable when the response closes before delivery completes, including when the response closed while the artifact was being opened. The readable MUST close its owned file descriptor. Normal completion MUST deliver the complete artifact. A read error MUST retain the existing 500 response before headers and response destruction after headers.

#### Scenario: Client closes during delivery

- **WHEN** a client closes the response after receiving only part of an artifact
- **THEN** the file readable is destroyed and its descriptor is closed
- **AND** no further artifact bytes are delivered

#### Scenario: Response closes before the stream is connected

- **WHEN** asynchronous artifact lookup or open completes after the response has closed
- **THEN** the newly owned readable is destroyed and its descriptor is closed

#### Scenario: Normal delivery and read errors

- **WHEN** the artifact is read without interruption
- **THEN** the response contains the complete artifact and the descriptor closes
- **WHEN** reading fails before headers are sent
- **THEN** the handler responds with 500
- **WHEN** reading fails after headers are sent
- **THEN** the handler destroys the partial response

### Requirement: Startup PDF reconciliation failure is recoverable

The non-blocking startup terminal-job reconciliation pass MUST handle and log its own promise rejection. A failed startup pass MUST leave the existing scheduled retry available and MUST NOT install or rely on a global unhandled-rejection suppressor.

#### Scenario: Queue read fails during startup

- **WHEN** the startup reconciliation queue read rejects
- **THEN** the scheduler logs that pass's failure without an unhandled promise rejection
- **AND** a later scheduled pass can read the queue and reconcile retained terminal jobs

### Requirement: The PDF export lifecycle is fenced by a monotonically increasing generation

The durable `PdfExportJob` row MUST carry an integer `generation` that starts
at 1 when the job is created and increments by exactly one on each Head-driven
recovery retry. The durable status vocabulary MUST be `pending`, `completed`,
`failed`, and `recovery_required`, mirrored in `pdfExportStatusSchema` (domain
`queued` for `pending`) and in the domain-to-database mapper in
`pdf-export.job-state.ts`; the shared `pdfExportJobSchema` MUST expose the
generation. The ONLY permitted status transitions are:

- `pending(g)` → `completed(g)`
- `pending(g)` → `failed(g)`
- aged `pending(g)` plus confirmed-absent generation queue job →
  `recovery_required(g)`
- `failed(g)` or `recovery_required(g)` plus a Head retry carrying
  `expectedGeneration=g` → `pending(g+1)`

Every transition MUST be evaluated against the row's current generation, and a
transition that names a different generation MUST NOT write. No path may skip
or reset the generation, resurrect a terminal row without the retry
transition, or automatically re-render a `recovery_required` row.

#### Scenario: A fresh export starts at generation 1

- **WHEN** `requestPdfExport` creates the durable row
- **THEN** the row is `pending` at generation 1
- **AND** the enqueued BullMQ job is addressed by that generation

#### Scenario: Worker outcomes terminalize only their own generation

- **WHEN** a worker finishes generation g of a pending row
- **THEN** the row becomes `completed(g)` or `failed(g)` for that same
  generation
- **AND** no transition can mark a different generation

#### Scenario: Terminal rows stay terminal until a Head retries

- **WHEN** a `completed`, `failed`, or `recovery_required` row receives any
  worker, reconciliation, or scan write
- **THEN** its status and generation remain unchanged
- **AND** only the Head retry transition can return it to `pending`

#### Scenario: A stale generation cannot write

- **WHEN** any lifecycle write names a generation other than the row's current
  generation
- **THEN** the write performs no update

### Requirement: Aged pending exports with confirmed-absent queue jobs are quarantined

The PDF export runtime MUST periodically scan durable `pending` rows whose age
exceeds the configured orphan threshold and quarantine exactly those whose
generation-specific BullMQ job `${jobId}-g${generation}` is confirmed absent.
The scan MUST paginate with a keyset over the immutable `(createdAt, id)`
ordering, bounded at pass start by an upper bound captured before the first
page, and MUST advance the keyset after every inspected row — including rows
whose queue job exists — so a dense run of live jobs can never starve or loop
the pass. For each candidate, the scan MUST hold the export row lock, re-verify
`status='pending'`, the generation, and the age bound, and only then probe the
queue. A Redis error, timeout, or unknown queue outcome MUST NOT be treated as
absence and MUST leave the row `pending`. A confirmed-absent row MUST become
`recovery_required` at its current generation; the system MUST NOT re-render
or re-enqueue it automatically.

Quarantine MUST serialize with dispatch through the per-export row lock: when
the quarantine check wins the lock order, a late dispatcher MUST observe the
`recovery_required` row and no-op; when the dispatch wins, the quarantine probe
MUST observe the enqueued generation job and leave the row `pending`.

#### Scenario: An aged pending row with no queue job is quarantined

- **GIVEN** a `pending` export row older than the orphan threshold
- **AND** its BullMQ job `${jobId}-g${generation}` is confirmed absent
- **WHEN** the orphan scan inspects the row
- **THEN** the row becomes `recovery_required` at the same generation
- **AND** no new queue job is created

#### Scenario: A Redis error is not absence

- **GIVEN** an aged `pending` export row
- **WHEN** the queue probe fails with a Redis error or timeout
- **THEN** the row remains `pending` at its current generation
- **AND** the failure is logged for a later pass

#### Scenario: Live queue jobs never starve the pass

- **GIVEN** more aged `pending` rows than one page, some with live queue jobs
- **WHEN** the scan runs
- **THEN** it advances the `(createdAt, id)` keyset past every inspected row
- **AND** it terminates at the pass-start upper bound rather than chasing rows
  created during the pass

#### Scenario: Quarantine and dispatch serialize on the row lock

- **GIVEN** an aged `pending` row eligible for quarantine and a concurrent
  dispatcher for the same row
- **WHEN** the quarantine wins the row lock
- **THEN** the dispatcher's locked verification sees `recovery_required` and
  performs no queue add
- **WHEN** the dispatcher wins the row lock and adds the generation job first
- **THEN** the quarantine probe sees the job and the row stays `pending`

#### Scenario: A fresh pending row is never quarantined

- **WHEN** the scan inspects a `pending` row younger than the orphan threshold
- **THEN** the row is skipped without probing the queue

### Requirement: A Head retry recreates dispatch through a generation transition

Manual retry of a `failed` or `recovery_required` PDF export MUST accept
`{jobId, expectedGeneration}` and MUST NOT depend on a BullMQ job existing in
Redis. The `expectedGeneration` MUST be bound to the generation the caller
selected — the validated generation-specific queue job identity on the
failed-job-list path, or the explicit input on the recovery surface — and MUST
NOT be re-derived from the durable row's current generation, so a retained
action for an old generation can never advance a newer one. The retry MUST run
as two serialized steps: first a short transaction
that holds the export row lock, verifies the row's status is `failed` or
`recovery_required`, verifies `generation = expectedGeneration`, increments
the generation, clears the terminal fields (`filePath`, `checksum`, `error`),
and commits `pending(g+1)`; then a second short row lock that re-verifies the
row is still `pending` at exactly generation g+1 before adding the queue job
`${jobId}-g${g+1}`. The direct BullMQ `job.retry()` path for PDF exports MUST
be removed; every manual retry entrypoint, including the failed-job list,
MUST funnel through this transition.

An enqueue error, timeout, or lost acknowledgement in the second step MUST NOT
roll back, compensate, or mark the row failed: the row remains
`pending(g+1)` and recoverable by the orphan scan or a later retry. A queue
command already issued whose outcome is unknown cannot be cancelled when the
PostgreSQL lock releases; a job that executes late is contained by the
worker's pending-and-generation fence. Repeating
the same stale `expectedGeneration` after a successful transition MUST be
idempotent — it MUST NOT write another generation and MUST NOT enqueue another
job. A mismatched or ineligible retry MUST NOT write at all.

#### Scenario: A Head retry advances exactly one generation

- **GIVEN** a `failed` or `recovery_required` export row at generation g
- **WHEN** a Head retries with `expectedGeneration=g`
- **THEN** the row commits `pending` at generation g+1 exactly once
- **AND** exactly one queue job `${jobId}-g${g+1}` is added

#### Scenario: A repeated stale expectedGeneration creates nothing

- **GIVEN** a retry already advanced the row to `pending(g+1)`
- **WHEN** the same `{jobId, expectedGeneration=g}` request is repeated
- **THEN** no generation is written
- **AND** no additional queue job is enqueued

#### Scenario: An enqueue failure leaves a recoverable pending row

- **GIVEN** the generation transition committed `pending(g+1)`
- **WHEN** the queue add throws or its acknowledgement is lost
- **THEN** the row stays `pending(g+1)` — never `failed` or rolled back
- **AND** a later orphan scan or retry can still recover it

#### Scenario: An ineligible retry writes nothing

- **WHEN** a retry names a row that is `pending`, `completed`, or at a
  generation other than `expectedGeneration`
- **THEN** no status, generation, or terminal field is updated
- **AND** no queue job is added

#### Scenario: A retained failed-list action cannot advance a newer generation

- **GIVEN** an export row that already advanced to generation g+1 — now
  `failed` or `recovery_required` — while the failed-job list still retains
  the generation-g queue entry
- **WHEN** a Head retries that retained entry
- **THEN** the bound `expectedGeneration=g` fails the locked generation check
- **AND** no generation is written and no queue job is added

### Requirement: Queue dispatch and worker execution are bound to the row's generation

Every PDF export BullMQ job MUST use the job id `${jobId}-g${generation}` and a
payload containing `jobId`, `generation`, `reportId`, and `requestedBy`. Every
queue add — the initial `requestPdfExport` dispatch and every retry dispatch —
MUST be preceded by a row-locked verification that the durable row is
`pending` at exactly the generation being dispatched, so dispatch serializes
with quarantine through the per-export row lock. The
worker MUST reject a payload whose generation is missing or does not match the
durable row's current generation — it MUST NOT substitute the row's current
generation for a missing or stale one. Before rendering, the worker MUST
verify the durable row is `pending` at exactly the payload's generation and
MUST NOT render or write terminal state otherwise. Failure handlers and the
terminal reconciliation MUST address the generation-specific queue job id and
fence their durable writes to that generation.

#### Scenario: A stale-generation worker never renders

- **GIVEN** a durable row that advanced to generation g+1
- **WHEN** a worker picks up a queue job for generation g
- **THEN** the pre-render check rejects it
- **AND** no browser render, artifact write, or status write occurs

#### Scenario: A missing generation is rejected, not repaired

- **WHEN** a queue job payload lacks a generation or carries a malformed one
- **THEN** the worker rejects the job
- **AND** it does not substitute the row's current generation

#### Scenario: Initial dispatch and quarantine serialize on the row lock

- **GIVEN** a row evaluated concurrently by a dispatch verification and a
  quarantine check
- **WHEN** the quarantine commits first
- **THEN** the dispatcher's locked verification sees a non-`pending` row and
  performs no queue add
- **WHEN** the dispatch's locked verify-and-add commits first
- **THEN** the quarantine probe sees the generation job and the row stays
  `pending`

#### Scenario: Generation-fenced terminal writes

- **WHEN** a worker's completion or failure write arrives for generation g
  while the row is already at another generation
- **THEN** the durable row is unchanged

#### Scenario: A deployment does not mix dispatch protocols

- **WHEN** the generation protocol is deployed
- **THEN** old-protocol workers are stopped or the queue is drained before
  generation-aware workers start
- **AND** a queue job from the old protocol is rejected instead of rendered

### Requirement: Failed and recovery-required exports are listed and retried from a DB-backed Head-only surface

The admin jobs surface MUST list durable export rows in `failed` or
`recovery_required` from the database — not from Redis — so a row whose queue
job is gone is still visible and actionable. Listing a `failed` row MUST NOT
depend on whether its terminal BullMQ job is still retained: a job removed or
pruned from Redis leaves the durable row listed. The list and the retry MUST
be exposed through `headProcedure` tRPC procedures,
`admin.jobs.listPdfRecovery` and `admin.jobs.retryPdfRecovery`; the retry
input MUST be exactly `{jobId, expectedGeneration}`. The list item MUST expose
at least `jobId`, `reportId`, `generation`, `requestedBy`, `status`, and
`createdAt`. The retry MUST report whether a generation was advanced, and MUST
distinguish a successful transition from an idempotent no-op and from an
ineligible target. Non-head callers MUST be denied by the canonical middleware
chain.

#### Scenario: A recovery-required row is listed without a Redis job

- **GIVEN** a `recovery_required` export row whose BullMQ job is absent
- **WHEN** a Head opens the recovery list
- **THEN** the row is listed from the database with its current generation

#### Scenario: A failed row is listed whether or not its queue job survived

- **GIVEN** a `failed` export row whose BullMQ job was removed or pruned
- **WHEN** a Head opens the recovery list
- **THEN** the row is listed from the database with its `failed` status and
  current generation
- **AND** retrying it with that `expectedGeneration` dispatches a fresh
  generation queue job

#### Scenario: Recovery retry works with no queue job

- **GIVEN** a listed `failed` or `recovery_required` row
- **WHEN** the Head retries it with the listed `expectedGeneration`
- **THEN** the generation transition runs and a new queue job is dispatched

#### Scenario: The surface stays Head-only

- **WHEN** a non-head session calls the recovery list or retry procedures
- **THEN** the request is denied by the canonical `headProcedure` chain

#### Scenario: Retry outcomes are distinguishable

- **WHEN** a recovery retry resolves
- **THEN** the response distinguishes `retried` (generation advanced), an
  idempotent already-advanced no-op, and an ineligible target

### Requirement: PDF artifact download resolves the completed generation's file

The authenticated download handler MUST keep the public URL
`/pdfs/{jobId}.pdf` and MUST resolve the physical file
`${jobId}-g${generation}.pdf` from the completed row's persisted generation.
It MUST serve bytes only when the row is `completed`, the stored artifact URL
is the canonical public one, and the caller is the immutable requester. It
MUST NOT serve a file whose generation differs from the completed row's
generation, and a missing generation file MUST answer 404. Generation
resolution is mandatory: the handler MUST NOT fall back to the legacy
un-suffixed `${jobId}.pdf` filename. Files left behind
by older generations are inert residue: they MUST NOT be served, adopted, or
deleted by the download or publication paths.

#### Scenario: A completed export serves its own generation's bytes

- **GIVEN** a row `completed` at generation g
- **WHEN** the owner requests `/pdfs/{jobId}.pdf`
- **THEN** the handler streams `${jobId}-g${g}.pdf` after the ownership check

#### Scenario: An old generation file is never served

- **GIVEN** files for generations g and g+1 both on disk while the row
  completed at g+1
- **WHEN** the owner downloads the artifact
- **THEN** only the g+1 file is served
- **AND** the g file is never selected by path or fallback

#### Scenario: A missing generation file fails closed

- **WHEN** the completed row's generation file is absent from the artifact
  directory — including when only a legacy un-suffixed `${jobId}.pdf` exists
- **THEN** the download responds 404 rather than serving any other file

### Requirement: The export UI presents recovery quarantine as a terminal state

When the status query returns `recovery_required`, the export control MUST
exit its generating state, surface the exact message `Recovery required —
export outcome unknown`, and remain retryable for a new export request. The
client MUST NOT retry, re-render, or resurrect the quarantined job itself. The
admin recovery surface MUST present the same quarantined state with the
generation to retry.

#### Scenario: The requester sees the quarantine state

- **WHEN** the observed export status becomes `recovery_required`
- **THEN** the control stops polling and exits the generating state
- **AND** the `Recovery required — export outcome unknown` message is shown

#### Scenario: The Head sees an actionable recovery row

- **WHEN** a Head opens the admin recovery list
- **THEN** each quarantined export shows its identity and current generation
- **AND** the retry action submits `{jobId, expectedGeneration}`

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
