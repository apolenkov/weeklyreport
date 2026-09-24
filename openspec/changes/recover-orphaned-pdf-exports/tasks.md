# Tasks

Ordered for one writer; each task is one commit-sized step with its
verification stated inline. TDD: write or update the failing test named in
the task before the implementation it covers. Spec:
`specs/pdf-export-integrity/spec.md`; design: `design.md`.

## 1. Shared contracts (`packages/shared`)

- [x] 1.1 In `packages/shared/src/schemas/report/report.schema.ts` add
      `recovery_required` to `pdfExportStatusSchema` and `generation:
z.number().int().min(1)` to `pdfExportJobSchema`; update the colocated
      schema test so it fails before and passes after (parses the new status,
      rejects missing/zero generation).
- [x] 1.2 In `packages/shared/src/schemas/admin/report-admin.schema.ts` add
      the recovery list item schema (`jobId`, `reportId`, `generation`,
      `requestedBy`, `status`, `createdAt`), its list wrapper, and the retry
      input `{ jobId: z.uuid(), expectedGeneration: z.number().int().min(1) }`;
      export all three via `packages/shared/src/index.ts`; verify the schema test
      round-trips each contract.

## 2. Persistence (`prisma/`) and the `pdf-artifact-migrator` ops image

- [x] 2.1 In `prisma/schema.prisma` add `recovery_required` to
      `PdfExportStatus` and `generation Int @default(1)` to `PdfExportJob`; run
      `pnpm --filter @customreport/api db:generate`; verify the generated client
      exposes both.
- [x] 2.2 Add one additive timestamped migration directory
      `prisma/migrations/<ts>_pdf_export_recovery/migration.sql` with `ALTER TYPE
"PdfExportStatus" ADD VALUE IF NOT EXISTS 'recovery_required'` and
      `ALTER TABLE "PdfExportJob" ADD COLUMN IF NOT EXISTS "generation" INTEGER
NOT NULL DEFAULT 1` — never using the new enum value inside the same
      transaction (PostgreSQL 15 restriction). The canonical init migration stays
      immutable per `docs/operations.md` (never fold applied history back into
      init); do NOT edit `20260530162224_init/migration.sql`. Verify
      `canonical-init-contract.test.ts` still passes unchanged.
- [x] 2.3 Implement `apps/api/src/pdf-artifact-migrator/` — an isolated
      compiled one-shot CLI inside `apps/api` (entrypoint `main.ts`, its own
      `apps/api/tsconfig.pdf-artifact-migrator.json` emitting to
      `dist/pdf-artifact-migrator` via the `build:pdf-artifact-migrator`
      script, excluded from the API production dist). It reuses the `pg`
      dependency `apps/api` already declares: no new workspace package, no
      dependency or `pnpm-lock.yaml` change, no prisma/tsx in its closure. The
      entrypoint reads `DATABASE_URL`, `PDF_OUTPUT_DIR`, and
      `PDF_ARTIFACT_MIGRATOR_MODE` (default `check`), opens a `pg` session
      pinned `default_transaction_read_only=on`, and SELECTs `completed`
      `PdfExportJob` rows (`jobId`, `checksum`) — zero database writes. Per
      row it `lstat`-verifies `${jobId}.pdf` as a regular non-symlink file
      whose sha256 equals `row.checksum`. Modes: `check` reports each row's
      verdict (`already-linked` | `would-link` | `skipped-anomaly`), writes
      no artifact or record — `.migration/lock` is transient run state even
      for `check` — and exits non-zero while an applicable link is missing
      or an anomaly is reported;
      `apply` and `rollback` first require
      `PDF_ARTIFACT_MIGRATOR_CONFIRM=<host>|<port>|<database>` equal to the
      resolved `DATABASE_URL` target (the `CONFIRM_RESTORE_TARGET`
      precedent); the URL must carry its identity in the authority/path with
      an explicit port (an omitted port inherits `PGPORT` at connect time and
      is refused) — query parameters pg would resolve as connection identity
      (`host`/`port`/`database`/`user`/`password`) are refused. `apply`
      `link()`s each verified file to `${jobId}-g1.pdf` without overwrite —
      EEXIST adopts only a destination matching a durable intent record;
      anything else is a reported anomaly, never replaced —
      and records every created link in a per-job durable record at
      `.migration/records/<jobId>.json` (schema version, operation UUID,
      jobId, source/destination basenames+paths, source dev+inode as
      strings, sha256, state intent|committed|rollback-intent|rolled-back).
      All modes run under a global `mkdir` lock at `.migration/lock` —
      EEXIST refuses safely, normal completion removes it, a crash leaves
      it and it is never auto-reclaimed by PID/age/heartbeat — and record
      transitions are atomic (unique crypto.randomUUID temp in `records/`,
      O_CREAT|O_EXCL|O_WRONLY|O_NOFOLLOW, JSON+newline, fsync, close,
      rename, directory fsync; existing temps/records never truncated).
      `apply` persists intent before `link()`, then fsyncs the artifact
      dir and persists committed; a pre-existing destination without a
      matching record is foreign even at the same inode and is never
      adopted, corrupt/symlinked/non-regular records block mutation, and
      `check` never reports success for intent/rollback-intent/invalid
      records. `rollback` (same confirmation, pre-activation window only)
      requires a committed record, re-verifies path+inode+checksum,
      persists rollback-intent, unlinks only the verified destination,
      and persists rolled-back — never the legacy file. Crash recovery:
      intent retries an absent link or finalizes a matching one;
      rollback-intent deletes only a destination still matching the owned
      record, or finishes rolled-back when the destination is already
      absent; mismatches report without deleting.
      Verify with colocated tests covering each mode, confirmation
      refusal, `PGPORT` inheritance refusal, query-param target overrides,
      each skip case, foreign/hardlink-without-record destinations,
      concurrent lock refusal for apply/apply and apply/rollback,
      stale-lock refusal until operator removal, per-state crash fixtures
      plus one killed child process, corrupt/symlink/no-newline record
      refusals, write/rename/fsync error paths, stray-temp preservation,
      and idempotent recovery.
- [x] 2.4 Add `apps/api/Dockerfile.pdf-artifact-migrator` — a standalone
      minimal image built from the repository root on the `migrator` stage
      precedent (fresh pinned base): frozen-lockfile workspace install,
      `tsc6 -p tsconfig.pdf-artifact-migrator.json`, the pg-only runtime
      closure extracted by
      `apps/api/scripts/pdf-artifact-migrator-runtime-deps.ts`, entrypoint
      `node`, and asserts mirroring the `migrator`/`runner` hardening checks
      (no tsx, no prisma CLI or package, no pnpm/turbo). Verify
      `docker build -f apps/api/Dockerfile.pdf-artifact-migrator .` succeeds
      and the image refuses `apply` without the confirmation token.
- [x] 2.5 Add the one-shot `pdf-artifact-migrator` service to
      `docker-compose.prod.yml` (build: `apps/api/Dockerfile.pdf-artifact-migrator`,
      context `.`) — `restart: "no"`, direct-to-postgres
      `DATABASE_URL` like `migrate`, `pdfdata` mounted at `PDF_OUTPUT_DIR`,
      `PDF_ARTIFACT_MIGRATOR_MODE` defaulting to `check` with the
      confirmation variable unset — and to `docker-compose.yml` for the
      disposable local path; verify `docker compose config` renders both and
      a local check-mode run reports without writing. Evidence:
      `prod-compose-gate.test.ts` RED 30 pass/4 fail then GREEN 34/34;
      `docker compose config` rendered dev and prod; focused migrator
      vitest 99 pass and `tsc6 --noEmit` clean; `docker build` succeeded;
      fresh named volume was root-owned so the `Dockerfile.api` chown
      pattern was added before `USER node`; scratch-project check run
      exited 0 (`pending=0`, `anomalies=0`) with no `.migration` residue
      and `pg_stat_statements` showing a read-only-pinned SELECT-only
      session; `apply` without `PDF_ARTIFACT_MIGRATOR_CONFIRM` refused
      with exit 2 before mutation.

## 3. PDF export domain (`apps/api/src/modules/pdf-export`)

- [x] 3.1 Update `pdf-export.job-state.ts`: map DB `recovery_required` ↔
      domain `recovery_required` in `pdfStatusToDb`/`dbStatusToDomain`, and carry
      `generation` through `PdfExportJobRow`, `LockedPdfExportJobRow`, and
      `toExportJob`; verify `pdf-export.contract.test.ts` covers the new mapping
      and still throws `UnsupportedPdfExportStatusError` on unknown statuses.
- [x] 3.2 Update `pdf-export.ports.ts`: add `generation` to
      `PdfExportJobIdentity`, `PdfExportTerminalState`, `PdfExportEnqueueInput`,
      and `PdfExportJobRecord`; add `markRecoveryRequired` to
      `PdfExportLockedJobWrites` and remove `reviveFailed`; replace
      `PdfExportRetryQueue`/`"queue-not-failed"` with the generation retry
      outcome (`"retried" | "already-advanced" | "ineligible"`) and an enqueue
      port used in phase B; verify dependents compile after 3.3–3.5.
- [x] 3.3 In `pdf-export.prisma-repository.ts` fence `completeExportJob` and
      `failExportJob` with `generation` (`status='pending' AND generation=g`),
      add the `markRecoveryRequired` locked write, add the locked
      generation-advance write (`failed|recovery_required` + `generation=expected`
      → `pending(g+1)`, clearing `filePath`/`checksum`/`error`), and add
      `listPendingExportCandidates(bound, cursor, limit)` — `pending`,
      `createdAt <= bound`, keyset `(createdAt, id)`; verify
      `pdf-export.prisma-repository.test.ts` covers stale-generation no-op,
      advance clearing terminal fields, and keyset ordering.
- [x] 3.4 In `pdf-export.service.ts` replace `retryFailedExport` with
      `retryExportGeneration({jobId, expectedGeneration})` implementing the
      two-phase transition from design (commit `pending(g+1)`; separate locked
      verify before the generation-scoped add); `expectedGeneration` is the
      caller-selected generation, never re-read from the row. Stale
      `expectedGeneration` is an idempotent no-op, ineligible targets write
      nothing, enqueue errors leave `pending(g+1)`; verify
      `pdf-export.service.test.ts` covers advance-once,
      stale-repeat, enqueue-throw, lost-ack, and ineligible cases (acceptance
      5–7).
- [x] 3.4a Route `requestPdfExport`'s initial dispatch through the same
      locked verify+add used by retry phase B: after `createExportJob` commits
      `pending` at generation 1, a short row lock re-verifies
      `status='pending' AND generation=1` before `queue.add(`${jobId}-g1`)`;
      verify `pdf-export.service.test.ts` covers both lock orders against a
      concurrent quarantine (quarantine-first → no add; dispatch-first → probe
      sees the job) and documents that an issued Redis command with unknown
      outcome cannot be cancelled on lock release (acceptance 4, initial-dispatch
      leg).
- [x] 3.5 In `pdf-export.service.ts` add `scanOrphanedPendingExports` — per
      candidate: `runLockedExportJob`, recheck `pending`+generation+age, probe
      the generation-scoped queue job, `markRecoveryRequired` only on confirmed
      absence, skip and log on Redis error; thread `generation` through
      `assertPdfExportJobIdentity` (pending+generation pre-render gate),
      `markExportCompleted`, `markExportFailed`, and `reconcileTerminalState`;
      verify service tests cover quarantine, Redis-error skip, and fenced writes
      (acceptance 1, 2, 10).

## 4. BullMQ infrastructure (`apps/api/src/infrastructure/bullmq`)

- [x] 4.1 In `pdf-export-bullmq-enqueuer.adapter.ts` emit BullMQ job id
      `${jobId}-g${generation}` with `generation` in the payload; verify the
      adapter test asserts both.
- [x] 4.2 In `pdf-export.artifact-store.ts` scope `createAttempt` to the
      generation: canonical path `${jobId}-g${generation}.pdf`; verify
      `pdf-export.artifact-store.test.ts` and
      `pdf-export.processor.artifact-race.test.ts` prove same-generation
      no-replace/adopt behavior and that an old generation can never overwrite
      or adopt a newer file (acceptance 9).
- [x] 4.3 In `pdf-export.processor.ts` validate `data.generation` (missing or
      malformed → unrecoverable rejection, never substituted), run the
      pending+generation gate before launching Chromium, publish
      `${jobId}-g${generation}.pdf`, and pass `generation` into
      `markExportCompleted`; verify `pdf-export.processor.test.ts` covers
      stale-generation rejection with zero writes (acceptance 8).
- [x] 4.4 In `pdf-export.processor.ts` (`markTerminalFailure`) and
      `pdf-export-reconciliation.scheduler.ts` address queue jobs by
      `${jobId}-g${generation}`, bind payload `generation` into
      `PdfExportJobIdentity`, and fence terminal writes; verify
      `pdf-export-reconciliation.scheduler.test.ts` covers an older-generation
      terminal job leaving an advanced row unchanged (acceptance 10).
- [x] 4.5 In `pdf-export-reconciliation.scheduler.ts` add the orphan pass to
      `runOnce` (same cron + startup path): pass-start `(createdAt,id)` bound,
      keyset advance on every inspected row, locked recheck, confirmed-absent →
      `recovery_required`, Redis error → skip+log; verify scheduler tests cover
      quarantine, Redis-error preservation, starvation-free termination, and
      both lock orders against a concurrent dispatcher (acceptance 1–4).

## 5. Admin surface, download, and router (`apps/api`)

- [x] 5.1 Rewire `JobsService.retryFailed`'s pdf-export branch in
      `modules/admin/jobs.service.ts` to call `retryExportGeneration` with
      `expectedGeneration` bound to the caller-selected queue job's generation —
      `getPdfExportIdentity` in `admin-jobs-queue.adapter.ts` parses `generation`
      from the payload and validates the BullMQ id equals
      `${jobId}-g${generation}` — never derived from the row's current
      generation; remove `AdminPdfExportRetryQueue`/`queue-not-failed` from
      `admin-jobs.port.ts` and the BullMQ `job.retry()` call; verify
      `jobs.service.test.ts` and `admin-jobs-queue.adapter.test.ts` prove no
      `job.retry()` remains on the pdf path and that a retained g1 entry cannot
      advance a row already failed/recovery-required at g2 (exact regression:
      locked generation check rejects it, no write, no new job).
- [x] 5.2 In `routers/admin/ops.procedures.ts` add
      `admin.jobs.listPdfRecovery` (Prisma `findMany` on
      `status='recovery_required'`, Redis not consulted) and
      `admin.jobs.retryPdfRecovery` (`{jobId, expectedGeneration}` →
      `retryExportGeneration`, distinguish `retried`/already-advanced/ineligible),
      both on `headProcedure`; verify `ops.procedures.test.ts` covers head-only
      denial, DB-backed listing with no Redis job, and retry with an absent
      queue job (acceptance 11).
- [x] 5.3 In `pdf-export.download-handler.ts` resolve the physical file
      `${jobId}-g${row.generation}.pdf` for a `completed` row with the canonical
      public `filePath`; verify `pdf-export.download-handler.test.ts` covers
      serving the recorded generation, 404 on a missing generation file, and
      never serving another generation's bytes.
- [x] 5.4 Sweep call sites/tests for the removed pieces (`reviveFailed`,
      `queue.retry()` on pdf, bare-`jobId` queue ids): `pdf-export.service.test`,
      `pdf-export.integration.test`, `jobs.pdf-retry.integration.test`,
      `test-utils/pdf-export.ts`, `jobs-service.ts` bootstrap wiring; verify
      `pnpm --filter @customreport/api typecheck` is clean.

## 6. Web (`apps/web`)

- [x] 6.1 In `use-pdf-export-job.ts` treat `recovery_required` as terminal in
      `pdfExportRefetchInterval` and `readJobOutcome` (stop polling, remove the
      stored active job, exit generating); in `export-pdf-button.tsx` surface
      `Recovery required — export outcome unknown`; verify
      `export-pdf-button.test.tsx` covers the message and polling termination
      (acceptance 12).
- [x] 6.2 On the dedicated head-gated `/pdf-exports` page
      (`app/(app)/pdf-exports/page.tsx` under a `RoleGate` layout, rendering
      `features/pdf-export/ui/pdf-recovery-section.tsx`) add the DB-backed
      recovery section: list via `admin.jobs.listPdfRecovery`, retry posting
      `{jobId, expectedGeneration}` from the listed generation, refresh on
      settle; verify `pdf-recovery-section.test.tsx` covers listing without
      Redis jobs and the retry payload (acceptance 11, UI side).

## 7. Focused integration (guarded disposable DB)

- [x] 7.1 Extend `apps/api/src/modules/pdf-export/pdf-export.integration.test.ts`
      and `modules/admin/jobs.pdf-retry.integration.test.ts` (real Postgres +
      BullMQ per existing harness): aged pending + absent queue job →
      `recovery_required`; Redis error → unchanged; retry advances exactly one
      generation and stale `expectedGeneration` is a no-op; enqueue throw leaves
      `pending`; admin list/retry with no Redis job; run the two named files
      as positional filters with
      `pnpm --filter @customreport/api test:integration` (acceptance 1, 2,
      5–7, 11).
- [x] 7.2 When apply is authorized, verify the migration on an exact
      disposable target: resolve `E2E_DATABASE_URL` to `customreport_e2e`, require
      `prisma/guards/_destructive-guard.ts` to accept it, set
      `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'` for that run only.
      Prove both paths: (a) fresh sequential `migrate deploy` on the empty
      disposable DB applies init plus all additive migrations cleanly, and (b)
      upgrade — a database already at the previous head applies only the new
      migration — then verify the enum value, `generation` default, and a fresh
      boot; record the commands and output.
- [x] 7.3 Exercise the compiled `pdf-artifact-migrator` against the
      disposable DB — resolve `E2E_DATABASE_URL` to `customreport_e2e` and run
      the guard + per-run consent only for the reset/seed legs (the migrator
      itself is read-only on Postgres) — plus a temp `PDF_OUTPUT_DIR`:
      `check` reports pending links and changes nothing; `apply` without
      `PDF_ARTIFACT_MIGRATOR_CONFIRM` refuses; with the exact target-bound
      token it links verified regular files, records every created link,
      treats EEXIST without a matching record as foreign, and a rerun is a
      no-op; missing/symlink/checksum-mismatched files are skipped and
      reported with the row unchanged; a post-apply `check` reports nothing
      pending; pre-activation `rollback` removes only record-owned
      identical links.

## 8. End-to-end and gates

- [x] 8.1 Run one real recovery flow against the local stack (per
      `docs/onboarding.md`): enqueue an export, remove its BullMQ job to simulate
      loss, run the orphan scan, observe `recovery_required` in the admin list,
      retry as Head, observe generation 2 render and download
      `/pdfs/{jobId}.pdf` serving `${jobId}-g2.pdf`; capture evidence (logs,
      screenshots/DOM per AGENTS.md browser rules).
- [x] 8.2 Update `docs/operations.md` with the generation-protocol deploy
      order — `migrate deploy` via the existing `migrate` service → stop the
      old PDF producers/workers (old api containers; the pdf-export worker is
      in-process) → `pdf-artifact-migrator` `check` → `apply` with the
      target-bound `PDF_ARTIFACT_MIGRATOR_CONFIRM` → `check` until it exits
      0 reporting `pending=0` and `anomalies=0` → activate the
      generation-aware api — and document the migrator
      modes, the read-only database posture, the global `.migration/lock`
      run lock with its operator-only stale-lock recovery, the per-job
      `.migration/records` protocol, the controlled/quiesced trust
      boundary, and the rollback boundary: rollback only inside the
      quiesced pre-activation window and only record-owned identical links;
      after activation recovery is forward-only and preserves all
      rows/artifacts/queue entries. Verify wording stays inside the curated-docs scope.
- [x] 8.3 Run the full gate set and report exact results: `pnpm
format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
      `pnpm spec:check`, and `pnpm exec openspec validate
recover-orphaned-pdf-exports --strict`.

## Verification Evidence

<!-- Filled during apply: record the exact commands run, their results, the
tested commit, and any excluded or unavailable checks. -->

### Reconciliation at `35b03ed98c8bd2e2904b68a5af95270fcbf37f77`

Basis: every box was re-verified against current sources; `git diff
c1eb1c09..35b03ed9` is `AGENTS.md` only (+11 lines), so all runtime/test
evidence recorded at `c1eb1c09` applies unchanged to HEAD. Path references
below are the actual current locations where they differ from the task text.

- **1.1–1.2** — `recovery_required` in `pdfExportStatusSchema` and
  `generation int ≥1` in `pdfExportJobSchema`
  (`packages/shared/src/schemas/report/report.schema.ts`), covered by
  `report.read-models.test.ts` (accepts the status, round-trips a
  `recovery_required` job, rejects missing/sub-1/non-integer generation).
  `pdfRecovery{Job,JobList,RetryInput,RetryOutcome,RetryResult}` in
  `report-admin.schema.ts`, all exported via `index.ts`; the schema test
  round-trips each contract and rejects the removed `queue-not-failed`
  vocabulary.
- **2.1–2.4** — `schema.prisma` carries `recovery_required` +
  `generation Int @default(1)`; one additive migration
  `20260921120000_pdf_export_recovery` (both `IF NOT EXISTS` ALTERs, enum
  value unused inside its transaction); the init migration is untouched.
  Migrator CLI at `apps/api/src/pdf-artifact-migrator/` (pg-only closure, no
  new deps) with `tsconfig.pdf-artifact-migrator.json`,
  `build:pdf-artifact-migrator`, `Dockerfile.pdf-artifact-migrator`, and
  `scripts/pdf-artifact-migrator-runtime-deps.ts`; colocated tests present.
- **3.1–3.5, 3.4a** — `recovery_required` mapped both directions and
  `generation` threaded through job-state; ports carry generation,
  `markRecoveryRequired`, and the `"retried" | "already-advanced" |
"ineligible"` outcome (`reviveFailed`/`queue-not-failed` gone — remaining
  `reviveFailed*`/`job.retry()` hits are the reminder domain). Repository
  fences terminal writes `status='pending' AND generation=g`, advances
  generations clearing terminal fields, and keyset-lists pending candidates.
  `retryExportGeneration` + `scanOrphanedPendingExports` live in
  `pdf-export.recovery.ts`; `requestPdfExport` dispatches g1 through the same
  locked verify+add. Unit coverage in `pdf-export.service.test.ts` /
  `pdf-export.prisma-repository.test.ts` / `pdf-export.contract.test.ts`
  (advance-once, stale-repeat, enqueue-throw, lost-ack, ineligible, both
  lock orders, quarantine, Redis-error skip, fenced writes).
- **4.1–4.4** — enqueuer emits `${jobId}-g${generation}` with `generation`
  in the payload (`pdf-export-bullmq-enqueuer.adapter.ts` under
  `modules/pdf-export/`); artifact store publishes the generation-scoped
  canonical path; the processor rejects missing/malformed generations
  unrecoverably, enforces the exact queue-id match and the
  pending+generation gate before render; terminal writes and reconciliation
  address jobs by the generation-scoped id.
- **4.5** — `runOnce` runs the orphan pass on cron and startup with a real
  generation-scoped `queue.getJob` probe. Coverage split: unit tier
  (`pdf-export.service.test.ts`, `pdf-export-reconciliation.scheduler.test.ts`)
  proves quarantine, Redis-error skip, starvation-free keyset termination,
  and both dispatcher lock orders; the two `c1eb1c09` integration tests prove
  quarantine and probe-rejection against real Postgres+BullMQ; the 8.1 run
  observed the startup-path quarantine live.
- **5.1–5.4** — `jobs.service.ts` routes the pdf branch to
  `retryExportGeneration` bound to the retained `-g` queue-entry identity
  (no `job.retry()` on the pdf path); `getPdfExportIdentity` in
  `infrastructure/bullmq/admin-jobs-queue.adapter.ts` validates payload
  generation and the exact queue id; `listPdfRecovery`/`retryPdfRecovery`
  sit on `headProcedure` in
  `infrastructure/trpc/routers/admin/ops.procedures.ts`; the download
  handler resolves `${jobId}-g${row.generation}.pdf` and 404s a missing
  generation file; sweep clean (`test-utils/pdf-export.ts` reduced to the
  telemetry noop; bootstrap wires `retryPdfExportGeneration` +
  `listPdfRecoveryJobs`).
- **6.1–6.2** — `use-pdf-export-job.ts` (under `features/pdf-export/ui/`)
  treats `recovery_required` as terminal in `pdfExportRefetchInterval` and
  `readJobOutcome`; `export-pdf-button.tsx` renders the exact `Recovery
required — export outcome unknown` message. The recovery UI is the
  head-gated `/pdf-exports` page described in 6.2 above, covered by
  `pdf-recovery-section.test.tsx`, its real-transport test, and the
  page/layout tests.
- **7.1** — at `c1eb1c09`, two separate focused runs passed, each a
  single-file `pnpm test:integration` invocation from `apps/api`:
  `pdf-export.integration.test.ts` 9/9 and
  `jobs.pdf-retry.integration.test.ts` 9/9 (18/18 aggregate; the full
  integration suite was not run). At `9ceae860` the combined two-file run
  was 16/16 — `c1eb1c09` added the 2 tests for the quarantine and
  probe-rejection branches that were previously unit-only. Astra review
  PASS. Raw log:
  `wave2/runtime-71-raw.log`; run report: `wave2/runtime-71-gap-writer.md`.
- **7.2** — on `customreport_e2e` (guard + per-run consent): fresh
  `migrate deploy` applied 8/8 migrations; previous-head upgrade applied
  exactly 1 (`20260921120000_pdf_export_recovery`); a real Nest boot at
  pinned `c1eb1c09` served `/health/ready` 200. Astra PASS. Raw log
  `wave2/runtime-72-raw.log`, sha256
  `8d2602b9e4477aa322a605ae5108aee6cb8e444287efacec4c90de2af477c032`
  (recomputed). Known exclusion: a pre-existing, unrelated migrate-diff
  index drift — not introduced or fixed by this change.
- **7.3** — the compiled migrator ran check/apply/rollback legs against
  `customreport_e2e` + a temp `PDF_OUTPUT_DIR`: 113/113 assertions PASS,
  0 FAIL. Astra PASS. Raw log `wave2/runtime-73-raw.log`, sha256
  `93b19b945b071c66c8e1366908aceadb5df24f63414bbb3610f4a1ede9b06777`
  (recomputed).
- **8.1** — real local flow at `c1eb1c09` (evidence bundle
  `wave2/browser-81/`, manifest 20/20 recomputed OK; independent Devin
  bounded review PASS in `devin-review.txt`): Head UI enqueue g1, exact
  BullMQ job removal with the durable row still pending, real orphan scan →
  `recovery_required`, DB-backed UI list + Retry → `pending` g2, actual
  generation-2 render, and `/pdfs/{jobId}.pdf` serving the g2 bytes —
  149 487 bytes, sha256 `203ee163…` equal to the row checksum and the
  downloaded file. Qualifications: the task-owned API restart made the
  page's status polls return 500 and the hook cleared the stored job, so
  normal automatic in-page delivery was **not** demonstrated — the download
  used the product's anchor mechanism (`deliverArtifact`-equivalent)
  programmatically; the 15-minute orphan age bound was met by backdating
  `createdAt` on the task-created disposable row (disclosed in the bundle).
  The mandatory `astra_reviewer` pass is still pending (Codex usage limit);
  the Devin review does not substitute for it. Excluded legs: failed-list
  retry, the cron-leg scan, multi-page scan, stale-generation CAS races
  (unit/integration-covered), concurrent double-click retry.
- **8.3** — at source SHA `6eb7a82b3`, `pnpm format:check`, `pnpm lint`,
  `pnpm typecheck`, `pnpm test`, `pnpm spec:check` (176/176),
  `API_URL=http://localhost:3002 pnpm build` (5/5 Turbo tasks), and
  `pnpm exec openspec validate recover-orphaned-pdf-exports --strict` all
  exited 0. These checks cover the integrated transient status-poll fix;
  only this evidence record changed afterward. In-process Playwright versus
  the owner-selected Gotenberg route remains separate architecture work.

### Live follow-up at `6eb7a82b3`

TASK-047.01 fixed the status-poll regression exposed by 8.1. Real
agent-browser evidence in `wave2/browser-task04701/` shows one export job
survived 16 status 500s during a task-owned API outage, then completed and
auto-downloaded once without re-enqueue; DB, canonical file, and downloaded
PDF share sha256 `81985cd2…`. The second bundle,
`wave2/browser-task04701-ac3/`, proves the same hook's deterministic 404
cleanup, report-switch isolation, and `recovery_required` response after a
real orphan scan at this source SHA. Both runs cleaned their own processes,
job rows, and Redis DB 15. Their evidence does not replace the still-pending
mandatory `astra_reviewer` pass for the recovery batch.

### Apply-phase records

- **8.2** (`docs/operations.md`): added the "PDF artifact generation protocol"
  runbook section — deploy order (`migrate deploy` via `migrate` → quiesce
  the old api containers, whose pdf-export worker is in-process → migrator
  `check` → `apply` under target-bound `PDF_ARTIFACT_MIGRATOR_CONFIRM` →
  `check` until clean → activate the generation-aware api), the three modes,
  read-only `pg` posture, the JSONL link journal, and the rollback boundary
  (quiesced pre-activation window, journal-owned identical links only;
  forward-only afterwards). The migrator is documented as a separate
  compiled one-shot container whose CLI source lives under `apps/api`; no
  runtime evidence is claimed. Docs checks only (no code changed): Prettier
  on the touched file, repository-lint and operations-docs gate tests, an rg
  sweep for stale Playwright/Reticle statements in scope (none), and
  `git diff --check`. The later 7.3/8.1 runtime results are recorded above.
- **Integration** (`docs/operations.md`): cherry-picking the reviewed
  migrator candidate `c9939f55b` reconciled the runbook section above — the
  superseded JSONL-journal apply/rollback paragraphs were replaced by the
  reviewed `.migration/lock` + `.migration/records/<jobId>.json` state
  protocol (matching the integrated implementation and `design.md`);
  deploy order, command examples, environment contract, forward-only
  post-activation boundary, and the untested-in-production caveat are
  preserved.
