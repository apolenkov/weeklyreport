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

### Requirement: The legacy `components/admin` folder MUST dissolve into the `admin`, `period`, `review`, and `organization` slices plus `shared`

The grab-bag `apps/web/src/components/admin/` folder MUST be dissolved into five
canonical homes per the authoritative mapping's `Layer` and `Domain` columns, and
the legacy `components/admin/` directory MUST NOT survive the relocation. All 45
source files (filenames unchanged) MUST land as follows: 20 admin-console
components → `features/admin/ui/` and 5 pure utils/hooks/config
(`action-log-format`, `reminders-form-state`, `reminders-tab-format`,
`reminders-tab-mutations`, `timezone-options`) → `features/admin/model/`; the 10
period-lifecycle components (`periods-*`, `settings-periods-*`) →
`features/period/ui/` and `use-period-mutations` → `features/period/model/`; the 3
`reopen-*` files → `features/review/ui/`; the 3
`settings-identity/integrations/notifications` sub-tabs →
`features/organization/ui/`. Each co-located `*.test.tsx` MUST travel with its
source file (9 → `features/admin/ui/`, `periods-tab.test.tsx` →
`features/period/ui/`). Because three files are consumed across ≥2 slices they MUST
graduate out of the slice tree under rule-of-2 (web): `settings-tab-shared.tsx` and
`tab-count-pill.tsx` → `shared/ui/`, and `mock-data.ts` →
`shared/lib/admin-mock-data.ts` (renamed to avoid colliding with the landed
`shared/lib/dashboard-mock-data.ts`); as `shared/` is not a feature slice these
graduations MUST NOT gain a `webSlices` entry or a barrel. The `admin` slice MUST
be fronted by a `features/admin/index.ts` barrel exporting exactly the symbols its
routes load, but NO slice registers in the `webSlices` array this change: the
cross-slice zone keys on the importer, so registering `admin` while its composition
roots (`admin-panel.tsx`, `settings-tab.tsx`) still import `period`/`review`/
`organization` internals would flag those six imports. Registration of all four
seeded slices is deferred to the change that relocates the composition roots. The
relocation MUST be behavior-neutral (no component logic, props, or rendered output
change).

#### Scenario: Admin-folder files land in their canonical slice segments

- **WHEN** the admin dissolution slice is applied
- **THEN** `features/admin/ui/` holds the 20 admin components with their 9
  co-located `*.test.tsx`, and `features/admin/model/` holds the 5 pure
  utils/hooks/config modules
- **AND** `features/period/ui/` holds the 10 period-lifecycle components (with
  `periods-tab.test.tsx`) and `features/period/model/` holds `use-period-mutations`
- **AND** `features/review/ui/` holds the 3 `reopen-*` files and
  `features/organization/ui/` holds the 3 settings sub-tabs
- **AND** `apps/web/src/components/admin/` no longer exists

#### Scenario: The three ≥2-slice primitives graduate to shared

- **WHEN** the relocation slice is applied
- **THEN** `settings-tab-shared.tsx` and `tab-count-pill.tsx` live under
  `shared/ui/` and the former `mock-data.ts` lives at
  `shared/lib/admin-mock-data.ts`, none inside any `features/<domain>` slice
- **AND** every consumer imports them from those `shared/*` paths, and no
  `webSlices` entry or barrel is introduced for `shared/`

#### Scenario: No slice registers until the composition roots relocate

- **WHEN** `eslint.config.ts` is evaluated
- **THEN** the `webSlices` array is unchanged by this change — none of `admin`,
  `period`, `review`, `organization` appears yet (each registers with the change
  that relocates the composition roots off their cross-slice internal imports)
- **AND** the two `app/(app)/admin/*` routes import their symbols from the
  `features/admin` barrel, and the six repointed exemptions reference the
  `features/admin/ui/*` and `shared/lib/admin-mock-data.ts` paths, not the legacy
  `components/admin/*` paths

#### Scenario: Composition roots reach seeded-but-unregistered slices by direct import

- **WHEN** `admin-panel.tsx` and `settings-tab.tsx` render the period, review, and
  organization sub-tabs
- **THEN** they import them by direct recomputed-relative path into the
  `features/{period,review,organization}/ui/*` files
- **AND** because those slices carry no `webSlices` entry this change, the imports
  trip no cross-slice zone (they convert to sibling-barrel imports when those
  slices register in their completing change)

### Requirement: Rule-of-2 leaf UI components MUST live in `shared/ui`, not a feature slice

A business-agnostic web UI component consumed by more than one domain MUST reside
in `apps/web/src/shared/ui/`, not in any `features/<domain>` slice — the web
rule-of-2. Concretely, the global search box `search-input.tsx` (consumed by the
`reports` route and the `admin` slice) and the role-guard render wrapper
`if-role.tsx` (consumed by the `dashboard` slice beside the `auth` domain) MUST
reside at `apps/web/src/shared/ui/search-input.tsx` and
`apps/web/src/shared/ui/if-role.tsx` (filenames unchanged from the legacy
`components/search/` and `components/auth/` trees), and those legacy directories
MUST NOT survive the relocation. Consumers MUST import each component directly
from `shared/ui/*` — no public-API barrel is introduced, as
`TARGET-STRUCTURE-2026-07-02.md` prescribes none for `shared/`. Because `shared/`
is not a feature slice, the `webSlices` cross-slice boundary in `eslint.config.ts`
MUST NOT gain a `search` or `auth` entry, and promoting these leaves to `shared/`
removes the admin→search and dashboard→auth cross-slice imports rather than
allowlisting them. The relocation MUST be behavior-neutral.

#### Scenario: Both leaves land in the shared ui layer

- **WHEN** the relocation is applied
- **THEN** `apps/web/src/shared/ui/` contains `search-input.tsx`, `if-role.tsx`,
  and their co-located `*.test.tsx`
- **AND** `apps/web/src/components/search/` and `apps/web/src/components/auth/`
  no longer exist
- **AND** the files reside under `shared/`, not under any `features/<domain>` slice

#### Scenario: Consumers import the leaves directly from shared

- **WHEN** the `reports` route, the `admin` products tab, or the `dashboard`
  alert bar renders these components
- **THEN** it imports `SearchInput` / `IfRole` from `shared/ui/*` directly (no barrel)
- **AND** no code imports `components/search/*` or `components/auth/*`

#### Scenario: The shared layer is not registered as a feature slice

- **WHEN** `eslint.config.ts` is evaluated
- **THEN** the `webSlices` array contains no `search` or `auth` entry
- **AND** no cross-slice allowlist entry is added for admin→search or dashboard→auth
