# directory-architecture-standard Specification

## Purpose

Machine-enforced placement rules for the FSD-lite web tree
(`apps/web/src`): domain slices live under `features/<domain>` behind
per-slice import boundaries, business-agnostic primitives live under
`shared/`, and legacy flat `components/` folders do not survive their
relocation. Grown one requirement per landed restructure slice (parent
change: restructure-directory-architecture, task 3.1).

## Requirements

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

### Requirement: App-wide navigation chrome MUST live in the `shared/ui/navigation` layer

Business-agnostic, app-wide web chrome MUST reside in `apps/web/src/shared/`, not
in any `features/<domain>` slice. Concretely, the navigation bar and its
hydration skeleton MUST reside in `apps/web/src/shared/ui/navigation/`
(`nav-bar.tsx`, `nav-bar-skeleton.tsx`, filenames unchanged from the legacy
`apps/web/src/components/navigation/` tree), and the legacy
`components/navigation/` directory MUST NOT survive the relocation. Because nav
chrome is mounted app-wide (`app/(app)/layout.tsx`) and owned by no single domain
slice, it graduates to `shared/ui/` rather than `features/<domain>/ui/`; no
feature slice may claim it. A consumer MUST import the components directly from
`shared/ui/navigation/*` — no public-API barrel is introduced, as
`TARGET-STRUCTURE-2026-07-02.md` prescribes none for `shared/`. `shared/` is not
a feature slice, so the `webSlices` cross-slice boundary in `eslint.config.ts`
MUST NOT gain a navigation entry. The relocation MUST be behavior-neutral (no
component logic, props, or rendered output change).

#### Scenario: Navigation chrome lands in the shared ui layer

- **WHEN** the navigation relocation is applied
- **THEN** `apps/web/src/shared/ui/navigation/` contains `nav-bar.tsx`,
  `nav-bar-skeleton.tsx`, and the co-located `nav-bar.test.tsx`
- **AND** `apps/web/src/components/navigation/` no longer exists
- **AND** the files reside under `shared/`, not under any `features/<domain>` slice

#### Scenario: The layout consumer imports nav chrome directly from shared

- **WHEN** the `app/(app)/layout.tsx` root layout renders the nav chrome
- **THEN** it imports `NavBar` and `NavBarSkeleton` from
  `shared/ui/navigation/*` directly (no barrel)
- **AND** no code outside `shared/ui/navigation/` imports `components/navigation/*`

#### Scenario: The shared layer is not registered as a feature slice

- **WHEN** `eslint.config.ts` is evaluated
- **THEN** the `webSlices` array contains no `navigation` entry
- **AND** the two path-pinned lint exemptions for `nav-bar.tsx` reference the
  `shared/ui/navigation/` path, not the legacy `components/navigation/` path

### Requirement: The web dashboard domain MUST live in the `features/dashboard` slice with its mock-data graduated to `shared/lib`

The eleven dashboard components MUST reside in
`apps/web/src/features/dashboard/ui/` (filenames unchanged from the legacy
`apps/web/src/components/dashboard/` tree), their co-located `*.test.tsx` and
`__snapshots__/` traveling with them, and the legacy `components/dashboard/`
directory MUST NOT survive the relocation. Because its type/const module
`mock-data.ts` is consumed by the dashboard slice AND the weekly-report feature
(≥2 slices), it MUST graduate under rule-of-2 (web) out of the slice to
`apps/web/src/shared/lib/dashboard-mock-data.ts` (renamed to avoid colliding with
admin's `mock-data.ts`) — the only lawful meeting point for a two-slice-consumer
helper — and MUST NOT remain inside the slice. A route or other-slice consumer
MUST reach the slice only through the public API barrel
`features/dashboard/index.ts`, which MUST export exactly `DashboardPage` (the sole
symbol the head-dashboard route loads); intra-slice sibling imports MUST stay
relative and MUST NOT round-trip through the barrel. The `dashboard` slice MUST be
listed in the `webSlices` array in `eslint.config.ts` so its cross-slice import
boundary is machine-enforced, and the relocation MUST be behavior-neutral (no
component logic, props, or rendered output change).

#### Scenario: Dashboard components land in the slice ui segment

- **WHEN** the dashboard relocation slice is applied
- **THEN** `apps/web/src/features/dashboard/ui/` contains all eleven dashboard
  components with their co-located `*.test.tsx` and `__snapshots__/`
- **AND** `apps/web/src/components/dashboard/` no longer exists

#### Scenario: The shared mock-data module graduates out of the slice

- **WHEN** the relocation slice is applied
- **THEN** the former `mock-data.ts` lives at
  `apps/web/src/shared/lib/dashboard-mock-data.ts`, not inside the slice
- **AND** the dashboard `kpi-cards` component and every weekly-report + print
  consumer import their dashboard types/consts from that `shared/lib` path

#### Scenario: Consumers reach the slice through the barrel

- **WHEN** the `/head/dashboard` route loads the dashboard composition root
- **THEN** it imports `DashboardPage` from `features/dashboard` (the barrel),
  which exports exactly `DashboardPage`
- **AND** no code outside the slice imports `components/dashboard/*`

#### Scenario: The dashboard slice boundary is machine-enforced

- **WHEN** `eslint.config.ts` is evaluated
- **THEN** `dashboard` appears in the `webSlices` array
- **AND** an import from `features/dashboard` into another web slice's internals
  is reported as an error by the cross-slice zone
- **AND** the five path-pinned lint exemptions that referenced
  `components/dashboard/*` now reference the `features/dashboard/ui/*` and
  `shared/lib/dashboard-mock-data.ts` paths

### Requirement: Report-shell UI primitives MUST live in the `shared/ui/report-shell` layer

Business-agnostic report-shell UI primitives MUST reside in
`apps/web/src/shared/ui/report-shell/`, not in any `features/<domain>` slice and
not in the legacy flat `apps/web/src/components/report-shell/` tree. The whole
legacy folder is flat-renamed: every source file — the eleven mapped primitives
(`accordion-section`, `agent-review-coming-soon`, `archive-toggle`, `lock-badge`,
`meta-row`, `report-toolbar`, `save-now-button`, `scope-toggle`,
`segmented-toggle`, `toolbar-icon-button`, `view-mode-toggle`) plus the
post-catalog additions `rotating-chevron` and `use-report-shell-url-state` — its
co-located tests, and the `__snapshots__/` directory MUST move together, filenames
unchanged, and the legacy `components/report-shell/` directory MUST NOT survive
the relocation. Because these primitives are consumed across lead, head, viewer,
weekly-report, slides, and the dashboard slice and are owned by no single domain,
they graduate to `shared/ui/` rather than `features/<domain>/ui/`; no feature
slice may claim them, and the `webSlices` cross-slice boundary in
`eslint.config.ts` MUST NOT gain a report-shell entry. Consumers MUST import the
primitives directly from `shared/ui/report-shell/*` — no public-API barrel is
introduced, as `TARGET-STRUCTURE-2026-07-02.md` prescribes none for `shared/`.
The relocation MUST be behavior-neutral (no component logic, props, or rendered
output change).

#### Scenario: Report-shell primitives land in the shared ui layer

- **WHEN** the report-shell relocation is applied
- **THEN** `apps/web/src/shared/ui/report-shell/` contains all thirteen source
  files (the eleven mapped primitives plus `rotating-chevron.tsx` and
  `use-report-shell-url-state.ts`), every co-located `*.test.tsx`/`*.test.ts`, and
  the `__snapshots__/` directory
- **AND** `apps/web/src/components/report-shell/` no longer exists
- **AND** the files reside under `shared/`, not under any `features/<domain>` slice

#### Scenario: Consumers import report-shell primitives directly from shared

- **WHEN** any surface (lead, head, viewer, weekly-report, slides, dashboard, or a
  route) renders a report-shell primitive
- **THEN** it imports the component from `shared/ui/report-shell/*` directly (no
  barrel), with the relative path recomputed from the consumer's own location
- **AND** no code outside `shared/ui/report-shell/` imports the legacy
  `components/report-shell/*` path

#### Scenario: Moved files' cross-directory imports are recomputed, not merely deepened

- **WHEN** `lock-badge.tsx` and `save-now-button.tsx` are relocated
- **THEN** `lock-badge.tsx` imports `sdlc-tooltip` from
  `../../../components/ui/sdlc-tooltip` (routed back through `components/`, not
  `shared/ui/sdlc-tooltip`)
- **AND** `save-now-button.tsx` imports the `AutosaveSnapshot` type from
  `../../../hooks/use-lead-form-autosave`
- **AND** intra-folder `./`-relative imports between the moved files stay valid
  unchanged

#### Scenario: The shared layer is not registered as a feature slice and needs no lint exemption

- **WHEN** `eslint.config.ts` is evaluated
- **THEN** the `webSlices` array contains no `report-shell` entry
- **AND** no path-pinned size/complexity exemption references any report-shell
  file (none existed for the legacy path, and the flat rename introduces none)
