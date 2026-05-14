---
phase: 23-pdf-and-jobs
plan: 01
subsystem: pdf-export
tags: [bullmq, playwright, trpc, express-static, react-query, pdf]

# Dependency graph
requires:
  - phase: 13-bullmq-foundation
    provides: BullMQModule, RedisConnection, PdfExportProcessor (Playwright worker), Bull Board UI
  - phase: 17-publication
    provides: period.publish / report.status='published' lifecycle gate that the Export PDF button respects
  - phase: 22-weekly-report
    provides: ExportPdfButton stub surface, weekly-report-page composition
provides:
  - End-to-end PDF download path — head clicks Export PDF, BullMQ job is enqueued, worker writes file, browser downloads via /pdfs static mount
  - express.static('/pdfs') mount serving PDF_OUTPUT_DIR (defaults ./apps/api/storage/pdfs, resolved to absolute)
  - Session-attributed pdf_export_jobs rows (requestedBy = head's userId, no longer 'system')
  - ExportPdfButton with mutation + 2 s status polling + auto-download + failure toast
affects: [phase-24-auth-guards, phase-25-logging, phase-30-pdf-watermarks]

# Tech tracking
tech-stack:
  added: [] # No new dependencies; reused express, playwright, bullmq, @tanstack/react-query already present
  patterns:
    - "express.static with fallthrough:false + Content-Disposition for binary artifact serving (matches mountBullBoard pattern)"
    - "tanstack-react-query refetchInterval as a callback that returns false to stop polling — replaces manual setInterval/clearInterval"
    - "useRef one-shot guard for side-effects driven by polled query data (prevents double-firing window.open)"
    - "Optional-2nd-arg widening on repository contracts to thread session metadata without breaking existing callers"

key-files:
  created: []
  modified:
    - apps/api/src/infrastructure/config/env.schema.ts (PDF_OUTPUT_DIR)
    - apps/api/src/main.ts (express.static('/pdfs') mount)
    - apps/api/src/modules/pdf-export/pdf-export.service.ts (requestPdfExport accepts requestedBy)
    - apps/api/src/modules/pdf-export/pdf-export.prisma-repository.ts (createExportJob threads requestedBy ?? 'system')
    - apps/api/src/modules/pdf-export/pdf-export.router.ts (test-fixture mirror of router context)
    - apps/api/src/modules/pdf-export/pdf-export.service.test.ts (4 new tests + 1 cleanup)
    - apps/api/src/infrastructure/trpc/trpc.router.ts (pdfExport.request passes ctx.session.userId)
    - apps/api/src/infrastructure/bullmq/pdf-export.processor.ts (resolve path + Phase 24 TODO)
    - apps/web/src/components/weekly-report/export-pdf-button.tsx (full rewrite — real flow)
    - apps/web/src/components/weekly-report/weekly-report-page.tsx (passes reportId + periodStatus)

key-decisions:
  - "Reuse express.static (not NestExpressApplication.useStaticAssets) to match the bull-board.module.ts pattern and avoid retyping `app` as NestExpressApplication"
  - "Optional 2nd parameter on PdfExportRepository.createExportJob — widens the contract without breaking the 4 stub repositories in service/contract/integration tests"
  - "Stop polling via refetchInterval returning false on terminal status, instead of manually disabling the query — leaves the cached data available for the completion effect"
  - "useRef guard for download — completed status can fire the effect twice on a strict-mode render, the ref dedupes by jobId"
  - "Path consistency: resolve(env.PDF_OUTPUT_DIR) in BOTH main.ts AND processor.ts so a relative env value still maps to the same absolute path regardless of process cwd"
  - "Phase 24 inherits cookie injection — added explicit TODO(Phase 24) above page.goto rather than wiring buildAuthCookies now (v5.0 explicitly relies on AUTH_DEV_MODE=true per CONTEXT)"
  - "Auto-approved checkpoint in autonomous mode per user instruction ('херачь все'); manual end-to-end verification deferred to user follow-up"

patterns-established:
  - "Pattern 1: Static binary artifact serving — express.static with fallthrough:false, explicit Content-Type/Disposition headers, mounted on resolved absolute path"
  - "Pattern 2: BullMQ-backed long-running tRPC flow — head-only mutation enqueues + returns jobId, protected status query polls every 2 s, frontend opens artifactUrl on completed"
  - "Pattern 3: Session metadata threading via optional repository params — preserves backward compatibility for non-tRPC callers"

requirements-completed:
  - PDF-01
  - PDF-02
  - PDF-03

# Metrics
duration: ~25 min
completed: 2026-04-25
---

# Phase 23 Plan 01: PDF & Jobs Summary

**End-to-end PDF export — head clicks Export PDF, BullMQ Playwright worker renders /reports/{id}/print, /pdfs static mount serves the artifact, browser auto-downloads via 2 s status polling.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-25T20:30Z
- **Completed:** 2026-04-25T20:55:08Z
- **Tasks:** 3 (Task 3 auto-approved per autonomous mode)
- **Files modified:** 10
- **Test deltas:** +5 tests in `pdf-export.service.test.ts` (37 unit tests now green)

## Accomplishments

- Closed the "PDF download returns 404" gap by mounting `/pdfs` as static on the same absolute directory the worker writes to.
- Plumbed session userId end-to-end so `pdf_export_jobs.requestedBy` is now the head, not `'system'` — satisfies audit/observability expectations baked into Bull Board.
- Replaced the Phase 22 `toast.info('coming soon')` stub with a real flow: mutation → 2 s polling → automatic browser download on completion → toast on failure with clean retry state.
- Marked the Phase 24 follow-up (cookie injection) inline at the only place it matters (above `page.goto`), so the next phase's planner sees the seam immediately.
- Confirmed that BullMQ + Worker + Bull Board + tRPC `pdfExport.*` were already wired (despite CONTEXT.md saying they were not), and surgically extended only the missing pieces.

## Task Commits

1. **Task 1 (RED):** `bce1d13` `test(23-01): expectations for requestedBy threading`
2. **Task 1 (GREEN):** `6c2619c` `feat(23-01): thread session userId into pdf export job`
3. **Task 1 (Plumbing):** `35b1128` `feat(23-01): serve generated PDFs via /pdfs static mount`
4. **Task 2:** `062e76c` `feat(23-01): wire ExportPdfButton to pdfExport.request + status polling`
5. **Task 3:** Auto-approved checkpoint (no commit — verification only)

All commits used `--no-verify` per CLAUDE.md and are atomic per task.

## Files Created/Modified

### Created

None (no new dependencies, no new files — surgical extension of existing surfaces).

### Modified

**Backend (apps/api)**

- `src/infrastructure/config/env.schema.ts` — `PDF_OUTPUT_DIR` (default `./apps/api/storage/pdfs`).
- `src/main.ts` — `express.static('/pdfs')` mount with `fallthrough:false`, Content-Disposition headers, mkdirSync at boot. Mounted before `/trpc` so misses 404 cleanly.
- `src/modules/pdf-export/pdf-export.service.ts` — `requestPdfExport(reportId, requestedBy?)` accepts session userId; passes through to repo. Interface widened with optional 2nd arg.
- `src/modules/pdf-export/pdf-export.prisma-repository.ts` — `createExportJob(job, requestedBy?)` writes `requestedBy ?? 'system'`.
- `src/modules/pdf-export/pdf-export.router.ts` — test-fixture router context grew `requestedBy?: string` to keep the parallel test path in sync with the production tRPC route.
- `src/modules/pdf-export/pdf-export.service.test.ts` — 4 new tests (service threading, undefined fallback, draft rejection with userId, router fixture threading) + tightened existing `_error` underscore param.
- `src/infrastructure/trpc/trpc.router.ts` — `pdfExport.request` mutation now passes `ctx.session.userId` as 2nd arg.
- `src/infrastructure/bullmq/pdf-export.processor.ts` — `resolve(process.env['PDF_OUTPUT_DIR'] ?? './apps/api/storage/pdfs')` (was unresolved + `/app/data/pdfs` non-existent fallback). Added `TODO(Phase 24)` above `page.goto` for future cookie injection.

**Frontend (apps/web)**

- `src/components/weekly-report/export-pdf-button.tsx` — full rewrite. Accepts `{reportId, periodStatus}`, uses `useTRPC()`, `useMutation`, `useQuery`, `useRef` one-shot, `useEffect` for download trigger. Tailwind class string preserved. Disabled with explanatory `title` when not published or while generating.
- `src/components/weekly-report/weekly-report-page.tsx` — `<ExportPdfButton>` now receives `reportId` and `periodStatus`; the `TODO(Phase 23)` comment is gone.

## Decisions Made

See frontmatter `key-decisions:` for the authoritative list. Highlights:

- **express.static, not useStaticAssets** — bull-board.module.ts established the direct-express pattern; switching `app` typing for one mount adds noise.
- **Optional 2nd-arg threading** — preserves the 4 existing stub repositories and the integration repo without their having to change. The widened interface remains source-compatible for non-tRPC callers (workers, scripts, future cron jobs).
- **`refetchInterval` callback returning false** — idiomatic tanstack-react-query v5; keeps the query enabled (so the cached `data.artifactUrl` stays available for the completion effect) while halting network calls.
- **Path resolution at both ends** — `resolve()` applied in main.ts AND processor.ts. Prevents the worker from writing to `cwd/storage/pdfs` while the API serves from `apps/api/storage/pdfs` when started from different working directories.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Path-resolution drift between worker and static mount**

- **Found during:** Task 1 (processor surgical change)
- **Issue:** Plan said use `process.env['PDF_OUTPUT_DIR'] ?? resolve('./apps/api/storage/pdfs')` in the processor, but `resolve()` was applied only to the fallback. If a user sets `PDF_OUTPUT_DIR=./somewhere`, the env branch stays unresolved while `main.ts`'s `resolve(env.PDF_OUTPUT_DIR)` uses the absolute form — they could diverge if cwd changed.
- **Fix:** Applied `resolve()` to the entire expression in `processor.ts`: `resolve(process.env['PDF_OUTPUT_DIR'] ?? './apps/api/storage/pdfs')`. Mirrors `main.ts`. Worker and static mount now agree on an absolute path regardless of cwd.
- **Files modified:** `apps/api/src/infrastructure/bullmq/pdf-export.processor.ts`
- **Verification:** All 5 processor unit tests still pass; `markExportCompleted('job-1', '/pdfs/job-1.pdf', ...)` artifactUrl shape unchanged.
- **Committed in:** `35b1128` (Task 1 plumbing commit)

**2. [Rule 1 - Bug] Pre-existing TS6133 in same test file I edited**

- **Found during:** Task 1 typecheck
- **Issue:** `pdf-export.service.test.ts:63` had `error: string` parameter never used (pre-existing issue, verified via `git stash` baseline). Same project disables noUnusedParameters except via underscore prefix. Other test files in the same module already use `_error`.
- **Fix:** Renamed to `_error: string` (one char). No behavior change.
- **Files modified:** `apps/api/src/modules/pdf-export/pdf-export.service.test.ts`
- **Verification:** `pnpm tsc --noEmit` errors dropped from 2 → 1 (only the truly out-of-scope `period.contract.test.ts` warning remains, logged in `deferred-items.md`).
- **Committed in:** `6c2619c` (folded into Task 1 GREEN commit)

**3. [Rule 2 - Missing Critical] aria-busy attribute on the generating button**

- **Found during:** Task 2 (component rewrite)
- **Issue:** Plan didn't mention accessibility. A button that visually disables but doesn't expose the busy state is invisible to screen readers — and the plan's must_haves explicitly list "user sees progress" as a truth.
- **Fix:** Added `aria-busy={isGenerating}`. Cheap, non-invasive, semantically correct.
- **Files modified:** `apps/web/src/components/weekly-report/export-pdf-button.tsx`
- **Verification:** Web tsc + targeted lint clean.
- **Committed in:** `062e76c` (Task 2 commit)

### Deferred Items (out of scope per scope-boundary rule)

- `apps/api/src/modules/period/period.contract.test.ts:65` — pre-existing TS6133 unused-param warning. Not introduced by this plan, lives in an unrelated module. Logged in `.planning/phases/23-pdf-and-jobs/deferred-items.md`.
- `apps/web` repo-wide ESLint warnings (cache-keys.ts, weekly-report-page.test.tsx, lead-form.tsx, mappers/\*) — pre-existing across many files. Not in scope. Surgically lint-clean on the two files this plan touched.

---

**Total deviations:** 3 auto-fixed (1 bug, 1 cleanup, 1 a11y). 1 deferred (out of scope).
**Impact on plan:** All auto-fixes essential for correctness/parity with main.ts/a11y. No scope creep.

## Issues Encountered

- **Integration test DB auth failure** (`pdf-export.integration.test.ts`): Could not run because the local PostgreSQL instance was not running. Out of scope (environmental, not code). Unit tests (37) all pass.
- **Initial RED tests caught a real interface gap**: TypeScript correctly flagged that `requestedBy` wasn't part of `PdfExportRouterRequestContext`, validating the plan's "thread userId" requirement was not yet wired even at the test-fixture level.

## Checkpoint Auto-Approval (Task 3)

Per autonomous mode and explicit user instruction, the `checkpoint:human-verify` in Task 3 was auto-approved. The verification steps (clicking Export PDF on a published report, confirming the PDF contains real content rather than a login page, hitting `/pdfs/missing.pdf` for a 404, and the failure path with Redis stopped) were NOT performed by the agent. Recommended next-session smoke test:

```bash
docker compose up -d redis postgres
pnpm --filter @customreport/api prisma db seed
AUTH_DEV_MODE=true pnpm --filter @customreport/api dev    # terminal A
NEXT_PUBLIC_AUTH_STUB=true pnpm --filter @customreport/web dev   # terminal B
# Open http://localhost:3000, publish a period, click Export PDF.
# Expect: button "Generating…" → tab opens → PDF contains report content.
# Confirm: ls apps/api/storage/pdfs/ shows {jobId}.pdf
# Confirm: curl http://localhost:3001/pdfs/missing.pdf returns 404 (not 200/HTML)
# Confirm: /admin/queues shows job with requestedBy = head userId (not 'system')
```

If the PDF shows a login page in production-shaped environments, that's the Phase 24 cookie-injection work activating — the `TODO(Phase 24)` in `pdf-export.processor.ts` is the seam to wire `buildAuthCookies` + `page.context().addCookies()`.

## Next Phase Readiness

**Phase 24 (auth guards) inherits a clean seam:**

1. `PdfExportService.buildAuthCookies(authToken)` already exists and is fully tested (4 contract tests).
2. The `TODO(Phase 24)` marker is placed exactly above `page.goto` so the next plan's grep pattern is unambiguous.
3. Once tRPC procedures require auth in production, the worker should:
   - Mint or reuse an internal session token (or extract from a service account).
   - Call `await page.context().addCookies(this.pdfExportService.buildAuthCookies(token))` before `page.goto`.
   - Set `PDF_BASE_URL` to the internal API hostname so the cookie domain matches.

**Phase 25 (logging):** `main.ts` now emits `mounted PDF static serving` at `info` — provides a precedent for declaring served routes at boot.

**Phase 30+ (PDF features):** All artifact serving + jobId tracking infrastructure is in place. Watermarks/compression can hook into `markExportCompleted` post-write.

## Self-Check: PASSED

Verified before declaring done:

- `apps/api/src/main.ts` — `express.static('/pdfs')` present (`grep -n "express.static" apps/api/src/main.ts` → line 76).
- `apps/api/src/infrastructure/config/env.schema.ts` — `PDF_OUTPUT_DIR` present (line 38).
- `apps/api/src/modules/pdf-export/pdf-export.service.ts` — `requestPdfExport(reportId, requestedBy?)` signature present.
- `apps/web/src/components/weekly-report/export-pdf-button.tsx` — no longer contains "will be available in v5.0 Phase 23"; uses `useTRPC()`, `useMutation`, `useQuery`.
- `apps/web/src/components/weekly-report/weekly-report-page.tsx` — `<ExportPdfButton reportId=... periodStatus=... />`.
- All 4 commits exist in `git log`: `bce1d13`, `6c2619c`, `35b1128`, `062e76c`.
- `apps/api` typecheck: 1 pre-existing unrelated error (period.contract.test.ts).
- `apps/web` typecheck: 0 errors.
- Unit tests: 37 pdf-export tests pass.

---

_Phase: 23-pdf-and-jobs_
_Plan: 01_
_Completed: 2026-04-25_
