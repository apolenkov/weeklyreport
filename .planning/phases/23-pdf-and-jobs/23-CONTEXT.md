# Phase 23: PDF & Jobs - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning
**Mode:** Auto-generated for autonomous flow (infrastructure phase)

<domain>
## Phase Boundary

BullMQ re-enabled. Export PDF button triggers async job → Playwright renders HTML report → user downloads PDF. Progress indicator shows generating → ready → download.

**Key deliverables:**

1. BullMQ module re-enabled in apps/api (was disabled in v4.0)
2. PDF export queue with worker that uses Playwright to render `/print/[reportId]`
3. tRPC mutation `pdfExport.generate(reportId)` enqueues job
4. tRPC query `pdfExport.status(jobId)` polls progress
5. Frontend Export PDF button: useMutation → poll status → download URL

</domain>

<decisions>
## Implementation Decisions

### BullMQ Re-enable

- Module was previously disabled (v4.0). Re-enable apps/api/src/modules/pdf-export/pdf-export.module.ts
- Connection: existing Redis at localhost:6379 (docker-compose)
- Queue name: 'pdf-export'
- Worker: render Playwright Chromium → savePDF → store at /tmp or S3 (use /tmp for v5.0)

### Job Pipeline

- Job data: `{ reportId, requestedBy }`
- Worker steps: launch Chromium → goto `/reports/{reportId}/print` (with auth header) → page.pdf({ format: 'A4' }) → save to `apps/api/storage/pdf/{jobId}.pdf` → return path
- Progress events: 0% queued → 25% browser launching → 50% rendering → 75% pdf generating → 100% ready

### tRPC Endpoints

- `pdfExport.generate({ reportId })` — mutation, returns `{ jobId }`
- `pdfExport.status({ jobId })` — query, returns `{ status: 'pending'|'active'|'complete'|'failed', progress: number, downloadUrl?: string }`
- Polling interval: 2 sec via `useQuery({ refetchInterval: ... })`

### Frontend UX

- Export PDF button: triggers mutation, sets local state `currentJobId`
- Status query enabled when `currentJobId` is set
- Progress indicator (toast or inline): "Generating PDF... 50%"
- On complete: toast.success with download link, auto-trigger window.open(downloadUrl)
- On failure: toast.error

### Claude's Discretion

- Storage location (use /tmp for v5.0, S3 later)
- Polling interval (2s default)
- Worker concurrency (1 for v5.0)

</decisions>

<code_context>

## Existing Code Insights

### Existing Infrastructure

- apps/api/src/modules/pdf-export/ — module exists from v3.0/v4.0 (currently disabled)
- BullMQ already in package.json
- Playwright already installed (used for E2E tests)
- apps/web/src/app/(app)/reports/[reportId]/print/page.tsx — print-friendly page already migrated to real API in Phase 21

### Established Patterns

- tRPC mutations + queries via @customreport/api
- BullMQ uses Redis connection from RedisModule
- Print page uses tRPC client-side fetch (Phase 21 decision)

### Integration Points

- Frontend export-pdf-button.tsx (just made into stub in Phase 22-05) — replace stub with real flow
- Backend pdf-export.module.ts — re-enable + wire to BullMQ
- New: pdf-export.processor.ts (BullMQ worker) — Playwright orchestration
- Static asset serving for /storage/pdf/\* if using local FS

</code_context>

<specifics>
## Specific Ideas

- Worker reuses single Chromium browser instance for performance
- Auth: worker uses internal session token (NEXT_PUBLIC_AUTH_STUB header acceptable in v5.0)
- Cleanup: scheduled job deletes PDFs older than 24h

</specifics>

<deferred>
## Deferred Ideas

- S3/cloud storage → v6.0+
- PDF compression → v6.0+
- Email PDF as attachment → v6.0+
- Watermarks/branding → v6.0+

</deferred>
