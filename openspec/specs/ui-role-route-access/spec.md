# ui-role-route-access Specification

## Purpose

TBD - created by archiving change fix-ui-role-access-inconsistencies. Update Purpose after archive.

## Requirements

### Requirement: Role denials render a uniform in-page wall

Every role gate (per-layout or per-page) MUST deny access by rendering the shared
in-page `ForbiddenPage` at the requested URL — never by redirecting the visitor
elsewhere. A role-prefixed route (`/lead/*`, `/head/*`, `/admin/*`) MUST NOT be
reachable by a role outside its allowed set unless an explicit, documented
cross-role exception exists.

#### Scenario: A denied role sees the in-page wall

- **WHEN** a role that fails a route's gate requests that route
- **THEN** the route renders `ForbiddenPage` at the same URL, with no redirect

#### Scenario: The lead preview route is lead-only

- **WHEN** a non-lead role (head, admin, or viewer) opens
  `/lead/report/:id/preview`
- **THEN** the page renders the in-page `ForbiddenPage` wall (the preview is a
  lead self-review surface scoped to the viewer's own authorId, so it is
  meaningless for other roles)
- **AND** only the `lead` role renders the preview content

### Requirement: Access denial returns the visitor to their own home

When a role is denied a route, the "go home" affordance on the denial surface MUST
resolve to the visitor's own role home via the `role-home` helper, falling back to
`/` for anonymous visitors — never a hardcoded destination. `ForbiddenPage` stays
role-agnostic: the caller passes a pre-resolved `homeHref` string (it never
receives the visitor's role).

#### Scenario: Denied visitor is sent to their own home

- **WHEN** a visitor is denied a route and uses the denial screen's home link
- **THEN** the link resolves to `roleHomePath(role)` for an authenticated visitor,
  or `/` when there is no session — not a hardcoded `/head/dashboard`

### Requirement: Role gates route through the shared RoleGate component

Every SSR role gate in the web app (per-layout or per-page) MUST be
implemented by wrapping the gated content in the shared `RoleGate` server
component (`apps/web/src/components/role-gate.tsx`), passing the route's
allowed roles via its `allowedRoles` prop. New hand-rolled guard blocks
(calling `getServerSession` and rendering `ForbiddenPage` directly inside
a layout or page) MUST NOT be added. `RoleGate` MUST itself satisfy the
existing contracts of this spec: it denies by rendering the in-page
`ForbiddenPage` at the requested URL (never a redirect), and it resolves
the wall's `homeHref` via `roleHomePath` with the `/` fallback for
anonymous visitors. Per-route allowed-role arrays remain declared at each
call site (route policies are intentionally distinct); a centralized
route→roles map is out of contract. The `api/revalidate-org` route
handler is exempt: it consumes the raw session and answers with 401 JSON,
not a rendered wall.

#### Scenario: a new role-gated segment is added

- **WHEN** a developer adds a role restriction to a new layout or page
- **THEN** the restriction is expressed as
  `<RoleGate allowedRoles={...}>` around the segment's children, not as a
  duplicated inline session/role check

#### Scenario: RoleGate denies a visitor

- **WHEN** the session is absent or its role is not in `allowedRoles`
- **THEN** `RoleGate` renders `ForbiddenPage` in place with
  `requiredRoles` equal to the gate's `allowedRoles`
- **AND** `homeHref` is `roleHomePath(session.role)` for an authenticated
  visitor, or `/` when there is no session

#### Scenario: RoleGate allows a visitor

- **WHEN** the session role is in `allowedRoles`
- **THEN** the children render unchanged, with no extra wrapper element
  around them
