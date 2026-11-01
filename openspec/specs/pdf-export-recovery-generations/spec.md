# pdf-export-recovery-generations Specification

## Purpose

Defines the monotonic export generation, quarantine of aged pending exports and the Head-only retry and recovery listing that depend on it.

## Requirements

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
