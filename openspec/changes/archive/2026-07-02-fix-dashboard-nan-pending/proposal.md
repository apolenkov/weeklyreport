## Why

Two render-time correctness bugs make the head dashboard misleading on two
common states. When a period has zero enrolled leads, `KpiCards` divides by
zero, producing a `NaN%` title and a broken conic-gradient ring. Separately,
`AlertBar` labels the first not-yet-submitted lead as "(Draft)" via a
positional `i === 0` heuristic, but the prop it receives (`pendingLeads`)
is already filtered to not-started leads only — so the first entry is always
a not-started lead and the "Draft" label is never correct
(see `BL-DASHBOARD-CORRECTNESS` /
`docs/repo-excellence-review-2026-06-28.data.json`, finding `dash-1` and
`dash-2`).

## What Changes

- **`KpiCards`** (`apps/web/src/components/dashboard/kpi-cards.tsx`): guard
  the ratio computation with a `total > 0` check; fall back to `0` so the
  ring renders a solid border-colored arc and the title reads `0%` instead
  of `NaN%`.
- **`AlertBar`** (`apps/web/src/components/dashboard/alert-bar.tsx`): remove
  the `isDraft = i === 0` positional heuristic; label every entry in
  `pendingLeads` as "Not started", matching the actual filter semantics.
- **Tests**: add a `KpiCards` regression case for `total === 0`; add an
  `AlertBar` case asserting no entry is labeled "Draft" when all entries are
  not-started.

## Non-goals

- Passing real per-lead status into `AlertBar` (the prop today is a plain
  `string[]` of names; richer typing is a separate concern).
- Any changes to the API, tRPC procedures, or shared Zod schemas.
- Any styling or layout changes beyond the correctness fix.

## Capabilities

### New Capabilities

_(none)_

### Modified Capabilities

- `head-dashboard-clarity`: adding requirements for a safe submission ring
  ratio at zero total and for accurate "Not started" labels in the pending
  alert bar.

## Impact

Affected files:

- `apps/web/src/components/dashboard/kpi-cards.tsx` (one-line guard)
- `apps/web/src/components/dashboard/kpi-cards.test.tsx` (new test case)
- `apps/web/src/components/dashboard/alert-bar.tsx` (drop `isDraft` branch)
- `apps/web/src/components/dashboard/alert-bar.test.tsx` (new test case)

No schema, no API, no shared package changes.
