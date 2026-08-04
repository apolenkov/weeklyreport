## MODIFIED Requirements

### Requirement: Per-role sweep produces a blocking accessibility verdict

The Driver SHALL run each canonical role (`lead`, `head`, `admin`, `viewer`)
via `/auth/dev-login` within the declared Exhaustive Runtime Sweep matrix and
report anomalies per role, route, deterministic state, and action. The sweep
MUST write the role report and its SHA-bound ledger records before applying a
verdict. It SHALL dynamically enumerate every reachable interactive control
and transition at run time, attach function, accessibility, and visual
evidence, and fail the owning cell for any reported functional, accessibility,
or visual anomaly. A role passes only when all of its declared cells are
terminal and clean; the final campaign gate remains blocking.

#### Scenario: Report names the anomaly with its complete context

- **WHEN** a role sweep finds a console error, broken flow, axe violation, or
  visual mismatch
- **THEN** the report names the source SHA, role, route, state, action, cell id,
  anomaly kind, rule, and offending target
- **AND** the role cell fails after the evidence is written

#### Scenario: Within-route exhaustiveness is measured at run time

- **WHEN** the Driver runs a role's scenario on a route
- **THEN** it inventories every reachable interactive element and transition
  from the live Chromium DOM at 1440x900, including controls revealed after an
  action
- **AND** each inventory entry has an action result and machine-checkable
  function, accessibility, or visual oracle evidence, or an allowed typed
  `not-exercised` disposition

#### Scenario: A boot or load failure is surfaced loudly

- **WHEN** a route fails to load, the app fails to boot, or a required state
  cannot be established
- **THEN** the sweep records the failed cell with console/network/page evidence
  and its source SHA
- **AND** the role test fails after preserving the report and ledger

#### Scenario: Blocking verdict covers all required dimensions

- **WHEN** the exhaustive runtime campaign evaluates a role
- **THEN** console, load, network, page, functional, accessibility, and visual
  anomalies block the affected cell and prevent a clean role verdict
- **AND** the campaign does not add a frozen per-element BDD suite or claim
  coverage for excluded browsers or viewports

#### Scenario: A clean role passes only after all declared cells pass

- **WHEN** every declared cell for a role has terminal `pass` evidence and no
  unresolved or confirmed finding remains
- **THEN** its report records zero anomalies and complete control/transition
  coverage
- **AND** the role test passes while the final campaign gate still requires
  the same condition for every role
