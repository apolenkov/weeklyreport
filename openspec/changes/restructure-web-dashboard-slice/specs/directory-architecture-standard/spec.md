## ADDED Requirements

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
