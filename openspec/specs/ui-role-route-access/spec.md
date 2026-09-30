# ui-role-route-access Specification

## Purpose

Render role-based route denials through one environment-agnostic in-page wall that returns each visitor to their own home without redundant nested gates.

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
resolve to the visitor's own role home via `ROLE_HOME_PATH`, falling back to
`/` for anonymous visitors — never a hardcoded destination. `ForbiddenPage` stays
role-agnostic: the caller passes a pre-resolved `homeHref` string (it never
receives the visitor's role).

#### Scenario: Denied visitor is sent to their own home

- **WHEN** a visitor is denied a route and uses the denial screen's home link
- **THEN** the link resolves to `ROLE_HOME_PATH[role]` for an authenticated visitor,
  or `/` when there is no session — not a hardcoded `/head/dashboard`

### Requirement: Role gates route through the shared RoleGate component

Every SSR role gate in the web app (per-layout or per-page) MUST be
implemented by wrapping the gated content in the shared `RoleGate` server
component (`apps/web/src/shared/ui/auth-runtime/role-gate.tsx`), passing the route's
allowed roles via its `allowedRoles` prop. New hand-rolled guard blocks
(calling `getServerSession` and rendering `ForbiddenPage` directly inside
a layout or page) MUST NOT be added. `RoleGate` MUST itself satisfy the
existing contracts of this spec: it denies by rendering the in-page
`ForbiddenPage` at the requested URL (never a redirect), and it resolves
the wall's `homeHref` via `ROLE_HOME_PATH[session.role]` with the `/` fallback for
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
- **AND** `homeHref` is `ROLE_HOME_PATH[session.role]` for an authenticated
  visitor, or `/` when there is no session

#### Scenario: RoleGate allows a visitor

- **WHEN** the session role is in `allowedRoles`
- **THEN** the children render unchanged, with no extra wrapper element
  around them

### Requirement: A Nested Role Gate MUST NOT Duplicate an Ancestor's Role Set

A `RoleGate` placed on a nested layout or page MUST NOT specify the exact
same `allowedRoles` set as an ancestor layout's `RoleGate` already covering
that route. An identical nested gate adds a second serial session check on
every render of the subtree without narrowing access, since any visitor the
ancestor gate would deny never reaches the nested gate in the first place.
A nested `RoleGate` is only justified when it narrows the ancestor's allowed
role set (a strict subset) for that specific subtree.

#### Scenario: A route segment relies on its ancestor's gate

- **GIVEN** an ancestor layout's `RoleGate` already restricts a route
  subtree to `["head", "admin"]`
- **WHEN** a nested layout or page under that subtree needs no narrower
  restriction
- **THEN** the nested segment renders its children directly, with no
  additional `RoleGate` wrapping the same role set

#### Scenario: A route segment narrows access for its own subtree

- **GIVEN** an ancestor layout's `RoleGate` restricts a route subtree to
  `["head", "admin"]`
- **WHEN** one nested segment within that subtree must be restricted further
  (a strict subset, e.g. `["admin"]` only)
- **THEN** that segment MAY wrap its children in its own `RoleGate` with the
  narrower `allowedRoles`, since it changes the effective access set

### Requirement: ForbiddenPage copy stays environment-agnostic

`ForbiddenPage`'s body copy MUST NOT reference an affordance that only
exists in some environments (such as a dev-only role switcher). The copy
MUST read correctly for a denied visitor in every runtime environment. Its
message MUST plainly state that the visitor does not have access to the page.
Any required-role explanation MUST derive from the supplied `requiredRoles`.
The existing role-agnostic home link MUST read "Go to my home page" and MUST
retain its caller-supplied `homeHref`; its label MUST NOT assume that every
role has a dashboard.

#### Scenario: A denied visitor in production sees only real affordances

- **WHEN** a role fails a route's gate and `ForbiddenPage` renders
- **THEN** the body copy accurately explains the denial and offers the "Go to my home page" link
- **AND** the copy does not tell the visitor to use a dev-only role switcher
  or any other affordance that may not exist in the running environment

#### Scenario: Denial copy follows the supplied policy

- **WHEN** a denied visitor sees a gate requiring head or admin
- **THEN** any role explanation names head or admin rather than a hardcoded admin-only requirement
- **AND** the home link keeps the existing visitor-specific destination
