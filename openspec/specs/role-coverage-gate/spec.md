## Purpose

Every tRPC procedure in CustomReport MUST be constructed through one of 7 canonical
middleware-chain builders that live in `apps/api/src/infrastructure/trpc/`. The CI
role-coverage gate verifies this by reference identity — not structural equality —
so that copying a builder's body into a local helper still counts as a violation.
A PR that adds a non-compliant procedure MUST fail CI before the branch can be merged.

The 7 canonical builders are: `publicProcedure`, `protectedProcedure`,
`headProcedure`, `leadProcedure`, `anyRoleProcedure`, `adminProcedure`, and
`leadershipProcedure`. All are exported from
`apps/api/src/infrastructure/trpc/trpc.middleware.ts`.

Consumer surfaces: `apps/api/src/infrastructure/trpc/` (canonical builders),
all `*.router.ts` files under `apps/api/src/` (targets), and the GitLab
`quality` job in `.gitlab-ci.yml` (enforcement point).

## Requirements

### Requirement: Procedures Must Use Canonical Builders

Every tRPC procedure defined in `apps/api/src/**/*.router.ts` MUST be constructed
using one of the 7 canonical middleware-chain builders exported from
`apps/api/src/infrastructure/trpc/`. Procedures that do not reference a canonical
builder MUST be rejected by the CI gate.

#### Scenario: Procedure imports a canonical builder

- **WHEN** a `*.router.ts` file defines a procedure using `publicProcedure`, `protectedProcedure`, or another canonical builder imported from `apps/api/src/infrastructure/trpc/`
- **THEN** the role-coverage gate reports the procedure as compliant and CI passes

#### Scenario: Procedure defines its own middleware chain inline

- **WHEN** a `*.router.ts` file defines a procedure by calling `t.procedure.use(myLocalMiddleware)` without going through a canonical builder
- **THEN** the role-coverage gate reports a violation citing `role-coverage-gate` and CI fails with a non-zero exit code

### Requirement: Gate Compares Builders by Reference Identity

The CI gate MUST verify that a procedure's builder is the same object reference
as one of the 7 canonical builders. A developer who copies a canonical builder's
middleware chain into a new local helper and uses that helper MUST still fail the
gate.

#### Scenario: Local helper replicates canonical builder body

- **WHEN** a `*.router.ts` file constructs a procedure via a local `const myProcedure = t.procedure.use(authMiddleware)` whose middleware chain is byte-for-byte identical to a canonical builder, but is a distinct object
- **THEN** the gate treats it as a non-canonical builder and CI fails citing `role-coverage-gate`

#### Scenario: Re-exported canonical builder passes identity check

- **WHEN** a module re-exports a canonical builder under an alias and a router imports that alias
- **THEN** the gate resolves the alias to the original canonical reference, confirms identity, and CI passes

### Requirement: Gate Allow-List Enumerates All Seven Canonical Builders

The gate allow-list MUST enumerate exactly the 7 canonical builders named in
this spec's Purpose: `publicProcedure`, `protectedProcedure`, `headProcedure`,
`leadProcedure`, `anyRoleProcedure`, `adminProcedure`, and `leadershipProcedure`.
The allow-list lives in `ALLOWED_CHAINS` in
`apps/api/src/infrastructure/trpc/__tests__/role-coverage.test.ts`.
Documentation that states the builder count (e.g. `openspec/config.yaml`
conventions) MUST say 7 and include `leadProcedure`.

The current authorization contract requires the `pdfExport.request` /
`pdfExport.status` procedures to `leadershipProcedure`
(`["head","admin","viewer"]`): head, admin, and viewer may export a PDF and the
lead is EXCLUDED (FORBIDDEN) — the lead surface does not show an Export button.

#### Scenario: A router uses leadershipProcedure

- **WHEN** a `*.router.ts` file defines a procedure with `leadershipProcedure`
- **THEN** the role-coverage gate reports the procedure as compliant and CI passes

#### Scenario: An eighth builder is exported

- **WHEN** `trpc.middleware.ts` exports a new procedure builder
- **THEN** the same change MUST add its chain to `ALLOWED_CHAINS` and update
  the documented builder count
- **AND** review MUST enforce that update because the gate inspects procedures
  reachable from `appRouter`, not unused exports

### Requirement: The Canonical Middleware Chain Has a Single Definition Site

The shared middleware chain MUST have exactly one definition site:
the chain (metrics → logging → auth/role → pdf-export guard → mutation audit)
lives in a local `buildProtectedProcedure(authMiddleware)` factory inside
`apps/api/src/infrastructure/trpc/trpc.middleware.ts`, and the protected
canonical builders MUST be created through it. The 7 exported builder
references MUST remain identity-stable so the
reference-identity gate keeps passing.

#### Scenario: A new middleware joins the canonical chain

- **WHEN** a maintainer adds a middleware to the canonical chain
- **THEN** exactly one definition site changes
- **AND** all protected canonical builders pick it up without editing each
  builder individually

#### Scenario: Builders remain identity-stable

- **WHEN** the application composes the canonical builders
- **THEN** the role-coverage gate's reference-identity check passes with zero
  changes to router files

### Requirement: Gate Runs in CI for Every PR Touching Router Files

The role-coverage gate MUST execute in the GitLab `quality` job (`pnpm test`) on every pipeline, including merge requests that add or modify at least one `*.router.ts` file. A merge request that introduces a non-canonical procedure MUST be blocked from merging — the violation is surfaced at CI review time, not at runtime.

#### Scenario: PR adds a new router file with a canonical procedure

- **WHEN** a merge request creates a new `*.router.ts` file whose procedures all use canonical builders
- **THEN** the role-coverage gate passes and does not block the merge request

#### Scenario: PR adds a router file with a non-canonical procedure

- **WHEN** a merge request creates or modifies a `*.router.ts` file that contains at least one procedure not using a canonical builder
- **THEN** the role-coverage gate fails, the pipeline is marked as failing, and merge is blocked until the violation is corrected

### Requirement: Middleware-chain matching MUST be exact, not prefix

The role-coverage gate SHALL classify a procedure's middleware chain as
allowed only when it begins with one canonical chain from `ALLOWED_CHAINS`
matched slot-by-slot by reference identity, AND everything after that base
is tRPC's own per-procedure plumbing (`inputValidatorMiddleware` /
`outputValidatorMiddleware` / `resolveMiddleware`, recognised by name —
fresh closures per procedure cannot be reference-compared). A shorter
canonical chain that happens to be a prefix of a longer one SHALL NOT cause a
longer, differently-role-gated chain to be classified as allowed, because
a non-plumbing tail disqualifies the match.

#### Scenario: Hand-rolled chain reusing the shared metrics+logging prefix is rejected

- WHEN a procedure is built as
  `t.procedure.use(metricsMiddleware).use(loggingMiddleware).use(<a role
middleware not equal by reference to any of the 7 canonical role
middlewares>)`
- THEN `findUncoveredProcedures` includes that procedure's path in the
  offending list

#### Scenario: A procedure built on a canonical base still passes

- WHEN a procedure's middleware chain equals one of the 7 canonical chains
  (`publicProcedure`, `protectedProcedure`, `headProcedure`,
  `leadProcedure`, `adminProcedure`, `anyRoleProcedure`,
  `leadershipProcedure`) at exact length with every
  middleware equal by reference
- THEN `findUncoveredProcedures` does not include that procedure's path in
  the offending list

#### Scenario: A shorter canonical chain does not falsely match a longer chain

- WHEN a procedure's middleware chain is strictly longer than a canonical
  public chain and its first two entries equal that chain by reference, but no
  full-length canonical chain equals it
- THEN `isProcedureChainAllowed` returns `false` for that chain
