# role-model-consistency Specification

## Purpose

TBD - created by archiving change fix-admin-role-model-drift. Update Purpose after archive.

## Requirements

### Requirement: The route role map matches the API authorization gate

The web route role map MUST grant a route only to roles the API actually admits.
This binds `ROUTE_ROLE_MAP` in `role-visibility.ts`, the per-section layout
required-roles it mirrors, and the role descriptions in `openspec/config.yaml` to
the roles the corresponding API procedures accept. Advertising access in the
UI/docs that the API rejects is forbidden — all four sources MUST agree on one
role model.

#### Scenario: Admin route role set matches adminProcedure

- **WHEN** `adminProcedure` admits only the `admin` role
- **THEN** `ROUTE_ROLE_MAP["/admin"]` and the admin layout required-roles list
  `admin` only (not `head`)
- **AND** the `config.yaml` role descriptions do not claim `head` has admin access

#### Scenario: A role reaches a route the API then rejects

- **WHEN** the route map grants a role access to a route whose data procedures the
  API rejects for that role
- **THEN** this is a drift defect: the map/layout/config are corrected to match the
  API gate, or the API gate is changed if the access was intended
