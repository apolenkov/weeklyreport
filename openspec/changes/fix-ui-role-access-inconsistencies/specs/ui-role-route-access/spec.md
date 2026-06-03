# ui-role-route-access Specification (delta)

Adds a consistency requirement for how the web app gates and denies role-scoped
routes, prompted by the `/lead/report/:id/preview` route having no role guard.

## ADDED Requirements

### Requirement: Role-prefixed routes enforce role consistently

Every route under a role prefix (`/lead/*`, `/head/*`, `/admin/*`) MUST apply the
same per-page (or per-layout) role guard as its siblings. A role-prefixed route
MUST NOT be reachable by a role outside its prefix's allowed set unless an
explicit, documented cross-role exception exists. The page MUST render without a
client/server hydration mismatch (zero console errors).

#### Scenario: The lead preview route matches its siblings

- **WHEN** a non-lead role (head or admin) opens `/lead/report/:id/preview`
- **THEN** it is handled identically to the other `/lead/*` routes — redirected
  away, or explicitly documented and tested as an intentional cross-role surface
- **AND** the page logs zero console errors (the `WeeklyReportSkeleton` hydration
  mismatch is fixed)

### Requirement: Access denial returns the visitor to their own home

When a role is denied a route, any "go home" affordance on the denial surface MUST
resolve to the visitor's own role home, never a hardcoded destination.

#### Scenario: Denied lead is sent to the lead home

- **WHEN** a lead is denied a `/head/*` or `/admin/*` route and uses the denial
  screen's home link
- **THEN** the link resolves to the lead's home via the `role-home` helper, not a
  hardcoded `/head/dashboard`
