## MODIFIED Requirements

### Requirement: Execution is route sweep plus bounded critical journeys

The catalog MUST drive the Playwright role sweep for every catalog route. The sweep records navigation/load, page-error, console-error, network, and axe anomalies and writes per-role reports. Reviewed, stabilized product intents that represent critical lead, head, admin, or viewer outcomes MUST be covered by the bounded deterministic acceptance contour; non-critical intents remain available as a human or advisory-driver checklist. This capability MUST NOT create a BDD runner, exhaustive interaction compiler, or backend-only route tier.

#### Scenario: A role-reachable route is swept

- **WHEN** `pnpm test:uat` or the full acceptance command runs the catalog sweep
- **THEN** each role catalog is loaded and each route is visited with dynamic identifiers resolved from deterministic seed contracts
- **AND** the role report records every load, console, page-error, network, and axe anomaly before the outcome is asserted

#### Scenario: A critical catalog intent stabilizes

- **WHEN** a reviewed catalog intent is selected as a release-critical product journey
- **THEN** a deterministic Playwright acceptance scenario asserts its machine-checkable outcome
- **AND** the catalog remains the route/intent source instead of being compiled into a second test framework
