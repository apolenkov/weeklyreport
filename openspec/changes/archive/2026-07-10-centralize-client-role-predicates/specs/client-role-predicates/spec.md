## ADDED Requirements

### Requirement: Client role identity has one predicate source

The web client MUST answer role-identity questions through the pure
predicates in `apps/web/src/lib/role-predicates.ts` (`isHead`, `isAdmin`,
`isLead`, `isViewer`, `isHeadLike`) instead of inline role comparisons.
Every predicate MUST return `false` for `null`. Call sites keep their own
operands (session role, server read-model `authorRole`) and their explicit
null guards; feature-level compounds keep their local names, built from the
predicates.

#### Scenario: components import instead of re-deriving

- **WHEN** a web module needs to know whether a role is head-like, lead,
  admin, or viewer
- **THEN** it calls the shared predicate with its existing role operand
- **AND** no component re-declares an inline `role === "…"` identity
  comparison for those questions

#### Scenario: null means not-that-role

- **WHEN** a predicate receives `null` (session loading or absent)
- **THEN** it returns `false`
- **AND** call sites that branch on `null` explicitly keep their own guard

### Requirement: The predicate layer is not a security boundary

The predicate module MUST declare — and the workspace MUST treat — the client
role predicates as a UX-affordance layer only. Enforcement stays with the
API's role-coverage middleware gate and the server-side route gates. The
module MUST NOT export enforcement-named (`can*`) helpers, MUST NOT absorb
server-computed capability flags (`canRequestReopen`, `canReview`,
`canInlineEdit`), and MUST NOT be imported by `apps/api`.

#### Scenario: server flags pass through untouched

- **WHEN** the API ships a capability flag on a read model
- **THEN** the client consumes the flag as data
- **AND** the predicate module plays no part in computing it

#### Scenario: enforcement stays server-side

- **WHEN** a new role-gated capability is added
- **THEN** its enforcement lands in the API role-coverage gate
- **AND** the client predicates at most hide or show affordances
