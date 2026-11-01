## Purpose

Keep PDF export state, generation, access and delivery integrity. Render readiness, recovery generations and client status live in their own capabilities (pdf-export-render-readiness, pdf-export-state-integrity, pdf-export-recovery-generations, pdf-export-client-status).

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

#### Scenario: A frozen report has no products

- **GIVEN** a frozen report whose product collection is empty
- **WHEN** the job-bound print template renders it
- **THEN** it emits neither a Product Reports heading nor a page break for that absent collection
- **AND** Activity Reports content and nonempty Product report output remain unchanged

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

The artifact MUST be opened without following a symlink at the artifact path.
A symlink there MUST answer the same empty 404 as a missing file and MUST emit
one warning log, distinct from the missing-file case, carrying only the job id
and the errno code. Any other artifact open failure MUST answer 500 with an
error log carrying only the job id and the errno code.

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

#### Scenario: A symlinked artifact is refused opaquely and logged

- **GIVEN** a completed row whose generation artifact path is a symlink
- **WHEN** the owner requests `/pdfs/{jobId}.pdf`
- **THEN** the response is an empty 404
- **AND** exactly one warning log names the job id and the code `ELOOP`
- **AND** no error log is emitted and no file path is logged

#### Scenario: A missing artifact stays silent

- **WHEN** the completed row's generation file is absent
- **THEN** the response is 404
- **AND** no warning or error log is emitted

### Requirement: The export UI presents recovery quarantine as a terminal state

When the status query returns `recovery_required`, the export control MUST
exit its generating state, surface the exact message `Recovery required —
export outcome unknown`, and remain retryable for a new export request. The
client MUST NOT retry, re-render, or resurrect the quarantined job itself. The
admin recovery surface MUST present the same quarantined state with the
generation to retry.

A replacement request from ExportPdfButton MUST retain the recovery-required notice while pending or if it fails before a new job ID is acknowledged; the notice MUST clear only when a replacement job is acknowledged.

#### Scenario: The requester sees the quarantine state

- **WHEN** the observed export status becomes `recovery_required`
- **THEN** the control stops polling and exits the generating state
- **AND** the `Recovery required — export outcome unknown` message is shown

#### Scenario: The Head sees an actionable recovery row

- **WHEN** a Head opens the admin recovery list
- **THEN** each quarantined export shows its identity and current generation
- **AND** the retry action submits `{jobId, expectedGeneration}`

#### Scenario: A failed replacement retains the quarantine notice until a later acknowledgement

- **GIVEN** the current report displays the recovery-required notice and the quarantined job is no longer active
- **WHEN** the requester starts a replacement export
- **THEN** the notice remains visible while the replacement request is pending
- **AND** if the request fails before acknowledging a new job ID, the notice remains and the control is idle and retryable
- **WHEN** a later explicit replacement request acknowledges a new job ID
- **THEN** the notice clears and the new job ID becomes the stored active job for the current report
- **AND** the client never automatically requests or resurrects the quarantined job

### Requirement: Initial PDF dispatch failure remains the primary request error

The initial `pdfExport.request` dispatch failure MUST remain the primary error returned by its service boundary even when generation-bound failure persistence rejects. The API MUST retain diagnostics for the original failure and separately identify the compensation failure by job and generation. Internal error details MUST NOT be exposed in the transport response.

#### Scenario: Compensation fails after initial dispatch rejects

- **GIVEN** an authorized published-report request created a queued export at generation 1
- **WHEN** initial dispatch rejects and failure persistence also rejects
- **THEN** the request service rejects with the original dispatch error
- **AND** diagnostics distinguish the secondary persistence failure for the same job and generation
- **AND** the failed persistence is not reported as a successful durable state change

#### Scenario: Compensation succeeds after initial dispatch rejects

- **GIVEN** an authorized published-report request created a queued export at generation 1
- **WHEN** initial dispatch rejects and failure persistence succeeds
- **THEN** the request service rejects with the original dispatch error
- **AND** the generation-bound export is marked failed by the existing terminal-state fence

### Requirement: Authorized PDF artifact responses declare a private no-storage cache policy

The authenticated `/pdfs/{jobId}.pdf` download handler MUST send `Cache-Control: private, no-store` before streaming an authorized artifact. The response MUST retain its PDF content type, attachment disposition, and completed-generation artifact bytes.

#### Scenario: Requester downloads a completed artifact

- **WHEN** an authenticated requester downloads their completed canonical PDF artifact
- **THEN** the response carries `Cache-Control: private, no-store`
- **AND** the response retains PDF content type, attachment disposition, and the authorized generation's bytes

### Requirement: The PDF recovery list is paginated with a continuation cursor

`admin.jobs.listPdfRecovery` SHALL accept an optional `limit` (1–200, default 50) and an optional `cursor`, and SHALL return `jobs` plus `nextCursor`. Rows
SHALL be ordered by `createdAt` ascending, then `jobId` ascending. The cursor
SHALL identify the last returned row by `{createdAt, jobId}`, and the next page
SHALL contain only rows strictly after it in that order. `nextCursor` SHALL be
null when the page holds fewer than `limit` rows. Every listed row SHALL remain
reachable by following `nextCursor`; the list SHALL NOT drop rows to fit a page.
The Head recovery panel SHALL load further pages on request and SHALL NOT
present a total count until the last page is loaded. Where another recovery
scenario says a row is listed, the row SHALL appear on the first page or on a
page reached by following `nextCursor`. A failed next-page load SHALL keep the
rows already loaded on screen.

#### Scenario: Rows beyond the first page stay reachable

- **GIVEN** 51 `failed` or `recovery_required` export rows
- **WHEN** a Head lists recovery rows without a cursor
- **THEN** the first 50 rows by `createdAt`, `jobId` are returned with a
  `nextCursor`
- **AND** listing with that cursor returns the 51st row and a null `nextCursor`

#### Scenario: A retried row does not shift later pages

- **GIVEN** a Head has loaded the first page
- **WHEN** a row on that page is retried and leaves the recovery set
- **THEN** listing with the earlier `nextCursor` still starts after the last
  row of the first page and skips no remaining row

#### Scenario: The limit is bounded

- **WHEN** a Head requests a `limit` above 200
- **THEN** the request is rejected by input validation
