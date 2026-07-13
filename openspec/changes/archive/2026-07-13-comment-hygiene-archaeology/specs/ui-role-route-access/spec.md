## ADDED Requirements

### Requirement: ForbiddenPage copy stays environment-agnostic

`ForbiddenPage`'s body copy MUST NOT reference an affordance that only
exists in some environments (such as a dev-only role switcher). The copy
MUST read correctly for a denied visitor regardless of whether the app is
running in dev, UAT, or production.

#### Scenario: A denied visitor in production sees only real affordances

- **WHEN** a role fails a route's gate and `ForbiddenPage` renders
- **THEN** the body copy names the required role and offers the "go to
  dashboard" link
- **AND** the copy does not tell the visitor to use a dev-only role switcher
  or any other affordance that may not exist in the running environment
