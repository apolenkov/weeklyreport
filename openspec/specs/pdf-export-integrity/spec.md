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
timestamp, the frozen publication snapshot, and its indexed publication group
ids. The requester MUST be authorized against that same frozen snapshot and a
non-admin request with an empty frozen scope MUST be rejected. The queue token
MUST carry both the report id and job id, and the print route MUST render the
snapshot stored on that job. It MUST NOT re-read the mutable report publication
for rendering after reopen or republish.

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

The PDF export worker MUST assert the print template's `ready` marker before
calling `page.pdf()`. After navigation reaches DOM content loaded and before
capture, the worker MUST wait for `[data-print-state="ready"]` within a bounded
timeout without waiting for unrelated browser connections,
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
`reportId`, and `requestedBy`, and then verify all three against the persisted
job before updating the database.

#### Scenario: A terminal failure repairs a stranded queued row

- **GIVEN** BullMQ retains a failed PDF job while its database row is still
  queued
- **WHEN** the reconciliation pass runs
- **THEN** the row becomes failed with the BullMQ failure reason

#### Scenario: A completed queue result repairs a stranded row

- **GIVEN** BullMQ retains a completed PDF job with the canonical artifact URL
  and checksum in its return value while its database row is queued
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
coordination, and processor failure behavior MUST be covered by tests colocated
with the API product modules. The repository MUST NOT require a separate browser
integration harness for this contract.

#### Scenario: Repository persistence is exercised

- **WHEN** the API integration suite uses the real Prisma repository
- **THEN** it verifies job creation, terminal state, artifact URL, checksum, and
  requester-bound queue data through fresh reads

#### Scenario: Rendering does not depend on global network idle

- **WHEN** the processor reaches the print page's explicit ready contract
- **THEN** its colocated tests verify capture proceeds without waiting for
  unrelated browser connections

#### Scenario: Worker or render fails

- **WHEN** the render outcome or worker reaches terminal failure
- **THEN** no success artifact is persisted and the integration assertion fails with the terminal reason

### Requirement: PDF completion persistence fails closed before terminal metadata is written

The `PdfExportPrismaRepository.saveExportJob` consumer MUST reject any
completion request whose domain status is not `completed`, whose artifact URL
is not exactly `/pdfs/{jobId}.pdf`, or whose checksum is null or empty. Such an
invalid request MUST perform zero database updates and MUST NOT create a
completed row.

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

### Requirement: PDF export terminal state transitions preserve the first terminal winner

The `PdfExportPrismaRepository` MUST atomically transition an export row from
pending to one terminal state. A failure update that finds an existing
completed or failed row MUST be an idempotent no-op; a failure update for a
missing row MUST reject with a domain error. A completion update that loses a
terminal race MUST not overwrite the existing row, and an identical completed
artifact MUST be returned as an idempotent success.

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

### Requirement: PDF artifact publication is immutable across concurrent attempts

The PDF export processor MUST publish each render through an attempt-owned
temporary file in the canonical artifact directory, make the temporary bytes
durable before publication, and publish the canonical `${jobId}.pdf` path
without replacing an existing entry. It MUST verify the canonical entry as a
regular non-symlink file and persist the checksum of the bytes that remain at
that canonical path. An existing valid canonical file MAY be adopted by a
retry, but an existing symlink or invalid entry MUST be rejected.

#### Scenario: Concurrent attempts cannot overwrite the winning bytes

- **WHEN** two attempts publish distinct bytes for the same job and one
  canonical publication wins before either completion CAS is observed
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
- **AND** a retry finds the existing regular canonical file
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

#### Scenario: A deployment keeps one canonical-writer protocol

- **WHEN** a deployment changes the canonical artifact-write protocol
- **THEN** the `pdf-export` queue is drained or quiesced before workers using a
  different protocol overlap
- **AND** replace-capable and no-replace canonical writers never run
  concurrently

### Requirement: PDF export status polling continues until a terminal result

The web PDF export action MUST keep its status query scheduled while no status has arrived or while the observed job state is non-terminal. Polling MUST stop only after the canonical terminal status `completed` or `failed` is observed. A cold worker that takes longer than one polling interval MUST therefore still deliver its completed artifact or surface its terminal failure without a page reload.

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

### Requirement: An active PDF export survives an in-tab control remount

After a successful enqueue, the web PDF export action MUST preserve the opaque active job ID in browser-tab-scoped storage under the current report identity. If the control remounts or the page reloads before a terminal result, the new instance MUST restore that exact job ID and resume the ownership-bound status query. The stored ID MUST be removed before the client clears its active state on completion, terminal failure, or status-query error, so a stale job cannot keep a later instance busy. No artifact content, bearer credential, or user identity may be stored.

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

- **WHEN** the restored status query errors or returns `failed`
- **THEN** the stored active job ID is removed
- **AND** the control returns to retryable idle with the existing clear error message

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
