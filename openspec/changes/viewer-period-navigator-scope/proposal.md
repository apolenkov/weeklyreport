## Why

BL-06 (P1) from `docs/reviews/repo-excellence-review-2026-07-14.md`.

`PeriodNavigator`'s `pathReportId` memo (`apps/web/src/features/period/ui/period-navigator.tsx`)
resolves the addressed period by regex-matching the URL path:

```ts
const match = /^\/(?:lead|head)\/report\/([^/]+)$/.exec(pathname);
```

The regex only matches `/lead/report/:id` and `/head/report/:id`. The viewer
route is `/reports/:id` (`apps/web/src/features/viewer/ui/viewer-report-shell.tsx`
renders `<PeriodNavigator periods={periods} urlBuilder={urlBuilder} />` under
`app/(reader)/reports/[reportId]`, confirmed live). On that route
`pathReportId` is always `null`, so `currentIndex` falls back to `0` — the
navigator's own default for "no path match, assume current/newest period."

Effect on a viewer who opens any period that is not the newest (e.g. a
History link to an older published report): the navigator trigger shows the
newest period's label, the listbox highlights the newest period as selected,
and `handlePrev`/`handleNext` compute `periods.at(currentIndex ± 1)` off
index 0 — so Prev/Next silently walk relative to the wrong period. Only the
explicit dropdown (which selects by clicked option, not by index) still
lands on the right report. The comment on the regex already documents that
it was patched once for the head base and not extended when the viewer
route was added later — this is a maintenance trap, not a one-off typo: any
future path-segment surface reusing `PeriodNavigator` needs the regex
extended again unless the resolution mechanism changes.

## What Changes

- `PeriodNavigator` gains an optional `currentPeriodId` prop. When supplied,
  it is used directly for `currentIndex` resolution instead of the
  `pathname` regex — the caller already knows the addressed report id (every
  current caller receives it as a route param or query prop), so pathname
  sniffing is an indirection, not a requirement.
- `ViewerReportShell` passes `currentPeriodId={reportId}` (the prop it
  already receives and uses to build `urlBuilder`) to `PeriodNavigator`.
- The `pathname` regex remains as the fallback for callers that do not pass
  `currentPeriodId` (none exist post-change, but removing the fallback is a
  separate simplification not required to fix BL-06 — see Non-goals).

## Claim disposition

| Claim (review doc)                                                                                                 | Disposition | Evidence                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Viewer route `/reports/:id` never matches the navigator's path regex, `pathReportId` is `null`                     | CONFIRMED   | `period-navigator.tsx` regex is `/^\/(?:lead\|head)\/report\/([^/]+)$/`; viewer route is `/reports/[reportId]` (`app/(reader)/reports/[reportId]`, rendered via `ViewerReportShell`) |
| `currentIndex` falls back to `0` (newest) on the viewer route                                                      | CONFIRMED   | `if (!pathReportId) return 0;` in the `currentIndex` memo                                                                                                                            |
| Viewer opening an older period sees the newest period's trigger label/highlight, and Prev/Next compute off index 0 | CONFIRMED   | `selectedPeriod = periods.at(currentIndex)`; `handlePrev`/`handleNext` read `periods.at(currentIndex ± 1)`                                                                           |
| Explicit dropdown selection still works                                                                            | CONFIRMED   | Dropdown `onSelect` calls `navigateTo(periodId)` directly (via `usePeriodListboxNav`), not through `currentIndex`                                                                    |
| `ViewerReportShell` already has the reportId available and supplies a custom `urlBuilder`                          | CONFIRMED   | `ViewerReportShell` receives `reportId` as a prop and closes over it in `urlBuilder`                                                                                                 |

## Non-goals

- Not removing the `pathname` regex fallback or the `/(?:lead\|head)/` path
  scheme itself — `LeadHistoryList`/head-report addressing is unaffected and
  out of scope; only the viewer's currentIndex resolution is fixed.
- Not touching `HeadReportShell`'s usage — it already resolves correctly via
  the regex (`/head/report/:id` matches) and passing `currentPeriodId`
  there too is a nice-to-have consistency cleanup, not required to fix
  BL-06; left for a future pass if the team wants pathname sniffing gone
  entirely.
- Not changing `usePeriodListboxNav`'s internal keyboard-nav model or the
  swipe-gesture handlers — only the `currentIndex` input changes.
- Not adding a `currentPeriodId` prop to any other `PeriodNavigator`
  consumer beyond `ViewerReportShell`.

## File manifest

- `apps/web/src/features/period/ui/period-navigator.tsx` — add
  `currentPeriodId?: string` to `PeriodNavigatorProps`; `currentIndex` memo
  prefers it over `pathReportId` when present.
- `apps/web/src/features/period/ui/period-navigator.test.tsx` — add a case
  asserting `currentPeriodId` resolves `currentIndex`/trigger label/Prev-Next
  correctly on a pathname the regex doesn't match (simulating the viewer
  route), and that it takes precedence over a mismatched or matching
  pathname.
- `apps/web/src/features/viewer/ui/viewer-report-shell.tsx` — pass
  `currentPeriodId={reportId}` to `<PeriodNavigator>`.
- `apps/web/src/features/viewer/ui/viewer-report-shell.test.tsx` — add/extend
  a case asserting the navigator reflects the addressed `reportId`, not the
  newest period, when the periods list contains an older non-newest entry.

No barrel changes: `PeriodNavigator` is already exported from
`apps/web/src/features/period/index.ts` and consumed by `viewer` through
that existing barrel edge; this change only widens its prop surface.

## Verification

Unit-level (react-testing-library, jsdom) is sufficient to pin the fix —
this is a pure prop-precedence bug, not a rendering/layout regression — but
because the review explicitly flagged wrong on-screen state (label,
highlight, Prev/Next), also do one live-browser confirmation:

1. Boot the app from source (docker images are stale — see
   `~/.claude/projects/.../memory/api-live-verify-from-source.md`).
2. Dev-login as a viewer with access to a group carrying 2+ published
   periods.
3. Open History, click an older (non-newest) period to land on
   `/reports/:id`.
4. Confirm the `PeriodNavigator` trigger label matches the opened period
   (not the newest), the listbox highlights that period, and Next/Prev walk
   relative to it.
5. Confirm explicit dropdown re-selection still navigates correctly
   (regression guard on the already-working path).

## Sequencing

Standalone — no dependency on any other BL-\* change in this batch or the
P0/P1 queue ahead of it. Safe to implement and land independently.
