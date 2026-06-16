## MODIFIED Requirements

### Requirement: Gate Allow-List Enumerates All Nine Canonical Builders

The gate allow-list MUST enumerate exactly the 9 canonical builders named in
this spec's Purpose: `publicProcedure`, `protectedProcedure`, `headProcedure`,
`leadProcedure`, `viewerProcedure`, `anyRoleProcedure`, `adminProcedure`,
`leadershipProcedure`, and `leadHeadAdminProcedure`. The allow-list lives in
`ALLOWED_CHAINS` in
`apps/api/src/infrastructure/trpc/__tests__/role-coverage.test.ts`.
Documentation that states the builder count (e.g. `openspec/config.yaml`
conventions) MUST say 9, not 8.

The `pdfExport.request` and `pdfExport.status` procedures MUST use a
head + admin + viewer role chain (`leadershipProcedure`,
`["head","admin","viewer"]`). Lead is EXCLUDED: a lead invoking
`pdfExport.request` or `pdfExport.status` MUST receive FORBIDDEN. This
reverses the earlier decision that widened those procedures to
`leadHeadAdminProcedure` (`["lead","head","admin"]`) — lead PDF export is
now a UI-deferred ComingSoon control with no backend call (see
`deferred-feature-pattern`), so the lead role must not pass the gate.

#### Scenario: A router uses leadershipProcedure

- **WHEN** a `*.router.ts` file defines a procedure with `leadershipProcedure`
- **THEN** the role-coverage gate reports the procedure as compliant and CI passes

#### Scenario: pdfExport procedures use the head+admin+viewer chain

- **WHEN** the `pdfExport.request` and `pdfExport.status` procedures are
  defined
- **THEN** they are constructed with the head + admin + viewer
  `leadershipProcedure` chain
- **AND** the role-coverage gate reports them as compliant and CI passes

#### Scenario: a lead is forbidden from pdfExport

- **WHEN** a lead invokes `pdfExport.request` or `pdfExport.status`
- **THEN** the request is rejected with FORBIDDEN — lead is not in the
  procedure's role chain

#### Scenario: A tenth builder is exported

- **WHEN** `trpc.middleware.ts` exports a new procedure builder
- **THEN** the same change MUST add its chain to `ALLOWED_CHAINS` and update
  the documented builder count — a review-time rule, not a gate guarantee:
  today's gate only prefix-matches the middleware chains of procedures reachable
  from `appRouter` and cannot detect an unlisted builder export on its own
  (rewriting the matching semantics is recorded as a follow-up in the
  `refactor-trpc-infra-duplication` change's `tasks.md` § 3.1)
