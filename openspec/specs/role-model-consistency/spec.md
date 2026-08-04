# role-model-consistency Specification

## Purpose

Keep web route role maps and section guards aligned with the roles admitted by the API authorization gate.

## Requirements

### Requirement: The route role map matches the API authorization gate

The web guarded-route policy MUST grant a route only to roles the API actually
admits. This binds the `*_ROUTE_ROLES` constants and
`rolesForGuardedRoute` in `apps/web/src/shared/model/route-role-policy.ts`, the
required-role arrays passed to `RoleGate` by the route layouts, and the role
descriptions in `openspec/config.yaml` to the roles the corresponding API
procedures accept. Advertising access in the UI/docs that the API rejects is
forbidden — all four sources MUST agree on one role model.

#### Scenario: Admin route role set matches adminProcedure

- **WHEN** `adminProcedure` admits only the `admin` role
- **THEN** `ADMIN_ROUTE_ROLES` / `rolesForGuardedRoute("/admin")` and the
  `apps/web/src/app/(app)/admin/layout.tsx` `RoleGate` required-roles list
  contain `admin` only (not `head`)
- **AND** the `config.yaml` role descriptions do not claim `head` has admin access

#### Scenario: A role reaches a route the API then rejects

- **WHEN** the route map grants a role access to a route whose data procedures the
  API rejects for that role
- **THEN** this is a drift defect: the map/layout/config are corrected to match the
  API gate, or the API gate is changed if the access was intended
