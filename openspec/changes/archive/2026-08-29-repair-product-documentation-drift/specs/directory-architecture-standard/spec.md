## RENAMED Requirements

- FROM: `### Requirement: The web dashboard domain MUST live in the \`features/dashboard\` slice with its mock-data graduated to \`shared/lib\``
- TO: `### Requirement: The web dashboard domain MUST live in the \`features/dashboard\` slice with real model ownership`

## MODIFIED Requirements

### Requirement: The web dashboard domain MUST live in the `features/dashboard` slice with real model ownership

The maintained dashboard UI and its presentation models MUST reside under
`apps/web/src/features/dashboard/ui/` and
`apps/web/src/features/dashboard/model/`. The legacy
`apps/web/src/components/dashboard/` tree and the former
`apps/web/src/shared/lib/dashboard-mock-data.ts` module MUST NOT exist. Dashboard
types and mappings MUST derive from the real query read models inside the
dashboard slice rather than from a shared mock-data contract. A route or
other-slice consumer MUST reach the slice only through
`apps/web/src/features/dashboard/index.ts`, whose public surface for route
composition is `DashboardPage`; intra-slice sibling imports MUST stay relative
and MUST NOT round-trip through the barrel. The `dashboard` slice MUST remain in
the enforced web-slice boundary set.

#### Scenario: Dashboard UI and models stay in their owned segments

- **WHEN** the maintained dashboard source inventory is checked
- **THEN** dashboard presentation components are under `features/dashboard/ui/`
- **AND** dashboard mappings and presentation types are under `features/dashboard/model/`
- **AND** the legacy `components/dashboard/` directory does not exist

#### Scenario: Dashboard contracts come from real models

- **WHEN** dashboard UI code imports its display types and mappings
- **THEN** it resolves them from the dashboard model segment or canonical shared API contracts
- **AND** no dashboard or weekly-report consumer imports a dashboard mock-data module

#### Scenario: Consumers reach the slice through the barrel

- **WHEN** the `/head/dashboard` route loads the dashboard composition root
- **THEN** it imports `DashboardPage` from `features/dashboard`
- **AND** the dashboard barrel exports the route composition root without exposing slice internals

#### Scenario: The dashboard slice boundary is machine-enforced

- **WHEN** the web import-boundary configuration is evaluated
- **THEN** `dashboard` is part of the enforced feature-slice set
- **AND** an import from another web slice into dashboard internals is rejected
