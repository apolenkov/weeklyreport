# uat-quality-gates Specification

## Purpose

Define final acceptance as green local quality gates plus honest four-role browser, console, accessibility, mutation-consumer, and infrastructure evidence.

## Requirements

### Requirement: Final Acceptance Gate MUST Pass As A Four-Command Chain

The repository MUST pass a single final acceptance gate before the
`defer-uat-codequality-vercel-2026-05-26` track is marked done. The gate
consists of four commands that all exit 0:
`pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
The chain MUST include `pnpm build` so the gate matches the production build.
There is no Markdown lint command in the chain: `markdown-format-only` removed
`lint:md`, so Markdown is formatted by Prettier on commit, not gated.

#### Scenario: All four gate commands are green

- **WHEN** a maintainer runs
  `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- **THEN** every command exits 0
- **AND** the chain reports a single green result with no findings

#### Scenario: A single gate command fails

- **WHEN** any one of `typecheck`, `lint`, `test`, or `build` exits
  non-zero
- **THEN** the final acceptance gate is considered failed
- **AND** the responsible earlier-wave change is reopened to fix the cause
- **AND** no fix is patched under the acceptance-only final-gates change

### Requirement: Final Playwright Re-Sweep MUST Show Zero Console Errors Per Role

A final Playwright re-sweep MUST run across all four roles (lead, head, admin,
viewer) and MUST observe zero console ERRORS for each role. Console WARNINGS
MUST be logged for the record but MUST NOT fail the sweep, and the
favicon-404 request MUST be ignored as environmental noise.

#### Scenario: Lead role re-sweep is clean

- **WHEN** a re-sweep runs with the lead role via Playwright over the report
  form, stage chips, and slides mode
- **THEN** the captured console shows 0 ERRORS
- **AND** any WARNINGS are logged but do not fail the sweep

#### Scenario: Head role re-sweep is clean

- **WHEN** a re-sweep runs with the head role via Playwright over the dashboard,
  composite status, and publish/revoke flow
- **THEN** the captured console shows 0 ERRORS

#### Scenario: Admin role re-sweep is clean

- **WHEN** a re-sweep runs with the admin role via Playwright over the admin
  panel (periods, reminders, projects, action log)
- **THEN** the captured console shows 0 ERRORS

#### Scenario: Viewer role re-sweep is clean

- **WHEN** a re-sweep runs with the viewer role via Playwright over the
  published read-only report view
- **THEN** the captured console shows 0 ERRORS

#### Scenario: Favicon 404 is exempt

- **WHEN** a role re-sweep records a 404 for the favicon request
- **THEN** that 404 is ignored and does NOT count as a console ERROR

#### Scenario: A real console error blocks sign-off

- **WHEN** any role's re-sweep records a `console.error`, page error, or
  uncaught exception that is not the exempt favicon 404
- **THEN** the re-sweep fails for that role
- **AND** the track is not marked done until the error is fixed in the
  responsible wave's change

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

### Requirement: Visual Acceptance Reviews the Entire Enumerated Frame Set

A visual acceptance run MUST derive its pre-capture inventory from every
changed or affected presentation, interaction, status variant, responsive
breakpoint boundary, and owner requirement, then enumerate every resulting
page, state, and viewport before capture. Any exclusion MUST be located,
justified, and explicitly accepted by the owner before the run. The run MUST
produce fresh evidence for every enumerated item after the last rendered-source
edit and assign a verdict to every full frame. A narrower behavioral assertion
MAY pass independently, but any visible product defect anywhere in an
enumerated frame MUST block the overall visual acceptance verdict until it is
repaired and recaptured or the owner explicitly accepts the located debt.
Reviewers MUST distinguish a product defect from an evidence-capture defect;
neither type may be silently relabelled as out of scope after it appears in an
enumerated frame.

Two fresh independent read-only reviewers MUST open every enumerated frame at
original resolution without receiving an upstream PASS narrative first. Each
reviewer MUST return separate verdicts for the scoped behavior, the whole
captured surface, and evidence validity. One reviewer, a sample of frames, or
model agreement without the deterministic evidence cannot close the gate.

#### Scenario: Unrelated defect appears in a scoped repair screenshot

- **WHEN** the intended focus behavior passes but the same captured frame
  visibly clips a navigation destination or overflows the document
- **THEN** the focus assertion MAY be recorded as passing
- **AND** the overall visual acceptance verdict remains blocked by the located
  product defect
- **AND** the evidence ledger names the affected frame, severity, owner, next
  action, and recapture required for closure

#### Scenario: Every affected viewport and state receives an independent full-frame verdict

- **WHEN** a responsive navigation change affects compact/wide presentations,
  active and focused states, non-zero operational counts, and the 1024 CSS px
  activation boundary
- **THEN** the inventory includes representative widths plus both sides of the
  boundary, every affected interaction/state, and the maximum-display count
  variant
- **AND** every resulting frame is captured fresh and opened directly by both
  visual reviewers
- **AND** each frame receives an explicit whole-frame inspection trace covering
  layout, clipping, overflow, content reachability, active state, and focus
  presentation
- **AND** a sample or aggregate PASS cannot substitute for a missing per-frame
  verdict

#### Scenario: Convenient pre-enumeration cannot hide an affected state

- **WHEN** a changed navigation has a compact variant, a wide variant,
  operational badges, a disabled destination, and a breakpoint boundary
- **THEN** the inventory is incomplete until all those affected variants and
  boundary states are covered or an owner-approved exclusion names the omitted
  state
- **AND** the run cannot declare visual PASS by preselecting only the direct-URL
  resting frame

#### Scenario: Capture defect does not trigger a product edit

- **WHEN** an image has the wrong dimensions, stale source identity, partial
  compositing, or an invalid file signature
- **THEN** the run classifies it as an evidence defect and recaptures it
- **AND** the product source is not changed solely to compensate for the
  defective evidence artifact
