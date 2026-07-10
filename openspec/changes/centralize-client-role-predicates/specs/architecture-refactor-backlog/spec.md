## MODIFIED Requirements

### Requirement: The client permission model is a recorded centralization target

The backlog MUST record that the web client's role-identity checks are
centralized behind the pure predicate module
`apps/web/src/lib/role-predicates.ts` (`isHead` / `isAdmin` / `isLead` /
`isViewer` / `isHeadLike`, all `false` for `null`), landed by
`centralize-client-role-predicates` on 2026-07-10 and pinned by the
`client-role-predicates` spec. The layer is UX affordance only — enforcement
remains the API role-coverage gate and the server route gates; no new guards
were added. The already-centralized surfaces (nav-links role table,
`RoleGate`, `IfRole`, `ROUTE_ROLE_MAP`, `ROLE_HOME_PATH`) stay as they were;
server-computed capability flags stay server-computed. The TARGET IS CLOSED.
The dev role switcher's duplicate `Role` list remains a named future cleanup.

#### Scenario: the permission-model centralization is discoverable

- **WHEN** a maintainer reviews client authorization
- **THEN** the backlog names `role-predicates.ts` as the single identity
  source, records the target as closed by
  `centralize-client-role-predicates`, and links the
  `client-role-predicates` spec
- **AND** it states that enforcement stays with the API role-coverage gate
