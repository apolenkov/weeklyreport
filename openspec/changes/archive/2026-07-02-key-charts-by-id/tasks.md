## 1. Fix LeadVelocityChart

- [ ] 1.1 In `apps/web/src/components/charts/lead-velocity.chart.tsx`, extract a
      pure exported builder (e.g. `buildLeadVelocityChartData(rows)`) that returns
      `{ data, series }`, where each `data` point keys its entity columns by
      `leadId` (UUID) instead of `leadNameById.get(id)`, and `series` is an array
      of `{ dataKey: leadId, name: leadName }` descriptors.
- [ ] 1.2 Render the `Bar` elements from `series`: set `dataKey={s.dataKey}` and
      `name={s.name}` so recharts legend and tooltip still show the lead name.

## 2. Fix TrafficLightHistoryChart

- [ ] 2.1 In `apps/web/src/components/charts/traffic-light-history.chart.tsx`,
      extract a pure exported builder (e.g.
      `buildTrafficLightHistoryChartData(periods, rows)`) that returns
      `{ data, series }`, where each `data` point keys its entity columns by
      `row.projectId` (UUID) instead of `row.projectName`, and `series` is an
      array of `{ dataKey: projectId, name: projectName }` descriptors.
- [ ] 2.2 Render the `Line` elements from `series`: set `dataKey={s.dataKey}` and
      `name={s.name}` so the recharts tooltip still shows the project name (this
      chart renders a tooltip but no legend).

## 3. Regression tests

- [ ] 3.1 In `apps/web/src/components/charts/charts.test.tsx`, call
      `buildLeadVelocityChartData` with two leads that share the same `leadName`
      but have distinct `leadId` values for one period; assert the period's data
      point holds two columns keyed by the two `leadId`s, each carrying its own
      `submittedSections` value (not collapsed to one), and that `series` carries
      both `{ dataKey: leadId, name: leadName }` descriptors.
- [ ] 3.2 Call `buildTrafficLightHistoryChartData` with two rows that share the
      same `projectName` but have distinct `projectId` values; assert each data
      point holds two columns keyed by the two `projectId`s with independent
      status values, and that `series` carries both
      `{ dataKey: projectId, name: projectName }` descriptors.
- [ ] 3.3 Keep the existing crash-free-mount render tests for all three charts;
      asserting against real recharts SVG output is brittle in jsdom (zero-width
      `ResponsiveContainer`), so the value/identity assertions go through the
      pure builders, not the rendered tree.

## 4. Verification

- [ ] 4.1 Run `pnpm typecheck` from the repo root — exit 0.
- [ ] 4.2 Run `pnpm lint` from the repo root — exit 0.
- [ ] 4.3 Run `cd apps/web && pnpm exec vitest run src/components/charts/` —
      all tests pass, including the new regression tests from step 3.
- [ ] 4.4 Run `pnpm build` from the repo root — exit 0.
