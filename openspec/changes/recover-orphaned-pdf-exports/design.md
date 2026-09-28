# Design

## Context

See proposal.md for motivation. Current state at HEAD `230c28f`:

- `PdfExportJob` (`prisma/schema.prisma`) is the single durable record:
  `status: pending|completed|failed`, `filePath`, `checksum`, `error`,
  `requestedBy`, immutable `publicationSnapshot`/`publicationAt`. No
  generation concept; the BullMQ job id is the bare `jobId`.
- `PdfExportService.retryFailedExport` (added by FR-032) revives `failed →
pending` inside `runLockedExportJob` and calls BullMQ `job.retry()` on the
  _same_ queue entry — impossible when the queue job is gone, and it reuses a
  queue id BullMQ may treat as a silent no-op after retention pruning.
- `PdfExportReconciliationScheduler` inspects only _terminal_ queue jobs;
  nothing ever looks at aged `pending` rows, so a lost enqueue ack, Redis
  eviction, or pruned job strands the row forever.
- `pdf-export.artifact-store.ts` publishes one canonical `${jobId}.pdf`;
  every attempt shares it, so a late old-protocol render could overwrite or
  adopt another attempt's bytes.

Constraints: no new tables/abstractions/dependencies (packet); the row lock
(`runLockedExportJob`, `SELECT … FOR UPDATE`) is the single serialization
lane; queue side effects can never roll back. Ops constraint: the production
API runner deliberately excludes tsx, the prisma CLI, and `prisma/operations`,
while the schema-migrator image intentionally carries the prisma CLI to run
`migrate deploy` and likewise excludes tsx and the operations tree (all
asserted in `Dockerfile.api`) — so the artifact migration must ship compiled
and self-contained, with no tsx or prisma operations in the runner or the new
`pdf-artifact-migrator`.

## Goals / Non-Goals

**Goals:**

- Detect aged `pending` rows whose generation queue job is confirmed absent
  and park them at `recovery_required` — visible, never auto re-rendered.
- Replace `queue.retry()` with a durable generation transition so retry works
  when the Redis job is absent and a re-render can never collide with a prior
  attempt's queue id or artifact file.
- Fence every terminal/reconciliation write by generation so stale workers
  and stale queue entries cannot touch the current row.

**Non-Goals:**

- Attempt ledgers, outbox/dispatch tables, new dependencies (per packet).
- Cleanup of old-generation artifact files — inert residue.
- Changing the reminder queue path, snapshot freezing, checksum, ownership,
  or scope rules.
- Automatic recovery of quarantined rows.

## Decisions

### One row, one new status, one integer — nothing else persisted

`PdfExportStatus` gains `recovery_required`; `PdfExportJob` gains
`generation Int @default(1)` (first dispatch is generation 1).
`pdfStatusToDb`/`dbStatusToDomain` map DB `recovery_required` ↔ domain
`recovery_required`; `pdfExportStatusSchema` and `pdfExportJobSchema`
(generation `int().min(1)`) move in `@customreport/shared` first. No other
durable state is needed: BullMQ is dispatch evidence, not truth; the row plus
`expectedGeneration` carry all retry semantics.

_Alternative:_ an attempt table or outbox — rejected by the packet's minimal
architecture; the row lock already gives the required serialization.

### Generation-scoped dispatch identity

`PdfExportEnqueueInput` gains `generation`; `PdfExportBullmqEnqueuer` adds
with BullMQ job id `${jobId}-g${generation}` and payload
`{jobId, generation, reportId, requestedBy}` (plus trace context). Queue
lookups everywhere (`getJob` in `markTerminalFailure`,
`loadCurrentTerminalState`, admin adapter, orphan probe) address the
generation-scoped id — never the bare `jobId`. A migrated `pending` row whose
legacy-id job still sits in Redis is therefore correctly seen as
unrecoverable under the new protocol and funnels to `recovery_required`.

_Alternative:_ keep bare `jobId` for generation 1 — rejected: dual id
schemes would fork every queue lookup and invite substitution bugs; the
packet fixes `${jobId}-g${generation}` uniformly.

### Retry = commit `pending(g+1)`, then locked verify + add

`PdfExportService.retryFailedExport` is replaced by
`retryExportGeneration({jobId, expectedGeneration})`:

```
Phase A (tx):  SELECT … FOR UPDATE
               status ∈ {failed, recovery_required} AND generation = expected
               → UPDATE status='pending', generation=g+1,
                       filePath=NULL, checksum=NULL, error=NULL
               → commit                      (durable truth first)
Phase B (tx):  SELECT … FOR UPDATE
               status='pending' AND generation=g+1
               → queue.add(`${jobId}-g${g+1}`, payload) inside the lock
               → commit                      (no row writes)
```

- `expectedGeneration` is bound to the generation the caller selected —
  the validated generation-specific queue identity (`${jobId}-g${g}` plus
  matching payload `generation`) on the failed-list path, the explicit input
  on the recovery surface — and is NEVER re-derived from `row.generation`.
  A retained g1 action against a row already at g2 fails the locked check
  and writes nothing; this is the anti-regression for stale list entries.
- Enqueue throw or lost ack in phase B leaves `pending(g+1)` — recoverable by
  the orphan scan or a later retry; never compensated, never marked failed.
  A Redis command already issued with unknown outcome cannot be cancelled
  when the PostgreSQL lock releases — the worker's pending+generation fence
  is what contains a job that executes late.
- Repeating `{jobId, expectedGeneration=g}` after success hits phase A,
  sees `pending`/`g+1`, writes nothing, returns an idempotent
  `already-advanced` outcome; no second queue job.
- Phase B inside the lock is what serializes dispatch against quarantine:
  if quarantine committed first the verify fails and no `add` happens; if the
  add lands first the quarantine probe sees the job.

_Alternative:_ one transaction containing both the generation bump and the
queue add — rejected; it couples an un-rollback-able Redis effect to the
state commit and cannot express "row stays pending on lost ack".

### One dispatch lane for initial and retry enqueue

`requestPdfExport` keeps its existing create → enqueue → mark-failed-on-throw
shape, but the enqueue step now runs through the same locked verify+add the
retry phase B uses: after `createExportJob` commits `pending(g=1)`, a short
row lock re-verifies `status='pending' AND generation=1` before
`queue.add(`${jobId}-g1`)` inside the lock. Initial dispatch and quarantine
therefore serialize identically in both lock orders — a quarantine that
committed first leaves the dispatcher's verify seeing a non-pending row and
no `add` happens; a committed add makes the quarantine probe observe the job.
A Redis command issued with unknown outcome cannot be cancelled when the lock
releases; a late-executing job is contained by the worker fence.

### Orphan scan: finite keyset pass, row-lock recheck, Redis-error ≠ absent

`PdfExportReconciliationScheduler` gains a second pass on the same cron +
startup path (`runOnce`), delegating to a new service/repository pair:

- `listPendingExportCandidates(bound, cursor, limit)`: `WHERE status='pending'
AND createdAt <= bound` ordered by `(createdAt, id)`, keyset `>` cursor.
  `bound = passStart − orphanAge` is captured once per pass, so rows created
  during the pass are never chased and the pass is finite; every inspected
  row advances the cursor (live jobs included) — starvation-free.
- Per candidate: `runLockedExportJob` re-verifies `pending`, generation, and
  age under the lock, then probes `queue.getJob(`${jobId}-g${gen}`)`. Absent
  → `writes.markRecoveryRequired()` (new locked write). Present → no-op.
  Redis error/timeout → propagates, the row is skipped and logged; it is
  never treated as absence.
- Constants (module-level, matching `RECONCILIATION_LIMIT` /
  `PAGE_GOTO_TIMEOUT_MS` precedent): `PDF_EXPORT_ORPHAN_MIN_AGE_MS` ≈ 15 min
  (safely beyond the 3-attempt × ~60 s render budget) and
  `ORPHAN_SCAN_PAGE_SIZE` ≈ 100. No new env vars — these are tuning constants,
  not required product config; the env-schema fail-closed rule is untouched.

_Alternative:_ listing BullMQ jobs and diffing against rows — rejected:
unbounded, and the row lock would not serialize against dispatch.

### Worker and terminal writes fenced by generation

- `PdfExportJobIdentity`/`PdfExportTerminalState` gain `generation`; payload
  identity binding compares all four fields plus queue id `${jobId}-g${gen}`.
- `processJob` first validates `data.generation` (missing/non-integer →
  reject as unrecoverable, not retried) then calls a pre-render gate —
  `assertPdfExportJobIdentity` extended to require `status='pending' AND
generation=g` — before launching Chromium. Rejection = no render, no writes.
- `markExportCompleted`, `markExportFailed`, and `reconcileTerminalState` take
  the generation and CAS `WHERE id=? AND status='pending' AND generation=?`;
  stale-generation writes are idempotent no-ops (completed+same artifact
  still returns the row; otherwise conflict logging as today).
- `PdfArtifactStore.createAttempt(outputDir, jobId, generation, buffer)`:
  canonical file `${jobId}-g${generation}.pdf`, same no-replace link +
  checksum-of-surviving-bytes protocol per generation. Download resolves
  `${jobId}-g${row.generation}.pdf` for a `completed` row whose `filePath`
  is the canonical `/pdfs/{jobId}.pdf` — public URL and ownership checks
  unchanged.
- `PdfExportLockedJobWrites` gains `markRecoveryRequired`; `reviveFailed`
  is superseded by the generation transition and removed.

### Admin surface: DB-backed, Head-only, generation-explicit

- New procedures on the existing admin jobs router (canonical
  `headProcedure`, role-coverage gate preserved):
  `admin.jobs.listPdfRecovery` (Prisma `findMany` on
  `status='recovery_required'` — Redis not consulted) and
  `admin.jobs.retryPdfRecovery` (`{jobId: uuid, expectedGeneration: int≥1}` →
  `retryExportGeneration`).
- `JobsService.retryFailed`'s pdf-export branch is rewired to the same
  transition, but `expectedGeneration` comes from the queue job the caller
  selected — `getPdfExportIdentity` returns `generation` parsed from the
  payload and the adapter validates the BullMQ id equals
  `${jobId}-g${generation}` — never from the durable row's current
  generation. A retained g1 entry retrying a row already at g2 is an
  ineligible no-op. `AdminPdfExportRetryQueue` (`isFailed`/`retry`),
  `queue-not-failed`, and the BullMQ `job.retry()` call disappear. The failed
  list itself stays BullMQ-backed for jobs that do exist.
- Web: `pdfExportRefetchInterval`/`readJobOutcome` treat `recovery_required`
  as terminal — polling stops, stored job cleared, control exits generating,
  message `Recovery required — export outcome unknown` shown; the jobs tab
  gains a recovery section listing rows and posting `{jobId,
expectedGeneration}` from the listed generation.

### Data flow, before → after

```
request  → row pending        → add jobId                → worker renders
         → ${jobId}.pdf       → markCompleted
retry    → row failed + Redis job → queue.retry() → pending (same id)

request  → row pending(g1)    → locked verify pending(g1) → add ${jobId}-g1
         → worker (gen gate)  → ${jobId}-g1.pdf → markCompleted(g1)
orphan   → aged pending(g), ${jobId}-g${g} confirmed absent
         → recovery_required(g)        (scan only; never auto re-render)
retry    → {jobId, expGen=g}  → tx commit pending(g+1)
         → locked verify pending(g+1) → add ${jobId}-g${g+1}
```

### Generation-1 migration ships as a compiled `pdf-artifact-migrator` container

Existing `completed` rows get `generation = 1` from the column default, but
their physical files are the legacy `${jobId}.pdf` names — a mandatory
`-g1` reader would 404 them. The migration ships as a separate one-shot
**compiled** container: an isolated CLI inside `apps/api`
(`apps/api/src/pdf-artifact-migrator/`, its own
`apps/api/tsconfig.pdf-artifact-migrator.json` emitting to
`dist/pdf-artifact-migrator`, excluded from the API production build) reusing
the `pg` dependency `apps/api` already owns — no new workspace package, no
dependency or `pnpm-lock.yaml` change — plus a standalone
`apps/api/Dockerfile.pdf-artifact-migrator` image on the `migrator` stage
precedent (fresh pinned base, pg-only runtime closure extracted from the
lockfile-installed store, asserts no tsx / no prisma CLI or package / no
pnpm/turbo), and a `restart: "no"` compose service. It is NOT a
`prisma/operations/` tsx script — no production image can execute one.

- PostgreSQL access is read-only: one `pg` session pinned
  `default_transaction_read_only=on` issuing only SELECTs of `completed`
  rows (`jobId`, `checksum`), connected directly to postgres like `migrate`.
  The migrator writes nothing to the database; the durable row is never
  touched.
- `check` is the default mode: it validates every `completed` row and
  reports `already-linked` / `would-link` / `skipped-anomaly` without
  creating, deleting, or modifying any artifact or record — the
  `.migration/lock` run lock is transient state every mode, `check`
  included, creates for the run and removes on clean completion — and
  exits non-zero while an applicable link is missing or any anomaly is
  reported, so the deploy gate stays open. `apply` and
  `rollback` refuse to run without a dedicated target-bound confirmation
  (`PDF_ARTIFACT_MIGRATOR_CONFIRM=<host>|<port>|<database>` matching the
  resolved `DATABASE_URL` — the `CONFIRM_RESTORE_TARGET` precedent).
- Each candidate's `${jobId}.pdf` must `lstat` as a regular non-symlink
  file whose sha256 equals `row.checksum`; anything else is skipped and
  reported with the row untouched.
- All three modes run under a global exclusive lock —
  `PDF_OUTPUT_DIR/.migration/lock` created by `mkdir`: `EEXIST` refuses
  safely, normal completion removes it, and a crash leaves it behind. The
  lock is never auto-reclaimed by PID, age, or heartbeat; recovery is an
  operator step — quiesce the old api and migrators, confirm no run is
  active, remove only the empty lock directory, rerun. The records make
  the rerun idempotent.
- Ownership is a per-job record at `.migration/records/<jobId>.json`:
  schema version, the operation UUID that wrote the transition, jobId,
  source/destination basenames and absolute paths, source dev+inode as
  strings, sha256, and a state of `intent` | `committed` |
  `rollback-intent` | `rolled-back`. Records are strict-schema single-line
  JSON with a mandatory final newline; reads are `O_NOFOLLOW` + regular-
  file-verified, and a corrupt, symlinked, or non-regular record blocks
  mutation for its row and fails `check`. Every transition is staged in a
  unique `crypto.randomUUID` temp inside `records/` opened
  `O_CREAT|O_EXCL|O_WRONLY|O_NOFOLLOW` (never truncating an existing temp
  or record), fsynced, closed, renamed over the record path, and the
  records directory fsynced; pre-existing temp files are left untouched.
- `apply` persists `intent` BEFORE `link()` to `${jobId}-g1.pdf`, fsyncs
  the artifact directory, then persists `committed`. `link()` never
  overwrites: a pre-existing destination without a matching record is
  foreign — even a hard link sharing the source inode — and is reported,
  never adopted or replaced. A recovered `intent` retries an absent link
  or finalizes a matching one; a mismatch is reported with nothing
  deleted. `check` never reports a row complete for `intent`,
  `rollback-intent`, corrupt, or invalid records.
- Rollback is valid only inside the quiesced pre-activation window: it
  requires a `committed` record, re-verifies the destination's path,
  inode, and checksum, persists `rollback-intent`, unlinks only that
  verified destination, fsyncs the artifact directory, and persists
  `rolled-back`. A crashed `rollback-intent` recovers the same way: delete
  only a destination that still matches the owned record, or finish
  `rolled-back` when the destination is already absent — a mismatch is
  reported with nothing deleted. Legacy files and entries no valid record
  owns are never removed — the operation cannot lose data.
- Trust boundary: the artifact root and the `.migration` parent
  directories are controlled and quiesced for the run. Node provides no
  `openat`-style protection against a hostile process swapping parent
  directories mid-run, so that quiescence is part of the safety contract.

`_destructive-guard.ts` is untouched and not weakened: the production
migrator is non-destructive and never runs under it — its guard is the
read-only session plus the target-bound confirmation — while local
verification keeps passing through the existing guard and per-run consent
for the disposable-database reset/seed legs. No permanent compatibility
fallback is added to the reader — this migration is the whole bridge.

_Alternative:_ a `prisma/operations/` tsx script — rejected: no production
image carries tsx or the operations tree, and bundling the toolchain into
the runner or schema-migrator image would regress the image-hardening
asserts. A reader fallback trying both filenames stays rejected for the
same reason as before — it would let a stale legacy file shadow a
regenerated artifact.

## Invariants

- **Period dual-state** — untouched (no period fields on `PdfExportJob`).
- **Role-coverage gate** — preserved: new procedures use `headProcedure`.
- **Weekly-cycle rollover** — untouched.
- **Destructive-db guard** — unchanged and not weakened; all disposable-DB
  verification runs through `prisma/guards/_destructive-guard.ts` on an exact
  disposable target with per-run consent. The production
  `pdf-artifact-migrator` never runs under it — it is non-destructive,
  read-only on Postgres, and gated by its own target-bound confirmation.
- **PDF integrity** — preserved and strengthened: pending-only CAS gains a
  generation conjunct (never loses the identity guard), snapshot/checksum/
  ownership/no-replace rules unchanged, `enum-state-hygiene` satisfied
  (`recovery_required` has a production writer: the orphan scan).

## Risks / Trade-offs

- [Enum `ADD VALUE` inside a migration transaction] → PostgreSQL 15 allows it
  but the value is unusable until commit; the additive migration performs
  `ALTER TYPE … ADD VALUE IF NOT EXISTS 'recovery_required'` and
  `ADD COLUMN IF NOT EXISTS generation INT NOT NULL DEFAULT 1` without
  referencing the new value. The canonical init migration is immutable per
  `docs/operations.md` (never fold applied history back into init); the
  additive migration is verified both as a fresh sequential `migrate deploy`
  on an empty disposable DB and as an upgrade onto a database already at the
  previous head.
- [In-flight pre-generation queue jobs at deploy] → drain/stop old workers
  during the switch (spec); new workers reject missing-generation payloads as
  unrecoverable; their `pending` rows funnel to `recovery_required` — by
  design, since legacy payloads can never render safely.
- [Row lock held across a Redis probe] → bounded, single-row, and required
  for dispatch/quarantine serialization; Redis errors abort that row only.
- [Ordinary code rollback after activation] → unsafe: a completed artifact
  may exist only as `${jobId}-g${generation}.pdf` (the old reader resolves
  only `${jobId}.pdf`) and old `toDomainStatus` throws on `recovery_required`.
  Undo is limited to the quiesced pre-activation window; once
  generation-aware dispatch/workers/readers are live, recovery is
  forward-only and preserves all rows, artifacts, and queue entries.
- [Two workers on the same generation (BullMQ stall re-run)] → unchanged
  dedupe: no-replace canonical link + pending+generation CAS.
- [Admin list vs failed list divergence] → intentional: recovery list is
  DB-backed because the Redis job may not exist; the failed list keeps its
  Redis semantics for queues where jobs exist.
- [Queue command issued with unknown outcome] → cannot be cancelled once the
  row lock releases; the worker's pending+generation fence prevents late
  execution from rendering or writing.
- [Legacy artifact skipped by the migration] → the row stays `completed` but
  unservable; the run reports it for manual repair instead of guessing.
- [Migrator `apply`/`rollback` pointed at the wrong target] → refused unless
  `PDF_ARTIFACT_MIGRATOR_CONFIRM` echoes the resolved host/port/database; the
  default mode is check-only, so an unconfirmed run writes nothing.

## Migration Plan

1. `packages/shared` schema/type changes (status enum + generation) — no
   runtime consumers until api/web land.
2. `prisma/schema.prisma` (`recovery_required`, `generation`) + one additive
   timestamped migration (init stays immutable per `docs/operations.md`);
   `db:generate`.
3. `apps/api`: job-state/ports/service/repository/enqueuer, processor,
   artifact store, scheduler scan, admin service/adapter/router wiring.
4. `apps/web`: status polling/outcome, export control copy, admin jobs
   recovery section.
5. Deploy order: `prisma migrate deploy` via the existing `migrate` service
   (additive, backward-compatible) → stop the old PDF producers/workers (the
   old api containers — the pdf-export worker is in-process) →
   `pdf-artifact-migrator` `check` → `apply` with the target-bound
   confirmation → `check` until it exits 0 reporting `pending=0` and
   `anomalies=0` → activate the
   generation-aware api (workers + download reader) per the spec's
   single-protocol scenario. Ordinary rollback is available only before that
   activation step and removes only record-owned identical links; once
   generation-aware code is live, recovery is forward-only — preserve every
   row, artifact, and queue entry.
6. Verification per tasks.md: unit + focused integration on the guarded
   disposable DB (fresh sequential deploy and upgrade-from-existing), gates,
   and one real end-to-end recovery flow.

## Open Questions

- Exact `PDF_EXPORT_ORPHAN_MIN_AGE_MS` value (15 min proposed) and whether the
  scan shares the existing 10-minute cron or gets its own interval — tuning,
  not contract.
- Recovery list placement inside the jobs tab (section vs sub-tab) — UI
  detail, same procedures.
