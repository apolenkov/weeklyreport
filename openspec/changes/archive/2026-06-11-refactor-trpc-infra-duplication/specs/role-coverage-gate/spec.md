## ADDED Requirements

### Requirement: Gate allow-list enumerates all eight canonical builders

The gate allow-list MUST enumerate exactly the 8 canonical builders
named in this spec's Purpose — `ALLOWED_CHAINS` in
`apps/api/src/infrastructure/trpc/__tests__/role-coverage.test.ts` —
including `leadershipProcedure`, which is absent from the allow-list
today while being a canonical export. Documentation that states the
builder count (`openspec/config.yaml` conventions) MUST say 8, not 7.

#### Scenario: a router uses leadershipProcedure

- **WHEN** a `*.router.ts` file defines a procedure with
  `leadershipProcedure`
- **THEN** the role-coverage gate reports the procedure as compliant
  and CI passes

#### Scenario: a ninth builder is exported

- **WHEN** `trpc.middleware.ts` exports a new procedure builder
- **THEN** the same change MUST add its chain to `ALLOWED_CHAINS` and
  update the documented builder count — a review-time rule, not a gate
  guarantee: today's gate only prefix-matches the middleware chains of
  procedures reachable from `appRouter` and cannot detect an unlisted
  builder export on its own (rewriting the matching semantics is the
  follow-up recorded in this change's `tasks.md` 3.1)

### Requirement: The canonical middleware chain has a single definition site

The shared middleware chain MUST have exactly one definition site:
the chain (metrics → logging → auth/role → pdf-export guard →
mutation audit) lives in a local `buildProtectedProcedure(authMiddleware)`
factory inside `apps/api/src/infrastructure/trpc/trpc.middleware.ts`,
and the protected canonical builders MUST be created through it. The 8
exported builder references MUST remain identity-stable across this
consolidation so the reference-identity gate keeps passing.

#### Scenario: a new middleware joins the canonical chain

- **WHEN** a maintainer adds a middleware to the canonical chain
- **THEN** exactly one definition site changes
- **AND** all protected canonical builders pick it up without editing
  each builder

#### Scenario: builders stay identity-stable through the consolidation

- **WHEN** the consolidation lands
- **THEN** the role-coverage gate's reference-identity check passes
  with zero changes to router files
