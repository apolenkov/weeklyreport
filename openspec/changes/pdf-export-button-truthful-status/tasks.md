## 1. Popup-safe open + truthful success

- [ ] 1.1 `apps/web/src/features/pdf-export/ui/export-pdf-button.tsx`: open a
      blank tab synchronously in the click handler (before `requestMut`
      fires), keep the handle in a ref
- [ ] 1.2 On `statusQ` resolving `status: "ready"` with an artifact URL, set
      the held tab's `location.href` to the artifact URL instead of calling
      `window.open` from the poll callback
- [ ] 1.3 Check the synchronous `window.open` return value at open time; if
      `null`, skip the tab-navigate path and render a fallback `<a href
download>` link with the artifact URL once ready
- [ ] 1.4 Gate `toast.success("PDF ready")` on an actual handoff (tab
      navigated or fallback link rendered) — never fire it from job-ready
      alone

## 2. Recover from status-poll failure

- [ ] 2.1 `export-pdf-button.tsx`: add an `isError` branch on `statusQ`
      mirroring the existing `requestMut.onError` / `"failed"` handling —
      toast an error and `setJobId(null)`
- [ ] 2.2 Confirm `isGenerating` (derived from `jobId !== null`) clears when
      `jobId` resets, returning the button to its idle enabled state

## 3. Tests

- [ ] 3.1 `export-pdf-button.test.tsx` (verified absent — create new): mock
      `window.open`
      returning a fake tab handle; assert it is called synchronously inside
      the click handler, before any awaited mutation
- [ ] 3.2 Assert `.location.href` is set to the ready artifact URL and
      `toast.success` fires exactly once, only after that
- [ ] 3.3 Assert: when `window.open` returns `null`, no success toast fires
      and a download link with the artifact URL renders instead
- [ ] 3.4 Assert: on `statusQ` `isError`, an error toast fires, `jobId`
      resets, and the button's disabled/spinner state clears

## 4. Spec delta

- [ ] 4.1 `pdf-export-integrity`: ADD a requirement that the export button's
      success signal (toast + artifact handoff) is gated on delivering the
      artifact to the user, and that poll failure recovers the button to a
      clickable state — the web-side half of this spec's existing
      worker-side readiness guarantee

## 5. Gates and verification

- [ ] 5.1 `pnpm --filter @customreport/api db:generate`
- [ ] 5.2 `pnpm typecheck && pnpm lint && pnpm test`
- [ ] 5.3 Manual/Playwright drive: real Chromium, default popup-blocker
      settings — trigger export, confirm no false success toast, confirm
      artifact reachable (new tab or fallback link) once ready; force the
      status endpoint to error and confirm the button recovers without a
      page reload
- [ ] 5.4 `openspec validate pdf-export-button-truthful-status --strict`
