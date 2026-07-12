## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

`apps/web/src/app/(app)/reports/trends/page.tsx` pins its analytics query
window to hardcoded constants, `PERIOD_FROM = "2026-01-01"` and
`PERIOD_TO = "2026-12-31"`, and feeds them verbatim to both
`trafficLightHistory` and `leadVelocity`. The repository filters on
`periodStart >= periodFrom` and `periodEnd < periodTo + 1 day`
(`apps/api/src/modules/analytics/analytics.prisma-repository.ts:53-56,111-114`),
so from 2027-01-01 every real report falls outside the window: both queries
return zero rows, `latestPeriodPair` resolves `null` from an empty `periods`
array (`apps/web/src/lib/analytics-periods.ts:13`), and the comparison query
is disabled too. The page does not crash and does not render blank — each
chart already has an explicit empty state ("No published periods in range.",
"No velocity data in range.") — but the whole Trends page silently stops
showing real data for every role that can reach it, with no error and no
signal that the window itself is the cause. A neighboring comment already
documents that a _pinned pair_ goes stale ("the seed generates period-end
dates relative to the run date, so any pinned pair goes stale") and fixed
that for the inner comparison pair via `latestPeriodPair`; the outer year
window that feeds both primary queries was never given the same treatment.

This is a scheduled-loss time bomb, not an active defect: the window stays
valid until 2027-01-01, there is no production point yet, and the failure
degrades to a loud, self-explanatory empty state rather than a crash. It
still needs a durable fix before the pinned bound expires.

## What Changes

- `apps/web/src/app/(app)/reports/trends/page.tsx`: replace the hardcoded
  `PERIOD_FROM`/`PERIOD_TO` constants with a window derived at request time —
  a rolling 12-month span anchored on the current date (`today - 12 months`
  through `today`). This mirrors the rationale already applied to the
  comparison pair: never pin an absolute calendar bound that a seed or a real
  report set will eventually outgrow.
- Extract the derivation into a small pure helper (e.g.
  `apps/web/src/lib/trends-window.ts`, colocated with the existing
  `analytics-periods.ts` helpers) so it is unit-testable without mounting the
  page component.
- No API or repository change: `trafficLightHistory` and `leadVelocity`
  already accept arbitrary `periodFrom`/`periodTo` strings; only the caller's
  choice of bounds changes.
- No change to the empty-state chart components — they already render a
  loud, correct message when a window returns zero rows; that behavior is
  preserved and covered by the new spec as the acceptance backstop for any
  future window edge case (e.g. a workspace with no reports yet).

## Impact

- `apps/web/src/app/(app)/reports/trends/page.tsx`
- `apps/web/src/lib/trends-window.ts` (new)
- `apps/web/src/lib/trends-window.test.ts` (new)

Non-goals: no change to `apps/api/src/modules/analytics/analytics.prisma-repository.ts`
or its filtering semantics; no change to `latestPeriodPair`'s existing
data-min/max-derived comparison-pair logic, which already handles the inner
pair correctly; no change to the chart components' empty-state copy.
