## MODIFIED Requirements

### Requirement: Gate Allow-List Enumerates All Eight Canonical Builders

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
