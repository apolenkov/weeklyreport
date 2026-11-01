# pdf-export-state-integrity Specification

## Purpose

Defines how terminal queue states, completion persistence and artifact publication stay consistent, immutable and fail closed for every PDF export row.

## Requirements

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
