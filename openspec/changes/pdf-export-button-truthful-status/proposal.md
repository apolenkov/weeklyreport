## Why

BL-07 (P1), `docs/reviews/repo-excellence-review-2026-07-14.md`.

`ExportPdfButton`
(`apps/web/src/features/pdf-export/ui/export-pdf-button.tsx`) opens the
generated PDF from a `window.open` call made inside the 2-second status-poll
callback — outside the click handler's synchronous call stack, so every
browser's popup blocker treats it as an unrequested popup and blocks it by
default. The component does not check `window.open`'s return value (`null`
when blocked) before firing `toast.success("PDF ready")`, so the user is told
the export succeeded while no tab opened and no artifact is reachable.

Separately, the status-poll query (`statusQ`) has no `isError` branch: once
its retries are exhausted the query settles with `data === undefined`,
polling stops, but the component never clears `jobId`. `isGenerating` stays
derived from `jobId !== null`, so the button is permanently disabled and
spinning — with no toast, no retry affordance, no recovery path short of a
full remount (navigating away and back).

This proposal covers only the button-side (web) half. The worker-side
lifecycle hardening (`pdf-export-integrity`'s existing job/queue guarantees)
is a separate concern, tracked as `pdf-export-backend-lifecycle` (the review
document's own ordering calls the same seam `harden-pdf-export-backend`
— same target, two names in circulation) — see Sequencing.

## What Changes

- `export-pdf-button.tsx`: move the tab-open off the async poll callback.
  Open a blank tab synchronously inside the click handler (before the mutation
  fires), keep its reference, and navigate it (`tab.location.href = url`)
  once the poll resolves `status: "ready"` with an artifact URL — the
  standard popup-blocker-safe pattern for a result that isn't known at click
  time.
- Check the synchronous `window.open` return value: if `null` (blocked
  despite being called from the gesture, e.g. a hardened blocker), fall back
  to rendering the artifact URL as a real `<a href download>` link inside the
  success toast instead of claiming an implicit success.
- `toast.success("PDF ready")` MUST NOT fire unless the tab was actually
  opened (or the fallback download link was rendered) — success reporting
  gates on a real handoff to the user, not just the job reaching `ready`.
- Add a `statusQ.isError` branch mirroring the existing `requestMut.onError` /
  `"failed"` status recovery: on poll exhaustion, toast an error and
  `setJobId(null)` so `isGenerating` clears and the button returns to its
  idle, clickable state.

## Claim disposition

| Sub-claim                                                     | Disposition | Notes                                                                                                                                               |
| ------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| (a) async `window.open` is popup-blocked, false-success toast | Confirmed   | Verified in source: `window.open` call sits inside the `statusQ` poll effect, not the click handler; return value unchecked before `toast.success`. |
| (b) `statusQ` exhausting retries wedges the button forever    | Confirmed   | No `isError` handling; `jobId` is never cleared on poll failure, so `isGenerating` stays `true` past the last successful render.                    |

Both sub-claims confirmed — no refuted claims, no preservation-test task
needed for this change.

## Non-goals

- The PDF worker's own render-readiness assertion (`pdf-export-integrity`
  spec, `data-print-state` contract) — untouched, already correct per that
  spec.
- Backend job/queue hardening (retry policy, `markExportFailed` correctness,
  DLQ) — tracked separately as the backend half of BL-07/BL-13
  (`pdf-export-backend-lifecycle`, called `harden-pdf-export-backend` in the
  review document's own ordering); this change does not touch `apps/api`.
- No new popup-permission UX (e.g. an in-app "allow popups" hint) — the
  synchronous-open + fallback-link pattern makes an explicit permission
  prompt unnecessary.

## File manifest

- `apps/web/src/features/pdf-export/ui/export-pdf-button.tsx` (source, verified present, 178 lines)
- `apps/web/src/features/pdf-export/ui/export-pdf-button.test.tsx` (test — verified ABSENT via `find`; create new)

## Verification

- Full gate: `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test`
- Unit tests (jsdom, mock `window.open`):
  - clicking Export calls `window.open` synchronously within the click
    handler (before any await), with a non-empty placeholder target
  - when `window.open` returns a handle, the mock's `.location.href` setter
    is called with the ready artifact URL and `toast.success` fires exactly
    once
  - when `window.open` returns `null`, `toast.success` does NOT fire and the
    toast/body instead renders a download `<a href>` with the artifact URL
  - when `statusQ` transitions to `isError`, an error toast fires, `jobId`
    resets, and the button's `disabled`/spinner state clears
- Popup-blocker behavior is real browser behavior, not simulable in jsdom.
  Manual/Playwright drive step required in addition to unit tests:
  1. In a real Chromium instance with popups blocked by default (default
     profile setting), trigger a PDF export as head/admin/viewer.
  2. Confirm no false "PDF ready" toast fires before the artifact is ready.
  3. Confirm that once ready, either a new tab opens with the PDF, or (if
     still blocked) a visible download link appears in-page — never a bare
     success toast with no reachable artifact.
  4. Force the status endpoint to error (e.g. stop the API mid-poll) and
     confirm the button recovers to a clickable idle state with an error
     toast, without a page reload.

## Sequencing

Independent of `pdf-export-backend-lifecycle` (the worker-side half) — this
change touches only the web button and does not depend on backend changes
landing first. Can land before or after; no shared file touched.
