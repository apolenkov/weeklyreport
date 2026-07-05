# Mapping — web-comp-charts (2026-07-02)

Source catalog: `docs/architecture/catalog/web-comp-charts-2026-07-02.md`.
Rule applied: Axis 1 domain = `analytics` (already canonical, no collapse needed).
Axis 2 layer = `ui/` (components) per web layer rule (`ui/` = components,
`model/` = hooks/mappers, `api/` = tRPC wrappers). All three files stay
components (no logic extraction implied by this pass), so they land in the
`analytics` slice's `ui/` segment under `features/`.

| Current path                                                   | Target path                                                        | Layer | Domain    | Move? | Note                                                                                                                                                     |
| -------------------------------------------------------------- | ------------------------------------------------------------------ | ----- | --------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| apps/web/src/components/charts/lead-velocity.chart.tsx         | apps/web/src/features/analytics/ui/lead-velocity.chart.tsx         | ui    | analytics | yes   | Pure component; `buildLeadVelocityChartData` helper travels with it (no second-slice consumer yet, rule-of-2 (web) keeps it local, not `shared/`).       |
| apps/web/src/components/charts/period-comparison.chart.tsx     | apps/web/src/features/analytics/ui/period-comparison.chart.tsx     | ui    | analytics | yes   | Pure presentational component consuming `packages/shared` contract types directly (axis-3 rule: wire types stay in `packages/shared`, not duplicated).   |
| apps/web/src/components/charts/traffic-light-history.chart.tsx | apps/web/src/features/analytics/ui/traffic-light-history.chart.tsx | ui    | analytics | yes   | Component + its `buildTrafficLightHistoryChartData` builder; both analytics-domain, no cross-slice reuse observed → stays in slice `ui/`, not `shared/`. |

## Summary

- 3/3 files move (slice migration #3, "Web: remaining slices").
- No renames beyond directory relocation — filenames unchanged.
- No file currently qualifies for `shared/` under the rule-of-2 (web) (each has exactly
  one domain consumer visible in the catalog); revisit if a second
  non-analytics slice starts importing these chart builders.
