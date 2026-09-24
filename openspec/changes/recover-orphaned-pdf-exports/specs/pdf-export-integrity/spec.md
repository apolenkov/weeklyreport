# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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

### Requirement: Recovery-required exports are listed and retried from a DB-backed Head-only surface

The admin jobs surface MUST list durable export rows in `recovery_required`
from the database — not from Redis — so a row whose queue job is gone is still
visible and actionable. The list and the retry MUST be exposed through
`headProcedure` tRPC procedures, `admin.jobs.listPdfRecovery` and
`admin.jobs.retryPdfRecovery`; the retry input MUST be exactly
`{jobId, expectedGeneration}`. The list item MUST expose at least `jobId`,
`reportId`, `generation`, `requestedBy`, `status`, and `createdAt`. The retry
MUST report whether a generation was advanced, and MUST distinguish a
successful transition from an idempotent no-op and from an ineligible target.
Non-head callers MUST be denied by the canonical middleware chain.

#### Scenario: A recovery-required row is listed without a Redis job

- **GIVEN** a `recovery_required` export row whose BullMQ job is absent
- **WHEN** a Head opens the recovery list
- **THEN** the row is listed from the database with its current generation

#### Scenario: Recovery retry works with no queue job

- **GIVEN** a listed `recovery_required` row
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

### Requirement: Generation-1 artifact migration preserves pre-protocol artifacts

Before the generation-aware download reader is enabled, a one-time quiesced
migration MUST make every pre-existing `completed` export's artifact available
under its generation-1 canonical name. The migration MUST ship as a separate
one-shot compiled `pdf-artifact-migrator` container running a compiled Node
entrypoint — never a tsx or `prisma/operations` script inside the production
runner or schema-migrator image, and the image MUST NOT carry tsx, the prisma
CLI, or prisma operations tooling. Its PostgreSQL access MUST be read-only:
a single session pinned `default_transaction_read_only=on` issuing only
SELECTs of `completed` rows; the migrator MUST NOT write to the database and
MUST leave every durable field unchanged. The disposable-target contract in
`prisma/guards/_destructive-guard.ts` MUST remain unchanged — the production
migrator does not run under it, and local disposable-database verification of
this change still passes through the existing guard.

For each `completed` row the migration MUST verify that `${jobId}.pdf` is a
regular non-symlink file whose sha256 matches the row's persisted checksum,
then create `${jobId}-g1.pdf` as an additional hard-linked directory entry —
never overwriting, renaming away, or deleting the legacy file. On EEXIST the
existing `${jobId}-g1.pdf` is foreign unless a durable record owned by this
job proves it is the run's own interrupted link: a checksum-valid destination
without such a record MUST be reported as an anomaly and left untouched —
never adopted, never deleted — and no intent record may be persisted while a
destination already exists. A row whose legacy file is
missing, not a regular file, or fails the checksum MUST be skipped and
reported, with the durable row left unchanged.

`check` MUST be the default mode: it validates and reports every row's
verdict without creating, deleting, or modifying any artifact or record —
the `.migration/lock` run lock is transient state every mode, `check`
included, creates for the run and removes on clean completion. `apply` and
`rollback` MUST refuse to run without a dedicated confirmation token bound to
the resolved database target (host, port, database) — the `DATABASE_URL`
MUST carry that identity in its authority and path with an explicit port (an
omitted port is inherited from `PGPORT` at connect time and is refused), and
connection-identity query parameters the PostgreSQL driver would resolve
instead (host, port, database, user, password) MUST be refused.

Every mode — `check`, `apply`, and `rollback` — MUST run under a single
global exclusive lock: the directory `PDF_OUTPUT_DIR/.migration/lock`,
acquired with `mkdir`, refused safely on `EEXIST`, and removed on normal
completion. A crashed run MUST leave the lock in place; the lock MUST never
be reclaimed automatically by PID, age, or heartbeat. Recovery is
operator-controlled: with the old api and all migrators quiesced and the
operator confirming no run is active, remove only the empty lock directory
and rerun — the records make the rerun idempotent.

Every link `apply` creates MUST be recorded in a per-job durable record at
`PDF_OUTPUT_DIR/.migration/records/<jobId>.json` so ownership survives the
one-shot container. A record MUST carry the schema version, the operation
UUID that wrote the transition, the jobId, the source and destination
basenames and absolute paths, the source device and inode as strings, the
sha256, and a state of `intent`, `committed`, `rollback-intent`, or
`rolled-back`; records are strict-schema single-line JSON with a mandatory
final newline. Record reads MUST NOT follow symlinks and MUST verify a
regular file, and a corrupt, symlinked, or non-regular record MUST block
mutation for its row. Every state transition MUST be persisted atomically:
the complete JSON plus newline staged in a unique `crypto.randomUUID` temp
file inside `records/`, opened `O_CREAT|O_EXCL|O_WRONLY|O_NOFOLLOW` so an
existing temp or record is never truncated, fsynced, closed, renamed over
the record path, and the records directory fsynced. Pre-existing temp files
MUST be left untouched.

`apply` MUST persist the durable `intent` record BEFORE `link()`, then
fsync the artifact directory and persist `committed`; a destination that
already exists without a matching record is foreign — even a hard link
sharing the source inode — and MUST never be overwritten or adopted, so the
fresh intent is persisted only after the destination is verified absent. The
`.migration` and `records` directories MUST be fsynced through their parents
before any link is created. An interrupted run recovers from the record: for
`intent`, an absent destination retries the link only while the recorded
source device and inode still describe the live verified source — a stale
identity is reported with nothing linked — a destination still identical to
the recorded source inode and checksum finalizes `committed`, and a mismatch
is reported with nothing deleted. `check` MUST NOT report a row's link as
complete for an `intent`, `rollback-intent`, corrupt, or otherwise invalid
record, and MUST fail while ANY record under `records/` — whether or not its
job is in the current selection — is corrupt or still mid-flight.

`rollback` MUST require a `committed` record, re-verify the destination
against the recorded path, inode, and checksum, persist `rollback-intent`,
unlink only that verified destination, fsync the artifact directory, and
persist `rolled-back`; a crashed `rollback-intent` recovers identically — a
matching destination retries the unlink, an absent destination finalizes
`rolled-back`, and a mismatch is reported with nothing deleted. A record in
`intent` is unresolved mid-flight apply state: it MUST block rollback as an
anomaly — `apply` owns its resolution — and is never unlinked or finalized
by rollback.

The migration runs while pdf-export producers and workers are stopped, after
`prisma migrate deploy` and before the generation-aware api is activated;
operators run `check`, then a confirmed `apply`, then `check` again, which
MUST exit 0 and report `pending=0` and `anomalies=0` before activation —
zero pending links alone is not sufficient. The artifact root and the
`.migration` parent directories are assumed controlled and quiesced for the
whole window — Node has no `openat`-style protection against a hostile
process swapping parent directories mid-run, so that quiescence is part of
the safety contract. A rollback is valid only inside that quiesced
pre-activation window and MUST remove only record-owned destinations still
identical to their record — legacy files and any entry no valid record owns
are never removed, so the migration can never lose or corrupt an existing
artifact. Once generation-aware dispatch, workers, and
the download reader are activated, ordinary code rollback is unsafe — a
completed artifact may exist only as `${jobId}-g${generation}.pdf`, which the
old reader cannot resolve. From that point recovery MUST be forward-only and
MUST preserve all durable rows, artifacts, and queue entries; no reverse
migration or permanent compatibility fallback is introduced.

#### Scenario: A valid legacy artifact gains its generation-1 name

- **GIVEN** a `completed` row and a regular `${jobId}.pdf` whose bytes match
  the row's checksum
- **WHEN** the artifact migration runs in `apply` mode
- **THEN** `${jobId}-g1.pdf` exists as a hard link to the same bytes
- **AND** the legacy `${jobId}.pdf` entry is untouched
- **AND** the created link is recorded in its durable per-job migration
  record as `committed`

#### Scenario: Check mode is the default and writes no durable state

- **GIVEN** `completed` rows whose `${jobId}-g1.pdf` links are missing
- **WHEN** the migrator runs without an explicit mode or confirmation
- **THEN** it reports each row's verdict and changes no artifact, record, or
  durable field — the `.migration/lock` run lock exists only as transient
  state for the run and is removed on clean completion
- **AND** it reports at least one pending link so the deploy gate stays open

#### Scenario: Apply refuses without a target-bound confirmation

- **WHEN** `apply` or `rollback` is requested without a confirmation token
  matching the resolved database host, port, and name
- **THEN** the migrator refuses before any filesystem mutation

#### Scenario: An existing destination is verified, never overwritten

- **GIVEN** a row whose `${jobId}-g1.pdf` entry already exists
- **WHEN** `apply` encounters the EEXIST destination
- **THEN** a destination matching the recorded `intent` is finalized
  `committed` and reported as already linked
- **AND** a destination with no matching record — even a hard link to the
  same inode — is reported as foreign and never replaced or adopted

#### Scenario: An unservable legacy artifact is skipped and reported

- **WHEN** a `completed` row's `${jobId}.pdf` is missing, a symlink, or fails
  the persisted checksum
- **THEN** the row is skipped, the anomaly is reported, and no file or durable
  field is changed

#### Scenario: Pre-activation rollback removes only record-owned identical links

- **GIVEN** the generation-1 artifact migration ran and generation-aware code
  has not yet been activated
- **WHEN** the deployment is rolled back inside the quiesced pre-activation
  window
- **THEN** only destinations owned by a valid committed migration record and
  still identical to it are removed
- **AND** every pre-existing `${jobId}.pdf` file and any unrecorded entry
  remains in place

#### Scenario: A crashed run is recovered from its records, never by stealing the lock

- **GIVEN** a migrator run that died holding `.migration/lock`
- **WHEN** a later run starts in any mode
- **THEN** it refuses while the lock exists and is never reclaimed
  automatically
- **AND** after an operator — with all migrators quiesced — removes the
  empty lock directory, the rerun resumes each row idempotently from its
  record state (`intent` retries or finalizes, `rollback-intent` retries or
  finalizes)

#### Scenario: Post-activation recovery is forward-only

- **GIVEN** generation-aware dispatch, workers, and the download reader are
  activated
- **WHEN** a defect is discovered in the new protocol
- **THEN** recovery proceeds forward — no rollback removes durable rows,
  artifacts, or queue entries

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
