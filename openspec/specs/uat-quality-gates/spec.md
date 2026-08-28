# uat-quality-gates Specification

## Purpose

Define final acceptance as green local quality gates plus honest four-role browser, console, accessibility, mutation-consumer, and infrastructure evidence.

## Requirements

### Requirement: Final Acceptance Gate MUST Pass As A Bounded Product Chain

The repository MUST pass `pnpm typecheck`, `pnpm lint`, `pnpm test`, an
explicitly configured production `pnpm build`, focused existing E2E suites,
and `pnpm test:acceptance` before WeeklyReport is described as release-ready.
Browser acceptance is limited to route health plus one lifecycle smoke.

#### Scenario: The complete final gate is green

- **WHEN** the final commands run at one exact Git SHA
- **THEN** every command exits zero and the acceptance report records successful
  cleanup

#### Scenario: A final gate command fails

- **WHEN** any required command fails or cleanup is not proven
- **THEN** final acceptance fails

### Requirement: Final acceptance MUST NOT depend on exhaustive runtime campaigns

The final WeeklyReport verdict MUST NOT require an interaction graph, campaign
manifest, continuation chunks, custom supervisor, AI-import verdict, or
multi-hour canary.

#### Scenario: Bounded acceptance is complete

- **WHEN** deterministic gates and `pnpm test:acceptance` pass at one source SHA
- **THEN** browser acceptance is complete without any retired runtime command

### Requirement: All Four Roles MUST Pass UAT With Zero Console Errors

A full UAT sweep across all four roles (lead, head, admin, viewer) MUST
complete with zero browser console errors and no broken UI states before
any production deployment.

#### Scenario: Lead role UAT sweep

- **WHEN** a UAT sweep runs with the lead role via Playwright
- **THEN** all lead-facing pages load without console errors
- **AND** report form, stage chips, version history, and slides mode all render correctly

#### Scenario: Head role UAT sweep

- **WHEN** a UAT sweep runs with the head role via Playwright
- **THEN** all head-facing pages load without console errors
- **AND** dashboard, composite status, and publication flow render correctly

#### Scenario: Admin role UAT sweep

- **WHEN** a UAT sweep runs with the admin role via Playwright
- **THEN** all admin-facing pages load without console errors

#### Scenario: Viewer role UAT sweep

- **WHEN** a UAT sweep runs with the viewer role via Playwright
- **THEN** published reports render correctly in read-only mode

### Requirement: Code Quality Gates MUST Pass Before Deployment

All code-quality gates MUST pass (ESLint, Prettier, TypeScript strict,
full test suite) on the deployment branch before any release.

#### Scenario: Pre-deployment gate check

- **WHEN** the deployment pipeline runs pre-deployment checks
- **THEN** `pnpm typecheck`, `pnpm lint`, and `pnpm test` all exit 0
- **AND** no new ESLint warnings are introduced

### Requirement: Integration Test Global Setup MUST Resolve The Repo Root Robustly

The integration test suite's `globalSetup` MUST derive the repository root by
walking up from its own file location to the nearest ancestor directory that
contains `package.json`, rather than a hardcoded directory-depth literal
(e.g. a fixed count of `..` segments). If no such ancestor exists, setup MUST
throw a descriptive error instead of silently continuing with an
out-of-workspace path.

#### Scenario: Repo root resolves correctly from the current suite location

- **WHEN** `globalSetup` runs from `e2e/integration/global-setup.ts`
- **THEN** the resolved repo root is the directory containing the top-level
  `package.json`
- **AND** `execSync("pnpm exec prisma migrate reset --force", { cwd: repoRoot, ... })`
  runs inside the pnpm workspace instead of throwing

#### Scenario: A future relocation of the e2e suite does not silently break setup

- **WHEN** the e2e suite directory is moved to a different depth relative to
  the repo root
- **THEN** the walk-up resolution still finds the correct repo root without
  any code change to a hardcoded depth constant

#### Scenario: No ancestor package.json is found

- **WHEN** `globalSetup` walks up from its file location and finds no
  ancestor directory containing `package.json`
- **THEN** `globalSetup` throws a descriptive error identifying the starting
  directory
- **AND** it does NOT fall back to a guessed or out-of-workspace path

### Requirement: The mutation-consumer audit MUST report the size of the set it examined

`apps/web/uat-suite/mutation-audit.mjs` runs in `--check` mode as a blocking
gate. It MUST print the count of procedures it extracted alongside its verdict,
and it MUST exit non-zero when that count is zero. A gate whose parser silently
matches nothing reports success on an empty set, and every defect behind it
stays invisible for as long as the parser stays broken.

Procedure extraction MUST be performed over the TypeScript syntax tree, not by
counting braces or matching a router literal by regular expression. The router
surface is assembled from factory functions, and a text scan tuned to one
authoring shape stops matching the moment that shape changes — without
reporting anything.

The audit MUST NOT shell out to a tool it does not declare as a dependency. It
reads the web sources it needs itself.

#### Scenario: The extractor matches nothing

- **WHEN** `pnpm uat:audit --check` runs and procedure extraction yields zero
  procedures
- **THEN** the gate exits non-zero and names the empty extraction as the reason,
  rather than reporting that every mutation passed

#### Scenario: The router is re-authored into a different shape

- **WHEN** the tRPC router is split, merged, or otherwise re-authored so that no
  namespace is declared as an object literal
- **THEN** the audit still extracts every procedure, because it walks the syntax
  tree rather than matching source text

### Requirement: A mutation counts as read back only on evidence, never on resemblance

The audit MUST classify each mutation as VERIFIED, PARTIAL, UNRESOLVED or BLACK
HOLE. VERIFIED requires that EVERY call site's success path reaches a cache
invalidation naming a real query, or a full-page navigation. The presence of a
similarly-named sibling query is NOT evidence and MUST NOT be consulted.

The three non-verified verdicts MUST stay distinct, because they call for
different actions: PARTIAL means the success path was followed end to end and
runs no read-back — a definite gap. UNRESOLVED means the success path left what
static analysis can see — a place the audit declines to guess. BLACK HOLE means
no web caller exists at all.

A mutation with no consumer MUST fail the gate unless it carries a written
justification in `apps/web/uat-suite/mutation-audit.allowlist.json`. The
allowlist is for deliberate tombstones and retentions; it is not a place to
park work.

#### Scenario: One call site cannot be followed

- **WHEN** a mutation has several call sites and the audit cannot follow the
  success path of one of them
- **THEN** the verdict for that mutation is UNRESOLVED, not VERIFIED — a clean
  success path elsewhere says nothing about the one that was never read

#### Scenario: A new unconsumed mutation appears

- **WHEN** a write procedure is added to the API with no web caller and no
  allowlist entry
- **THEN** `pnpm uat:audit --check` exits non-zero and names the procedure

### Requirement: The audit MUST NOT write to the tree in gate mode

`--check` evaluates and sets an exit code only. It MUST NOT refresh the report
markdown or any other tracked file. A gate that rewrites tracked output dirties
every push it runs on and races parallel sessions; report refreshes stay an
explicit, deliberate run.

#### Scenario: The gate runs on a clean tree

- **WHEN** `pnpm uat:audit --check` runs with no local modifications
- **THEN** the working tree is unchanged afterwards, whatever the verdict

### Requirement: Browser business assertions MUST survive unrelated seed growth

An integration test that verifies a business transition MUST derive its
precondition from the canonical seed manifest or the live seeded database and
assert the transition relative to that precondition. It MUST NOT encode an
absolute count whose value changes when an unrelated user, product, or report
fixture is added.

#### Scenario: An unrelated full-profile entity is added

- **WHEN** the canonical `full` seed adds a product, user, or section outside a
  journey's business subject
- **THEN** the journey continues to pass without updating an unrelated absolute
  count
- **AND** the transition's exact before/after delta remains asserted

#### Scenario: A mutation changes one submission

- **WHEN** a revoke or submit journey changes exactly one report section
- **THEN** the test reads the relevant count before the action
- **AND** asserts that the count changes by exactly one in the required direction

### Requirement: Confirmation dialogs MUST be located by their accessibility contract

Browser acceptance tests MUST locate a confirmation surface by its semantic
role and accessible name. The report submission confirmation SHALL expose role
`alertdialog` with accessible name `Confirm submission`.

#### Scenario: A lead initiates report submission

- **WHEN** the lead activates the `Submit` action
- **THEN** an `alertdialog` named `Confirm submission` is visible
- **AND** its scoped `Submit` action completes the mutation

### Requirement: Acceptance evidence MUST distinguish infrastructure rejection

Server-side acceptance evidence MUST state whether a job received a runner and
executed test steps. A workflow rejected before runner allocation MUST NOT be
reported as a repository test pass or test failure.

#### Scenario: GitHub rejects a job before assigning a runner

- **WHEN** the job has no runner and no executed steps
- **THEN** the acceptance record classifies it as an infrastructure allocation
  blocker
- **AND** preserves GitHub's exact annotation separately from local test results

### Requirement: Four-role UAT MUST contain zero axe violations

The React routes reachable by `admin`, `head`, `lead`, and `viewer` in the
`e2e/catalog` inventory MUST produce zero `@axe-core/playwright` violations
during `pnpm test:uat`. The gate MUST scan the rendered DOM after hydration and
MUST NOT disable an axe rule, exclude an offending selector, or convert a
violation into a passing allowlist entry.

#### Scenario: All role routes are accessible

- **WHEN** `pnpm test:uat` visits every catalog route for all four roles
- **THEN** every role report records zero axe violations
- **AND** the command exits zero

#### Scenario: A route contains an accessibility violation

- **WHEN** axe reports any violation on a rendered role route
- **THEN** the report identifies the role, route, rule, and offending target
- **AND** the command exits non-zero

### Requirement: The axe gate MUST prove that it examines a real defect

The UAT test surface MUST contain a planted browser probe that renders a known
accessibility defect and asserts that the installed axe scanner detects its
specific rule. The probe MUST fail if the scanner returns an empty result or if
the required rule is disabled.

#### Scenario: Planted low contrast is detected

- **WHEN** the proof page renders text whose foreground and background do not
  meet the minimum contrast ratio
- **THEN** the installed axe scanner reports `color-contrast`
- **AND** the proof test passes only because the violation was detected
