# Hoist Query Error Policy into One Hook

## Why

When a lead's report form fails to load, the error toast leaks the raw
internal error message and omits the support "Reference: \<requestId\>."
suffix — the user cannot quote an id to support, and internals are not
suppressed. Meanwhile the slides surfaces log silently and other pages
use the canonical `formatClientErrorMessage` path: the same failure
looks different on every page. Inventory at HEAD (verified): 10
query-error `logClientError` effects across 5 components — 4 in
`lead-form.tsx:440-498` (inline drifted toasts), 2 in
`dashboard-page.tsx:85-108` (canonical), 1 in
`weekly-report-page.tsx:137-149` (canonical), 2 in
`lead-slides-client.tsx:102-117` (log-only), 1 in
`head-slides-client.tsx:64-70` (log-only). Each is ~15 lines of copied
`useEffect` boilerplate.

## What Changes

1. New `useQueryErrorHandler` hook in `apps/web/src/lib/` — the single
   error-policy seam: logs through `logClientError` and optionally
   toasts through `formatClientErrorMessage` (see `design.md`).
2. Migrate the 10 query-error effects onto the hook. Only lead-form
   changes visibly: its 4 toasts gain the requestId reference and stop
   echoing internal messages. Slides stay silent by explicit decision
   (design.md D3).
3. Contract tests for the hook; lead-form test pins the unified toast.

**Non-goals:** the 2 non-query dashboard watchdog sites
(`load_stalled`, `pageshow_missing_data`) stay direct calls; the 5
unlogged toast sites found beyond the dossier (`reports/page.tsx`,
`print/[reportId]/page.tsx`, `admin-panel.tsx`) go to a recorded
follow-up change; no global `QueryCache.onError` (rejected — design.md
D1); `client-error-reporting.ts` is frozen (its console envelope feeds
`client-logger.ts` → `app.log`); this is NOT the lead-form
decomposition recorded in `architecture-refactor-backlog` — the
lead-form edit stays surgical.

## Sequencing

Wave 2, first of the lead cluster — lands BEFORE
`refactor-lead-mappers` and `refactor-lead-dialog-lifecycle`: it
shrinks `lead-form.tsx` by roughly 40 lines and creates a seam the
decomposition keeps. The lead cluster opens only after the active
`fix-lead-stripe-and-archived-badges` AND `require-risk-stage` are
archived. Also after `refactor-web-trpc-test-harness`, because this
change extends `lead-form.test.tsx` on the new harness.

## Capabilities

### New Capabilities

- `client-error-policy`: every TanStack Query load failure on a page
  surface flows through the policy module — logged with
  component/procedure context, toasted (if at all) via
  `formatClientErrorMessage`.

## Impact

- NEW `apps/web/src/lib/use-query-error-handler.ts` (+ test).
- 5 components migrate (paths above); only lead-form changes behavior.
- `apps/web/src/components/lead/lead-form.test.tsx` extended.
