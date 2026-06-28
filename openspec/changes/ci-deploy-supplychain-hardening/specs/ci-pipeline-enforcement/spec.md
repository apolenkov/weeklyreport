## ADDED Requirements

### Requirement: CI workflow references only scripts that exist

The CI workflow SHALL invoke only `package.json` scripts that are actually
defined, so a provisioned runner cannot fail a job on a typo. Specifically, the
E2E job's seed step MUST stop calling the non-existent `pnpm db:seed:simple` and
MUST call the deterministic-fixture script that exists — `pnpm db:seed:middle`
(which runs `prisma/seed-simple.ts`).

#### Scenario: The CI seed step calls a defined script

- **GIVEN** `.github/workflows/ci.yml` after this change
- **WHEN** the E2E job's "Seed database" step is inspected
- **THEN** it runs `pnpm db:seed:middle` (or another script present in
  `package.json`), and the string `db:seed:simple` does not appear anywhere in
  the workflow

#### Scenario: Every CI script reference resolves

- **GIVEN** every `run: pnpm <script>` step in `.github/workflows/ci.yml`
- **WHEN** each referenced `db:*` / `lint` / `typecheck` / `test` / `build`
  script is matched against the root `package.json` `scripts` block
- **THEN** each referenced script is defined, with no dangling reference

### Requirement: Pre-push hook mirrors the cheap deterministic CI jobs

The local `.husky/pre-push` hook SHALL run a TypeScript typecheck and the
full-repo lint/format checks in addition to the existing catalog-drift gate and
unit tests, so a type- or lint-broken tree is caught before it leaves the
machine while CI remains dormant. The hook MUST add `pnpm turbo typecheck`,
`pnpm lint`, and `pnpm format:check` ahead of the existing `pnpm catalog:check`
and `pnpm test` steps, and MUST preserve the existing `CI=true` / `SKIP_PREPUSH=1`
skip escape hatches.

#### Scenario: A type error is caught at pre-push

- **GIVEN** a working tree containing a TypeScript type error
- **WHEN** the contributor runs `git push` locally (with `CI` unset and
  `SKIP_PREPUSH` unset)
- **THEN** the pre-push hook runs `pnpm turbo typecheck`, the typecheck exits
  non-zero, and the push is aborted before the network step

#### Scenario: Skip escape hatches still work

- **GIVEN** the updated `.husky/pre-push`
- **WHEN** `git push` runs with `CI=true` or `SKIP_PREPUSH=1`
- **THEN** the hook prints its skip line and exits 0 without running any gate,
  exactly as before this change

#### Scenario: Existing catalog and test gates still run

- **GIVEN** a clean working tree and the updated `.husky/pre-push`
- **WHEN** `git push` runs locally with no skip flag
- **THEN** `pnpm catalog:check` and `pnpm test` still run after the added
  typecheck/lint/format steps, and a catalog drift or a failing unit test still
  aborts the push

### Requirement: Server-side CI enforcement is restored once a runner exists

The system SHALL make CI an enforced server-side gate once a runner is
provisioned: the `on:` triggers MUST be restored to `push` and `pull_request`
(replacing the `workflow_dispatch`-only stanza), and required status checks MUST
be enabled on `main` so a failing run blocks merge. Until a runner exists, the
workflow comment and the change MUST record that `main` has no enforced
server-side protection and that the local pre-push hook is the only active gate.

#### Scenario: Triggers and required checks are live after a runner is assigned

- **GIVEN** a runner has been provisioned for the repository
- **WHEN** the CI restoration is applied
- **THEN** `.github/workflows/ci.yml` triggers on `push` and `pull_request`,
  required status checks are enabled on `main`, and the dormant
  `workflow_dispatch`-only comment is removed

#### Scenario: A red commit fails an enforced run

- **GIVEN** server-side CI enforcement is live
- **WHEN** a commit that fails lint, typecheck, or tests is pushed to a branch
  with an open PR
- **THEN** the corresponding required check reports failure and the PR cannot be
  merged until it is fixed

#### Scenario: No-runner state is documented, not silently dormant

- **GIVEN** no runner is yet provisioned
- **WHEN** the dormant-CI state is reviewed
- **THEN** the workflow header comment and this change record that the
  server-side gate is inactive and that `.husky/pre-push` is the only enforced
  gate, so the gap is explicit rather than implied by a green-looking workflow
  file
