## ADDED Requirements

### Requirement: Canonical behavioral source of truth

UI behavior SHALL be defined in canonical Gherkin `.feature` files anchored to
observable behavior (`role + route + Given/When/Then`), never to a code location
(`file:line`). The `.feature` files are the single source both humans and the
compile Workflow read and edit.

#### Scenario: Scenario anchored to behavior, not code

- **WHEN** a `.feature` scenario is authored for a role/route
- **THEN** it describes only observable behavior (visible DOM, role/aria,
  console state) and contains no `file:line` reference, so it survives a
  refactor that moves the implementing code

#### Scenario: Refactor does not invalidate the scenario

- **WHEN** the component implementing a behavior is moved or renamed but the
  observable behavior is unchanged
- **THEN** the `.feature` scenario remains valid and its compiled spec still
  passes without edits

### Requirement: Deterministic compiled gate

The regression gate SHALL run deterministic Playwright specs compiled from the
`.feature` files. A Haiku fan-out Workflow compiles each scenario into a
`*.spec.ts` once; the gate MUST NOT invoke an LLM at run time. Live agent
interpretation MAY be used only for discovery and for authoring specs, never as
the recurring gate.

#### Scenario: Same code yields same verdict

- **WHEN** the gate runs twice against identical, unchanged code
- **THEN** it produces the identical pass/fail verdict both times (no LLM in the
  run path)

#### Scenario: Compilation is a one-time authoring step

- **WHEN** a new `.feature` scenario is added
- **THEN** the Workflow authors a deterministic `*.spec.ts` for it once, and
  subsequent CI runs execute that spec without any model call

### Requirement: Per-role sweep assertions

The gate SHALL exercise each role (`lead`, `head`, `admin`, `viewer`) via
`/auth/dev-login` and, for every scenario, assert: zero console errors (favicon
404 ignored, warnings logged), presence of the expected DOM by `role`/`aria`,
keyboard-closability of dialogs (Escape and Cancel), and a passing
`@axe-core/playwright` audit on the route.

#### Scenario: A console error fails the gate

- **WHEN** a role sweep loads a route that emits a console `error`
- **THEN** that scenario fails and names the route, role, and the error text

#### Scenario: Dialog must be keyboard-closable

- **WHEN** a scenario opens a dialog and presses Escape
- **THEN** the dialog is removed from the DOM; if it is not, the scenario fails

#### Scenario: Roles are covered in order

- **WHEN** the suite is built out
- **THEN** `lead` scenarios are authored first, then `head`, `admin`, and
  `viewer`

### Requirement: Test-harness boundary

This change SHALL remove the current UI e2e harness under `e2e/` (browser
sweep config, fixtures, `dev-auth`, page helpers, visual helpers, and the
`test:e2e`/`test:e2e:ui` scripts) to be regenerated from the canonical
`.feature`. It MUST keep the integration suite (`e2e/integration/*`,
`playwright.integration.config.ts`) and all vitest unit tests. The removed
`dev-auth` plumbing SHALL be recovered from git history, not rewritten.

#### Scenario: Integration and unit tests are preserved

- **WHEN** the UI e2e harness is removed
- **THEN** `pnpm test` (vitest unit) and the integration config still run, and
  no unit or integration test file is deleted

#### Scenario: dev-auth is restored from history

- **WHEN** the regenerated sweep needs per-role login
- **THEN** `dev-auth` is restored from git history rather than re-derived from
  scratch

### Requirement: Coverage Catalog stays out of scope

The `file:line` Coverage Catalog and its drift gate SHALL remain deferred under
`establish-scenario-catalog` and MUST NOT be introduced by this change. This
change owns only the behavior-anchored path.

#### Scenario: No file:line coupling is added

- **WHEN** this change is implemented
- **THEN** no scenario, spec, or gate it adds binds to a `file:line` location,
  and the deferred catalog is not reactivated
