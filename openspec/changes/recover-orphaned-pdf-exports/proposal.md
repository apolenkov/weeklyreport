# Proposal

## Why

A PDF export row can sit in `pending` forever: when the BullMQ job behind it
disappears — a lost enqueue acknowledgement, Redis eviction, or a drained
queue — nothing notices, the export control spins until its status poll
errors out, and no one can safely re-render it. The only manual retry drives
BullMQ `job.retry()` on a Redis entry that may not exist, and a late or
duplicated render can overwrite or adopt another attempt's artifact.

Evidence: `pdf-export-reconciliation.scheduler.ts` inspects only retained
_terminal_ queue jobs; `pdf-export.service.ts` marks enqueue-throw failures
but leaves a lost-ack row `pending`; `jobs.service.ts` requires the Redis
job to exist; `pdf-export.artifact-store.ts` publishes one `${jobId}.pdf`
canonical file shared by every attempt.

## What Changes

- `PdfExportJob` gains a `recovery_required` status and a monotonically
  increasing integer `generation`; the durable row remains the single record
  (no attempt ledgers, outbox, or dispatch tables).
- A scheduled orphan scan walks aged `pending` rows with finite,
  starvation-free keyset pagination, rechecks status/generation/age under the
  row lock, and quarantines to `recovery_required` only when the
  generation-specific BullMQ job `${jobId}-g${generation}` is confirmed
  absent. Redis errors or unknown outcomes are never treated as absence.
- Every manual PDF retry — the existing failed-job path included — becomes a
  generation transition `{jobId, expectedGeneration}`: a short locked
  transaction commits `pending(g+1)`, then a separate locked check verifies
  that exact generation before the queue add. Stale `expectedGeneration` is
  idempotent. **BREAKING**: the direct PDF `queue.retry()` path is removed.
- The BullMQ job id, queue payload, worker gate, terminal writes, and
  reconciliation are all generation-fenced; stale-generation workers never
  render or write.
- The internal artifact file becomes `${jobId}-g${generation}.pdf`; the
  public URL stays `/pdfs/${jobId}.pdf` and download resolves the completed
  row's generation.
- A DB-backed, Head-only admin surface lists recovery-required exports and
  retries them without a Redis job; the export UI renders "Recovery required
  — export outcome unknown" and stops polling on it.
- Deployment stops or drains old-protocol workers during the switch.

## Non-goals

- No automatic re-render of quarantined rows; a Head explicitly retries.
- No attempt ledgers, outbox/dispatch-state tables, new abstractions, or new
  dependencies.
- No cleanup of old-generation artifact files (acceptable residue).
- No change to snapshot freezing, checksum, ownership, or scope rules.
- No changes to non-PDF queues or the reminder retry path.

## Capabilities

### Modified Capabilities

- `pdf-export-integrity`: job lifecycle gains `recovery_required` and
  generation fencing; artifact publication moves to generation-scoped files;
  terminal reconciliation, manual retry, download resolution, and status
  polling all change contract.

## Impact

- `prisma/schema.prisma`: `PdfExportStatus` enum + `generation` column; one
  forward-only additive migration (canonical init migration unchanged).
- `packages/shared`: `pdfExportStatusSchema`/`pdfExportJobSchema`, admin
  recovery list/retry contracts.
- `apps/api`: pdf-export module (job-state, ports, service, repository,
  enqueuer, download handler), BullMQ processor/artifact-store/reconciliation
  scheduler, admin jobs service, admin ops router.
- `apps/web`: `use-pdf-export-job`, `export-pdf-button`, admin jobs UI.
- Deploy runbook: stop/drain old pdf-export workers during the switch.
