## MODIFIED Requirements

### Requirement: Every route has a reviewed behavioral intent

Each catalog route MUST carry at least one reviewed intent with `id`, `given`, `when`, and `then` fields. The catalog intentionally carries no file, line, selector, or test-name links. Route changes are detected by the drift gate; focused deterministic tests own detailed behavior.

#### Scenario: a route without an intent is rejected

- **WHEN** a catalog route has no intent entry or omits a required behavioral field
- **THEN** catalog checking rejects it instead of treating the route as covered

### Requirement: Catalog role tokens are validated against the canonical role set

Every `role:` and `access:` token read from `e2e/catalog/*.yaml` MUST be validated against `lead`, `head`, `admin`, and `viewer`. The shared parser is consumed by catalog checking, the optional human checklist, and acceptance route health; it MUST reject an unrecognized token before navigation.

#### Scenario: an unrecognized role token fails the parse

- **WHEN** a catalog role or access list contains a token outside the canonical set
- **THEN** the parser names and rejects the token
- **AND** catalog checking, the checklist, and route health all surface the failure

## ADDED Requirements

### Requirement: Execution is route health plus one bounded smoke lifecycle

The catalog MUST drive four-role route health for every reachable catalog route. The blocking browser contour MUST add only one representative cross-role lifecycle; other product intents remain in focused tests or optional human review. No BDD runner or exhaustive interaction compiler may be introduced.

#### Scenario: A role-reachable route is checked

- **WHEN** `pnpm test:uat` or combined acceptance runs route health
- **THEN** every role catalog route is visited with deterministic identifiers
- **AND** HTTP, console, page, network, and axe anomalies are recorded before verdict

## REMOVED Requirements

### Requirement: Execution is route sweep plus within-route Driver exploration

**Reason**: The mandatory Driver and its exhaustive within-route exploration were retired.

**Migration**: Use catalog-driven route health, one lifecycle smoke, and focused deterministic tests.
