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
The role VOCABULARY is likewise unified: `unify-role-type` (2026-07-11)
converted every full-union re-declaration — the dev role switcher's duplicate
`Role` list the backlog previously named, plus three more bare duplicate
exported type names (four declarations — `UserRole` was doubled) and the
remaining inline unions (12 declarations across 11 production files, 8 unit
fixtures) — to the shared per-axis types (`Role` session / `DbRole`
persistence, `role-type` spec), pinned by a `DbRole`↔Prisma identity test
and guard parity tests. The five follow-ups it named are now all closed:
(i) role-label drift and (iii) schema-derived membership checks were closed
by `unify-role-label-presentation` (2026-07-11); (ii) the api auth bridge
seams, (iv) dev-email value centralization, and (v) catalog role-token
validation plus stale landing prose were closed by
`finish-role-vocabulary-followups`.

#### Scenario: the permission-model centralization is discoverable

- **WHEN** a maintainer reviews client authorization
- **THEN** the backlog names `role-predicates.ts` as the single identity
  source, records the target as closed by
  `centralize-client-role-predicates`, and links the
  `client-role-predicates` spec
- **AND** it states that enforcement stays with the API role-coverage gate

#### Scenario: the role-vocabulary unification is discoverable

- **WHEN** a maintainer searches for the role type contract
- **THEN** the backlog names the two shared axis types and the `role-type`
  spec, records the vocabulary target as closed by `unify-role-type`, and
  records all five follow-ups as closed by `unify-role-label-presentation`
  and `finish-role-vocabulary-followups`
