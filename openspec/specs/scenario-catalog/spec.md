# scenario-catalog Specification

## Purpose

Maintain a human-reviewed, route-anchored Scenario Catalog for the four roles,
with observable intent outcomes and a CI gate that detects App Router/catalog
drift.

## Requirements

### Requirement: The catalog is anchored to the App Router route surface

The catalog MUST cover the role-reachable Next.js App Router `page.tsx` routes,
with route groups removed and dynamic segments retained as route patterns. The
route/access/intent documents under `e2e/catalog/<role>.yaml` are the durable
behavioral contract; tRPC and REST procedures, BullMQ processors, cron
schedulers, Prisma entities/enums, and codegraph indexes are outside this
route-catalog surface and remain owned by their respective API/domain checks.

#### Scenario: every non-excluded page route is cataloged

- **WHEN** the route catalog is generated or checked
- **THEN** every App Router `page.tsx` route appears in at least one role
  catalog unless it is explicitly listed in `EXCLUDED_ROUTES`
- **AND** an entry-point without a UI route is not invented solely to represent
  a scheduler or backend procedure

#### Scenario: a system route is explicitly excluded

- **WHEN** a page is an export or unauthenticated system surface rather than a
  role navigation intent
- **THEN** it is named in `e2e/sweep/catalog-check.ts` `EXCLUDED_ROUTES` with
  a reason instead of silently disappearing from the route census

### Requirement: Every scenario has a machine-checkable outcome

Every scenario's `Then` MUST assert a concrete, machine-verifiable outcome — a
persisted field value, a returned shape, a visible string, or a console-error
count — never prose such as "it works". A scenario whose `Then` cannot be
mechanically checked MUST NOT be admitted to the catalog.

#### Scenario: a non-assertable outcome is rejected

- **WHEN** a scenario is authored with a `Then` that names no checkable
  condition
- **THEN** it is rejected from the catalog until the `Then` states a concrete
  assertion (field value, returned shape, visible text, or error count)

### Requirement: Every route has a reviewed behavioral intent

Each catalog route MUST carry at least one reviewed intent with `id`, `given`,
`when`, and `then` fields. The catalog intentionally carries no file, line,
selector, or test-name links. Route changes are detected by the drift gate;
focused deterministic tests own detailed behavior.

#### Scenario: a route without an intent is rejected

- **WHEN** a catalog route has no intent entry or omits a required behavioral
  field
- **THEN** catalog checking rejects it instead of treating the route as covered

### Requirement: A drift gate keeps the route catalog honest

The CI-runnable `catalog:check` MUST re-derive the App Router `page.tsx` route
surface and FAIL when a non-excluded code route has no catalog scenario or a
catalog route no longer exists. It MUST also check route hygiene, role
consistency, and agreement with the guarded-role policy. The catalog is a living
route contract, not a snapshot; backend procedure/entity coverage is not inferred
from it.

#### Scenario: a new uncovered page route fails the gate

- **WHEN** a new App Router page route is added without a corresponding catalog
  scenario
- **THEN** `pnpm catalog:check` exits non-zero in CI
- **AND** it names the uncovered route

### Requirement: Execution is route health plus one bounded smoke lifecycle

The catalog MUST drive four-role route health for every reachable catalog route.
The blocking browser contour MUST add only one representative cross-role
lifecycle; other product intents remain in focused tests or optional human
review. No BDD runner or exhaustive interaction compiler may be introduced.

#### Scenario: A role-reachable route is checked

- **WHEN** `pnpm test:uat` or combined acceptance runs route health
- **THEN** every role catalog route is visited with deterministic identifiers
- **AND** HTTP, console, page, network, and axe anomalies are recorded before
  verdict

### Requirement: The catalog is documentation, not a new test runner

The catalog MUST be stored as `.yaml` catalog documents under `e2e/catalog/`,
one per module. Automation MUST grow the existing native `@playwright/test`
and Vitest suites; a BDD runner MUST NOT be introduced, to avoid a second
competing test framework in the repo.

#### Scenario: automation reuses the existing harness

- **WHEN** a catalog scenario is automated
- **THEN** the resulting test is added to the existing `e2e/` Playwright suite
  or a Vitest suite
- **AND** no BDD-runner dependency is added to the workspace

### Requirement: Catalog role tokens are validated against the canonical role set

Every `role:` and `access:` token read from `e2e/catalog/*.yaml` MUST be
validated against `lead`, `head`, `admin`, and `viewer`. The shared parser
is consumed by catalog checking, the optional human checklist, and acceptance
route health; it MUST reject an unrecognized token before navigation.

#### Scenario: an unrecognized role token fails the parse

- **WHEN** a catalog role or access list contains a token outside the canonical
  set
- **THEN** the parser names and rejects the token
- **AND** catalog checking, the checklist, and route health all surface the
  failure

### Requirement: Catalog intent prose cannot invent product or data behavior

Every generated or edited scenario under `e2e/catalog/*.yaml` MUST be reviewed
against the live role route and its durable product, authorization, and data
contracts. A catalog intent MUST NOT invent a control, response field,
persistence field, data-retention obligation, or access boundary that is absent
from both the implemented surface and an accepted OpenSpec change. The catalog
review MUST reject such prose instead of turning it into an implicit product
requirement.

#### Scenario: Generated prose names an unsupported data field

- **WHEN** generated scenario prose asks a route to display or copy a field that
  neither the current route contract nor an accepted OpenSpec change defines
- **THEN** the scenario is rejected or corrected during review
- **AND** the unsupported field is not implemented solely to make the generated
  catalog appear accurate

#### Scenario: The Action Log catalog is reconciled

- **WHEN** `admin-actions-view` describes expandable and copyable event details
- **THEN** it names the whitelisted `admin.actionLog.list` metadata rather than
  a raw mutation, request, or response payload
- **AND** its search and cursor-pagination prose matches the observable
  `/admin` Action Log behavior
