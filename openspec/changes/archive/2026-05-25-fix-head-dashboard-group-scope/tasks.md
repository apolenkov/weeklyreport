# Tasks

- [x] **GROUP-T1** — Locate the users-list tRPC procedure. Found in
      `apps/api/src/modules/review/review.prisma-repository.ts` —
      `getSubmissionDashboard` queries `reportSection` with head's group scope.
      (Note: no `apps/api/src/modules/users/` module exists; the head-visible
      user list is the submission dashboard rows.)

- [x] **GROUP-T2** — Add group filter for heads. Already done in Phase
      46-02 (UFB-040): `groupScopeFilter(session, "reportSection")` is spread
      into the Prisma `findMany` where-clause in `review.prisma-repository.ts`.
      No code change needed.

- [x] **GROUP-T3** — Added two integration tests to
      `apps/api/src/modules/review/review.integration.test.ts`:

  - "GROUP-T3 / head sees only own-group sections"
  - "GROUP-T3 / admin sees all sections across groups"
    (Note: `users-tab.test.tsx` is admin-only frontend; incorrect target in
    original task.)

- [x] **GROUP-T4** — Manual verification skipped: integration tests GROUP-T3
      cover the group-scope filter at the backend level. `pnpm typecheck` ✓,
      `pnpm lint` ✓, `pnpm test` ✓.
