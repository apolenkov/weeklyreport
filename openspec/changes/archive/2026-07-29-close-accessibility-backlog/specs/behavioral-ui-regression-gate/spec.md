## RENAMED Requirements

- FROM: `### Requirement: Per-role sweep produces a non-blocking report`
- TO: `### Requirement: Per-role sweep produces a blocking accessibility verdict`

## MODIFIED Requirements

### Requirement: Per-role sweep produces a blocking accessibility verdict

The Driver SHALL run per role (`lead`, `head`, `admin`, `viewer`) via
`/auth/dev-login` and report anomalies per role: console errors (favicon 404
ignored), broken DOM/flow against the expected outcome, layout issues, and the
result of an `@axe-core/playwright` audit. The sweep MUST write and attach every
role report before applying its verdict. Any reported anomaly MUST fail that
role's test; an axe violation MUST therefore block completion.

#### Scenario: Report names the anomaly with its context

- **WHEN** a role sweep finds a console `error`, a broken flow, or an axe
  violation
- **THEN** the report names the role, route, rule, and offending target
- **AND** the role test fails after the report is written

#### Scenario: Within-route exhaustiveness is the Driver's run-time job

- **WHEN** the Driver runs a role's scenario on a route
- **THEN** it enumerates that route's interactive elements and reachable
  transitions at run time
- **AND** reports per element, so coverage stays measured rather than frozen in
  the catalog

#### Scenario: A boot/load failure is surfaced loudly

- **WHEN** a route fails to load or the app fails to boot
- **THEN** the sweep records the failed route and console evidence
- **AND** the role test fails after preserving the report

#### Scenario: Blocking verdict supersedes phase-1 reporting

- **WHEN** this accessibility closeout supersedes the former phase-1
  report-only behavior
- **THEN** console, load, network, page, and axe anomalies block the UAT command
- **AND** the deferred exhaustive frozen behavior suite remains a separate
  phase-2 concern

#### Scenario: A clean role passes

- **WHEN** every catalog route for a role loads with no console, network, load,
  page, or axe anomaly
- **THEN** its report records zero anomalies
- **AND** the role test passes

### Requirement: Deterministic frozen gate deferred to phase 2

Freezing every behavioral scenario into deterministic Playwright specs as a
blocking gate SHALL remain deferred until the product stabilizes. The
entry-point UAT sweep MAY block on console, load, network, page, and axe
anomalies without becoming an exhaustive frozen behavior suite. Future frozen
scenarios SHALL cover only critical, stabilized paths.

#### Scenario: Accessibility blocking does not freeze the full catalog

- **WHEN** the entry-point sweep blocks on an axe violation
- **THEN** no exhaustive per-element expected-outcome specification is added
- **AND** formal scenario freezing remains deferred to phase 2

#### Scenario: No exhaustive compiled gate is added now

- **WHEN** this closeout adds a blocking verdict to the existing entry-point
  UAT sweep
- **THEN** it does not add an exhaustive compiled per-element behavior gate
- **AND** the phase-2 frozen critical-journey gate remains deferred
