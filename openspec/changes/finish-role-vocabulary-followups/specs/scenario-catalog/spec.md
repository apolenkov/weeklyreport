## ADDED Requirements

### Requirement: Catalog role tokens are validated against the canonical role set

Every `role:` and `access:` token read from `e2e/catalog/*.yaml` MUST be
validated against the canonical four-role set (`lead`, `head`, `admin`,
`viewer`) before use. Both catalog parsers (`e2e/sweep/catalog-parser.mjs`,
shared by the drift gate and the human checklist renderer, and
`e2e/sweep/catalog-sweep.spec.ts`'s own reader) MUST throw immediately when
an unrecognized token appears, rather than passing it through as an unchecked
string.

#### Scenario: an unrecognized role token fails the parse

- **WHEN** a catalog YAML file's `role:` line or an `access: [...]` list
  contains a token outside the canonical four-role set (a typo or a retired
  role)
- **THEN** the parser throws immediately, naming the bad token and its
  location
- **AND** both the CI-blocking drift gate (`catalog-check.mjs`) and the
  human checklist renderer (`render-checklist.mjs`) surface the failure
  instead of silently treating the row as having no role or an empty access
  list

## MODIFIED Requirements

### Requirement: The catalog is documentation, not a new test runner

The catalog MUST be stored as `.yaml` catalog documents under `e2e/catalog/`,
one per module. Automation MUST grow the existing native `@playwright/test`
and Vitest suites; a BDD runner MUST NOT be introduced, to avoid a second
competing test framework in the repo.

#### Scenario: automation reuses the existing harness

- **WHEN** a catalog scenario is automated
- **THEN** the resulting test is added to the existing `e2e/` Playwright suite or
  a Vitest suite
- **AND** no BDD-runner dependency is added to the workspace
