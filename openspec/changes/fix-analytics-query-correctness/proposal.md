## Why

Wave 2 / P2 from the 2026-07-12 repo-excellence review (docs/reviews/repo-excellence-review-2026-07-12.md).

`AnalyticsPrismaRepository` has three correctness defects, all confirmed
against the current code but none corrupting the live trends surface today:

- `trafficLightHistory` builds a `leadFilter` from `input.leadId` and spreads
  it into `where.sections.some` (report qualification) but never into
  `include.sections.where` (which sections get aggregated). A caller that
  passes `leadId` still gets every in-scope lead's project statuses back —
  the filter is silently ineffective. It stays within the caller's already-
  authorized group scope, so this is not a data leak, and no current caller
  (`apps/web/src/app/(app)/reports/trends/page.tsx`) sends `leadId`, so it is
  an API-contract bug rather than a live one. `packages/shared/src/schemas/analytics.ts`
  still accepts `leadId` as a documented optional input, so the contract must
  honor it.
- `leadVelocity` maps `reports` 1:1 into output rows with no grouping by
  period label, unlike its sibling `trafficLightHistory`, which explicitly
  aggregates by `periodEnd`'s date label because "multiple reports can map
  to one date-label (a republished period...)". A republished period
  produces two rows for the same `periodLabel` in `leadVelocity`'s output
  instead of one, showing duplicate series points on the trends chart.
- `stableHash` (`analytics.service.ts`) passes a top-level `Object.keys(value)`
  array as `JSON.stringify`'s replacer. A replacer array is a single
  whitelist applied at every nesting depth, not per-level, so any nested
  object key not present at the top level is silently dropped from the
  hash. All three analytics input schemas are flat today, so this is latent,
  but it is a landmine for the first nested cache-key input added to any of
  the three analytics endpoints.

## What Changes

- `apps/api/src/modules/analytics/analytics.prisma-repository.ts`:
  `trafficLightHistory` spreads `leadFilter` into `include.sections.where`
  (alongside the existing `scope`), not only into the report-qualifying
  `where.sections.some`, so a `leadId`-filtered call aggregates only that
  lead's sections.
- `apps/api/src/modules/analytics/analytics.prisma-repository.ts`:
  `leadVelocity` groups its `reports` by `periodLabel` (the same
  `isoDateOnly(r.periodEnd)` label `trafficLightHistory` already uses)
  before mapping to output rows, merging every report sharing a label into
  one row with a combined `leads` array instead of emitting one row per
  report. Extract the shared grouping step into a small helper reused by
  both methods rather than duplicating the `reduce`.
- `apps/api/src/modules/analytics/analytics.service.ts`: replace
  `stableHash`'s top-level-keys-as-replacer approach with a recursive
  stable-stringify that sorts keys at every object depth, so a future nested
  cache-key input hashes correctly instead of silently dropping keys below
  the top level.
- Add unit-test coverage: a `leadId`-filtered `trafficLightHistory` call
  returns only the target lead's projects; two reports sharing a
  `periodLabel` collapse into one `leadVelocity` row; `stableHash` (or its
  replacement) produces distinct hashes for two objects that differ only in
  a nested key.
