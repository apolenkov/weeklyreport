## MODIFIED Requirements

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
