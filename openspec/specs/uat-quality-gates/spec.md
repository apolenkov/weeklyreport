# uat-quality-gates Specification

## Purpose

TBD - created by archiving change final-gates-resweep. Update Purpose after archive.

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
