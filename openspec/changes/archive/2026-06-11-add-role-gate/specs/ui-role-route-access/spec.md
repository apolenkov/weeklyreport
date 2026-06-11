## ADDED Requirements

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
