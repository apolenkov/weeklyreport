# Tasks

- [ ] T1: Add tRPC mutation — create `revoke-all-sections` mutation in
      `apps/api/src/routers/report.router.ts` that revokes all submitted
      sections for a given period
- [ ] T2: Add permission guard — ensure only head role can call the mutation;
      link role-coverage-gate spec
- [ ] T3: Add dashboard button — add "Revoke All" button to head dashboard
      (period view or top action bar); style with warning color
- [ ] T4: Add confirmation dialog — show modal asking for confirmation before
      executing bulk revoke; include count of sections to be revoked
- [ ] T5: Test revoke-all flow — submit 3+ sections, click Revoke All, confirm
      dialog, verify all sections revert to Draft
- [ ] T-V: Verification — `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass;
      manual bulk revoke test
