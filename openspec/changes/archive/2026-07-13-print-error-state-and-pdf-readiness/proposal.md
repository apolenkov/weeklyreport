## Why

Wave 1 / P1 from the 2026-07-12 repo-excellence review
(docs/reviews/repo-excellence-review-2026-07-12.md).

The print template (`apps/web/src/app/print/[reportId]/print-report-template.tsx`)
has no terminal error or empty state. When the `weeklyReport.get` tRPC query
settles into an error — or returns the `no-period` sentinel — the component
returns `LoadingShell` **forever** (lines 495–503); the only failure signal is a
`toast.error` (lines 484–493), which is invisible and meaningless in the headless
Chromium context the PDF worker drives. The page has no server prefetch
(`page.tsx:62–63`), so the data fetch is purely client-side inside the worker's
browser, and the query client uses finite retries (`lib/query-client.ts:28–36,49`)
— on a transient API error the query gives up, the network goes idle, and the
spinner is all that remains on screen.

The PDF worker's only readiness gate is `page.goto(..., { waitUntil: "networkidle" })`
(`pdf-export.processor.ts:100–105`). Once the network is idle it calls
`page.pdf()` (106–108), which snapshots whatever rendered — the spinner — then
computes a sha256 checksum and calls `markExportCompleted` unconditionally
(118–125). The result: any transient API error during export silently yields a
corrupt "Loading…" PDF, recorded as a successful, checksummed deliverable, with
no failure signal to the worker or the requester. The worker's existing
`onJobFailed → markExportFailed` path covers hard failures (a thrown error), but
a rendered spinner never throws.

## What Changes

- **Print template — terminal states, not a perpetual spinner.**
  `print-report-template.tsx` renders three mutually exclusive, machine-detectable
  states via a stable root `data-print-state` attribute:

  - `loading` while `weeklyQ.isLoading` (the existing `LoadingShell`, tagged),
  - `error` when `weeklyQ.isError` OR the payload is the `no-period` sentinel — a
    distinct visible terminal state (not `LoadingShell`) that states the report
    could not be rendered, replacing the invisible-toast-only handling,
  - `ready` on the successful render path, tagged on the report's root element.
    The `toast.error` side effect is retained for the interactive (non-worker) case
    but is no longer the only failure signal.

- **PDF worker — a positive readiness contract asserted before `page.pdf()`.**
  `pdf-export.processor.ts`, after `page.goto` reaches `networkidle` and before
  `page.pdf()`, waits for the `ready` marker (`[data-print-state="ready"]`) with a
  bounded timeout and fails the job if the `error` marker
  (`[data-print-state="error"]`) is present or the `ready` marker never appears.
  A failed render therefore **throws**, routing through the existing
  `onJobFailed → markExportFailed` path, so a spinner or error page is never
  checksummed and marked completed. `markExportCompleted` runs only after the
  ready assertion passes.

- The `data-print-state` token values are the shared contract between the two
  files; they are the only coupling introduced and MUST stay in sync.

## Capabilities

### New Capabilities

- `pdf-export-integrity`: the print template exposes machine-detectable
  render-outcome states, and the PDF worker asserts a positive readiness contract
  before capturing the page, so a failed render can never be recorded as a
  completed export.

### Modified Capabilities

(none)

## Impact

- `apps/web/src/app/print/[reportId]/print-report-template.tsx`
- `apps/api/src/infrastructure/bullmq/pdf-export.processor.ts`

Non-goals: no change to the interactive (human-facing) print redirect flow in
`page.tsx`; no change to the `onJobFailed → markExportFailed` mechanism itself
(only the addition of a throw that routes into it); no change to retry counts,
DLQ metrics, or the `pdf-export` queue wiring covered by
`queue-reliability-monitoring`.
