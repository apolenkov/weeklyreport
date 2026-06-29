# Tasks

## 1. Shared schema: real-date validation

- [ ] 1.1 In `packages/shared/src/schemas/analytics.ts`, keep the
      `/^\d{4}-\d{2}-\d{2}$/` regex as the first gate and add a `.refine` that
      parses the value as a UTC date (`${s}T00:00:00.000Z`) and confirms it
      round-trips to the same `YYYY-MM-DD`; guard `Invalid Date` with
      `Number.isNaN(d.getTime())` so the refine returns `false` instead of
      throwing.
- [ ] 1.2 Confirm every analytics field (`periodFrom`, `periodTo`, `periodA`,
      `periodB`, and the output label fields) reuses the single `isoDateOnly`
      schema so the refine applies everywhere.

## 2. Repository: UTC day-range helpers

- [ ] 2.1 In `apps/api/src/modules/analytics/analytics.prisma-repository.ts`,
      add `startOfUtcDay(dateOnly)` and `nextUtcDay(dateOnly)` helpers beside
      the existing `isoDateOnly`.
- [ ] 2.2 Replace `periodComparison` exact equality
      (`periodEnd: new Date(periodEnd)`) with a half-open range
      `{ gte: startOfUtcDay(date), lt: nextUtcDay(date) }`, preserving the
      `published` floor.
- [ ] 2.3 Change the `trafficLightHistory` upper bound from
      `periodEnd: { lte: new Date(periodTo) }` to `{ lt: nextUtcDay(periodTo) }`
      so the final day is inclusive; apply the same correction to
      `leadVelocity` for parity.
- [ ] 2.4 Bump the three analytics cache sub-prefixes in
      `apps/api/src/modules/analytics/analytics.service.ts` (`PREFIX_HISTORY`,
      `PREFIX_VELOCITY`, `PREFIX_COMPARISON`) by appending a version segment
      (e.g. `...:v2:`) so pre-fix cached results are orphaned on deploy instead
      of being served until TTL; keep the bumped prefixes under the
      `customreport:analytics:` SCAN root used by `invalidateAll`.

## 3. Repository: aggregate per label

- [ ] 3.1 In `trafficLightHistory`, build a `Map<label, Report[]>` and replace
      the per-cell `reports.find(...)` with a scan over all reports under the
      label, choosing the status by the documented tie-break (latest
      `periodEnd`, then latest `createdAt`).
- [ ] 3.2 In `periodComparison`, change `fetchOne` to fetch ALL reports under
      the side's day range and run the existing `collect` accumulator across
      them so risk counts sum and statuses follow the same tie-break.
- [ ] 3.3 Preserve the `projectId`/`leadId` filters and `published` floor in
      both paths.

## 4. Tests

- [ ] 4.1 Schema test: `isoDateOnly` accepts `2026-06-26`, rejects
      `2026-02-30`, `2026-13-45`, and a non-date string.
- [ ] 4.2 Repository test: a report with a non-midnight `periodEnd` is matched
      by its date-only label in `periodComparison` (the exact-equality
      regression is closed — `rows` is non-empty).
- [ ] 4.3 Repository test: two reports sharing a label both contribute project
      statuses in `trafficLightHistory`, and the tie-break is deterministic
      across two runs.
- [ ] 4.4 Repository test: risk counts sum across two reports mapped to the same
      `periodComparison` side.
- [ ] 4.5 Repository test: a report whose `periodEnd` carries a non-midnight time
      on the `periodTo` day is included by `trafficLightHistory` and
      `leadVelocity` (the inclusive final-day bound holds).

## 5. Gates

- [ ] 5.1 `pnpm --filter @customreport/shared build` (regenerate shared types).
- [ ] 5.2 `pnpm typecheck`, `pnpm lint`, and the analytics tests pass.
- [ ] 5.3 `openspec validate "fix-analytics-date-matching" --strict` exits 0.
