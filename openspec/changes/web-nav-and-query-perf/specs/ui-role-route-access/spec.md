## ADDED Requirements

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
