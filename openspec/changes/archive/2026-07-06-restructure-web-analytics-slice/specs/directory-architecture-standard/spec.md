## ADDED Requirements

### Requirement: The web analytics domain MUST live in the `features/analytics` slice

The three analytics chart components MUST reside in
`apps/web/src/features/analytics/ui/` (filenames unchanged from the legacy
`apps/web/src/components/charts/` tree), and the legacy `components/charts/`
directory MUST NOT survive the relocation. Each chart's data-shaping builder
(`buildLeadVelocityChartData`, `buildTrafficLightHistoryChartData`) MUST travel
co-located with its component in the slice `ui/` segment — the rule-of-2 (web)
promotion to `src/shared/` is unmet (no second-slice consumer), so nothing
graduates. A route or other-slice consumer MUST reach the components only through
the slice public API barrel `features/analytics/index.ts`, which MUST export
exactly the components consumed. The `analytics` slice MUST be listed in the
`webSlices` array in `eslint.config.ts` so its cross-slice import boundary is
machine-enforced, and the relocation MUST be behavior-neutral (no component
logic, props, or rendered output change).

#### Scenario: Analytics charts land in the slice ui segment

- **WHEN** the analytics relocation slice is applied
- **THEN** `apps/web/src/features/analytics/ui/` contains
  `lead-velocity.chart.tsx`, `period-comparison.chart.tsx`, and
  `traffic-light-history.chart.tsx` with their co-located `charts.test.tsx`
- **AND** `apps/web/src/components/charts/` no longer exists
- **AND** each chart-data builder lives beside its component (not in `src/shared/`)

#### Scenario: Consumers reach charts through the slice barrel

- **WHEN** the `/reports/trends` route loads the chart components
- **THEN** it imports them from `features/analytics` (the barrel), which exports
  exactly `LeadVelocityChart`, `PeriodComparisonChart`, and
  `TrafficLightHistoryChart`
- **AND** no code outside the slice imports `components/charts/*`

#### Scenario: The analytics slice boundary is machine-enforced

- **WHEN** `eslint.config.ts` is evaluated
- **THEN** `analytics` appears in the `webSlices` array
- **AND** an import from `features/analytics` into another web slice's internals
  is reported as an error by the cross-slice zone
