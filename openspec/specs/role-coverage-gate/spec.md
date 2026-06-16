## Purpose

Every tRPC procedure in CustomReport MUST be constructed through one of 8 canonical
middleware-chain builders that live in `apps/api/src/infrastructure/trpc/`. The CI
role-coverage gate verifies this by reference identity — not structural equality —
so that copying a builder's body into a local helper still counts as a violation.
A PR that adds a non-compliant procedure MUST fail CI before the branch can be merged.

The 9 canonical builders are: `publicProcedure`, `protectedProcedure`,
`headProcedure`, `leadProcedure`, `viewerProcedure`, `anyRoleProcedure`,
`adminProcedure`, `leadershipProcedure`, and `leadHeadAdminProcedure`. All
are exported from `apps/api/src/infrastructure/trpc/trpc.middleware.ts`.

Consumer surfaces: `apps/api/src/infrastructure/trpc/` (canonical builders),
all `*.router.ts` files under `apps/api/src/` (targets), and the CI workflow
file under `.github/workflows/` (enforcement point).

## Requirements

### Requirement: Procedures Must Use Canonical Builders

Every tRPC procedure defined in `apps/api/src/**/*.router.ts` MUST be constructed
using one of the 8 canonical middleware-chain builders exported from
`apps/api/src/infrastructure/trpc/`. Procedures that do not reference a canonical
builder MUST be rejected by the CI gate.

#### Scenario: Procedure imports a canonical builder

- **WHEN** a `*.router.ts` file defines a procedure using `publicProcedure`, `leadProcedure`, or another canonical builder imported from `apps/api/src/infrastructure/trpc/`
- **THEN** the role-coverage gate reports the procedure as compliant and CI passes

#### Scenario: Procedure defines its own middleware chain inline

- **WHEN** a `*.router.ts` file defines a procedure by calling `t.procedure.use(myLocalMiddleware)` without going through a canonical builder
- **THEN** the role-coverage gate reports a violation citing `role-coverage-gate` and CI fails with a non-zero exit code

### Requirement: Gate Compares Builders by Reference Identity

The CI gate MUST verify that a procedure's builder is the same object reference
as one of the 9 canonical builders. A developer who copies a canonical builder's
middleware chain into a new local helper and uses that helper MUST still fail the
gate.

#### Scenario: Local helper replicates canonical builder body

- **WHEN** a `*.router.ts` file constructs a procedure via a local `const myProcedure = t.procedure.use(authMiddleware)` whose middleware chain is byte-for-byte identical to a canonical builder, but is a distinct object
- **THEN** the gate treats it as a non-canonical builder and CI fails citing `role-coverage-gate`

#### Scenario: Re-exported canonical builder passes identity check

- **WHEN** a module re-exports a canonical builder under an alias (`export { leadProcedure as authedProcedure }`) and a router imports that alias
- **THEN** the gate resolves the alias to the original canonical reference, confirms identity, and CI passes

### Requirement: Gate Allow-List Enumerates All Nine Canonical Builders

The gate allow-list MUST enumerate exactly the 9 canonical builders named in
this spec's Purpose: `publicProcedure`, `protectedProcedure`, `headProcedure`,
`leadProcedure`, `viewerProcedure`, `anyRoleProcedure`, `adminProcedure`,
`leadershipProcedure`, and `leadHeadAdminProcedure`. The allow-list lives in
`ALLOWED_CHAINS` in
`apps/api/src/infrastructure/trpc/__tests__/role-coverage.test.ts`.
Documentation that states the builder count (e.g. `openspec/config.yaml`
conventions) MUST say 9, not 8.

driver-findings-2026-06-11 finding 3 (decision 2026-06-13) widened the
`pdfExport.request` / `pdfExport.status` procedures from `headProcedure` to a
new `leadHeadAdminProcedure` (`["lead","head","admin"]`) so leads can export a
PDF. Viewer is deliberately excluded (the read-only role keeps the `/print`
link), so `anyRoleProcedure` — which also admits viewer — could not be reused;
a distinct builder was required. The new builder is registered in
`ALLOWED_CHAINS` and pinned by the chain-composition test so the
reference-identity gate keeps passing.

#### Scenario: A router uses leadershipProcedure

- **WHEN** a `*.router.ts` file defines a procedure with `leadershipProcedure`
- **THEN** the role-coverage gate reports the procedure as compliant and CI passes

#### Scenario: A router uses leadHeadAdminProcedure

- **WHEN** a `*.router.ts` file defines a procedure with `leadHeadAdminProcedure`
  (e.g. `pdfExport.request` / `pdfExport.status`)
- **THEN** the role-coverage gate reports the procedure as compliant and CI passes

#### Scenario: A tenth builder is exported

- **WHEN** `trpc.middleware.ts` exports a new procedure builder
- **THEN** the same change MUST add its chain to `ALLOWED_CHAINS` and update
  the documented builder count — a review-time rule, not a gate guarantee:
  today's gate only prefix-matches the middleware chains of procedures reachable
  from `appRouter` and cannot detect an unlisted builder export on its own
  (rewriting the matching semantics is recorded as a follow-up in the
  `refactor-trpc-infra-duplication` change's `tasks.md` § 3.1)

### Requirement: The Canonical Middleware Chain Has a Single Definition Site

The shared middleware chain MUST have exactly one definition site:
the chain (metrics → logging → auth/role → pdf-export guard → mutation audit)
lives in a local `buildProtectedProcedure(authMiddleware)` factory inside
`apps/api/src/infrastructure/trpc/trpc.middleware.ts`, and the protected
canonical builders MUST be created through it. The 9 exported builder
references MUST remain identity-stable across this consolidation so the
reference-identity gate keeps passing.

#### Scenario: A new middleware joins the canonical chain

- **WHEN** a maintainer adds a middleware to the canonical chain
- **THEN** exactly one definition site changes
- **AND** all protected canonical builders pick it up without editing each
  builder individually

#### Scenario: Builders stay identity-stable through the consolidation

- **WHEN** the consolidation lands
- **THEN** the role-coverage gate's reference-identity check passes with zero
  changes to router files

### Requirement: Gate Runs in CI for Every PR Touching Router Files

The role-coverage gate MUST execute as a required CI job in the GitHub Actions
workflow defined under `.github/workflows/` for every pull request that adds or
modifies at least one `*.router.ts` file. A PR that introduces a non-canonical
procedure MUST be blocked from merging — the violation is surfaced at CI review
time, not at runtime.

#### Scenario: PR adds a new router file with a canonical procedure

- **WHEN** a pull request creates a new `*.router.ts` file whose procedures all use canonical builders
- **THEN** the role-coverage gate CI job passes and does not block the PR

#### Scenario: PR adds a router file with a non-canonical procedure

- **WHEN** a pull request creates or modifies a `*.router.ts` file that contains at least one procedure not using a canonical builder
- **THEN** the role-coverage gate CI job fails, the PR is marked as failing required checks, and merge is blocked until the violation is corrected
