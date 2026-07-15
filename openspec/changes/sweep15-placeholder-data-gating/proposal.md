## Why

Changing report periods can briefly render the previous period's content under the new URL, including mutation controls aimed at the wrong report. P1-3 in `docs/reviews/2026-07-15-external-sweep.md` traces this to global `keepPreviousData` combined with consumers that gate only on initial loading.

## What Changes

- Remove `placeholderData: keepPreviousData` from the global query-client defaults.
- Opt individual identity-stable list/pagination queries into `keepPreviousData` only where retaining rows cannot relabel one report as another or expose report-scoped mutations.
- Keep report-by-id and period-changing queries in a pending state until data for the new query key arrives.
- Add regression coverage for rapid period navigation on head, viewer, lead, print, and slide report consumers, including mutation suppression while the next report is pending.

## Capabilities

### New Capabilities

- `report-query-transition-integrity`: report-scoped UI and mutations never consume another report key's placeholder data during navigation.

### Modified Capabilities

<!-- none -->

## Impact

- Web query defaults plus report-scoped TanStack Query consumers and tests.
- No API, schema, route, authorization, or report lifecycle changes.

## Non-goals

- Removing useful previous-data behavior from explicitly audited list/pagination queries.
- Redesigning report loading skeletons or period navigation.
- Fixing the independent `activity.live` head-slides gate; that follows in `sweep15-head-slides-activity-gate`.
