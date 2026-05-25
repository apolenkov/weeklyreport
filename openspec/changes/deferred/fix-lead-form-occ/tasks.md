# Tasks

- [ ] T1: Refactor OCC check in `lead-form.prisma-repository.ts:287` — use
      composite key (draftSectionId, version) instead of version alone
- [ ] T2: Update DELETE handler — on version mismatch, return 410 Gone with
      explanation instead of 409 Conflict
- [ ] T3: Update POST (create/recreate) handler — check if a section with the
      same ID exists with a newer version; reject if true
- [ ] T4: Add event audit log — track wipe/recreate cycles with timestamps and
      user IDs
- [ ] T5: Add integration tests covering concurrent DELETE/POST race scenarios
      (use Promise.all to simulate concurrent requests)
- [ ] T6: Update lead-form hook to handle 410 Gone and display user-friendly
      error message
- [ ] T7: Commit — `fix(lead-form): strengthen OCC for concurrent wipe/recreate`
- [ ] T-V: Verification — `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass;
      concurrency tests exercise race conditions
