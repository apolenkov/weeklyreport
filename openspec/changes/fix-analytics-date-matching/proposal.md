## Why

The analytics surface compares and lists reporting periods by a date-only
label, but three date bugs make the Trends comparison and the traffic-light
history return empty or wrong data. This is the P1-5 finding from the
2026-06-28 repo-excellence review.

1. **Exact-equality day match drops the time component.** `periodComparison`
   (`apps/api/src/modules/analytics/analytics.prisma-repository.ts`) resolves
   each side with `periodEnd: new Date(periodEnd)`. The input is a date-only
   string (`YYYY-MM-DD`), so `new Date(...)` yields midnight UTC, while the
   stored `Report.periodEnd` is a full `DateTime` with a time component. The
   equality never matches, so the comparison silently returns zero rows even
   when both periods exist.

2. **The date schema is a format regex, not a real date.** The shared
   `isoDateOnly` schema (`packages/shared/src/schemas/analytics.ts`) is
   `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`. It accepts impossible calendar
   dates such as `2026-13-45` or `2026-02-30`, which then flow into
   `new Date(...)` and produce a wrong or `Invalid Date` query boundary
   instead of a clean validation rejection at the edge.

3. **Only the first report per label is read; the rest are dropped.**
   `trafficLightHistory` derives one column per distinct `periodEnd`
   date-label, then fills each cell with
   `reports.find((rr) => isoDateOnly(rr.periodEnd) === label)` — the FIRST
   report matching that label. `periodComparison` uses `findFirst` for the
   same reason. When more than one `Report` row maps to a label (a republished
   period, or two periods that differ only by `periodStart`), the other
   reports' project statuses and risks are silently discarded.

## What Changes

- **Match periods by a UTC day range, not exact equality.** `periodComparison`
  resolves each side over `[startOfDayUTC(date), startOfDayUTC(date) + 1 day)`
  so it matches a stored `periodEnd` regardless of its time component. The
  existing `periodFrom`/`periodTo` range filters in `trafficLightHistory` and
  `leadVelocity` keep their day-stable bounds (the upper bound becomes the
  start of the day AFTER `periodTo`).

- **Validate a real calendar date at the schema edge.** `isoDateOnly` gains a
  refine that parses the string as a UTC date and rejects any value that does
  not round-trip to the same `YYYY-MM-DD` (catching `2026-13-45`,
  `2026-02-30`, and `Invalid Date`). The format-only regex stays as the first
  gate so the refine only runs on well-shaped input.

- **Aggregate across every report mapped to a label.** `trafficLightHistory`
  and `periodComparison` collect from ALL reports that fall under a date-label,
  not just the first, with a documented deterministic tie-break when more than
  one report contributes a status for the same project in the same label.

- This change is data-correctness only. It does NOT add group scoping — that is
  the separate `scope-analytics-to-group` change (P0-5). It does NOT change the
  `Report.periodStart`/`periodEnd`/`deadline` storage timezone — that is the
  separate `fix-period-datetime-tz` change (#24). The `published` floor and the
  `leadId`/`projectId` filters are preserved unchanged.

## Impact

- Affected specs: new capability `analytics-period-matching` (ADDED).
- Affected code:
  - `packages/shared/src/schemas/analytics.ts` — `isoDateOnly` real-date refine.
  - `apps/api/src/modules/analytics/analytics.prisma-repository.ts` —
    day-range matching + per-label aggregation in `trafficLightHistory` and
    `periodComparison`, plus the inclusive `periodTo` upper bound in
    `trafficLightHistory` and `leadVelocity`.
  - `apps/api/src/modules/analytics/analytics.service.ts` — bump the three
    analytics cache sub-prefixes so pre-fix cached results are orphaned on
    deploy instead of being served stale until TTL.
- Affected tests: analytics repository unit tests gain day-range,
  invalid-date-rejection, and multi-report-per-label aggregation cases.
- No DB migration: this touches the Zod schema and repository query shape only.
