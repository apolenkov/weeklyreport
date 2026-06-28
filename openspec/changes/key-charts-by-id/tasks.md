## 1. Fix LeadVelocityChart

- [ ] 1.1 In `apps/web/src/components/charts/lead-velocity.chart.tsx`, change
      the data-point builder so each entity column is keyed by `leadId` (UUID)
      instead of `leadNameById.get(id)`.
- [ ] 1.2 Update the `Bar` element to set `dataKey={id}` and add
      `name={leadNameById.get(id) ?? id}` so recharts legend and tooltip still
      show the lead name.

## 2. Fix TrafficLightHistoryChart

- [ ] 2.1 In `apps/web/src/components/charts/traffic-light-history.chart.tsx`,
      change the data-point builder so each entity column is keyed by
      `row.projectId` (UUID) instead of `row.projectName`.
- [ ] 2.2 Update the `Line` element to set `dataKey={row.projectId}` and add
      `name={row.projectName}` so recharts legend and tooltip still show the
      project name.

## 3. Regression tests

- [ ] 3.1 In `apps/web/src/components/charts/charts.test.tsx`, add a test for
      `LeadVelocityChart` with two leads that share the same `leadName` but have
      distinct `leadId` values; assert that both `submittedSections` values appear
      in the rendered tree (not just one, which would indicate a collision).
- [ ] 3.2 Add a test for `TrafficLightHistoryChart` with two rows that share
      the same `projectName` but have distinct `projectId` values; assert that
      both status series are present (e.g. two `Line` elements with different
      `dataKey` values).

## 4. Verification

- [ ] 4.1 Run `pnpm typecheck` from the repo root — exit 0.
- [ ] 4.2 Run `pnpm lint` from the repo root — exit 0.
- [ ] 4.3 Run `cd apps/web && pnpm exec vitest run src/components/charts/` —
      all tests pass, including the new regression tests from step 3.
- [ ] 4.4 Run `pnpm build` from the repo root — exit 0.
