# Tasks

- [ ] T1: Create `apps/api/src/lib/holidays.ts` with HOLIDAYS_2026 const (list
      of Date objects for company holidays)
- [ ] T2: Update `computeDeadline()` signature to accept optional `holidays`
      parameter
- [ ] T3: Refactor business-day loop in `computeDeadline()` to skip holiday
      dates in addition to weekends
- [ ] T4: Update `report-shell.service.ts` or deadline-calculation consumers to
      pass holidays when computing deadlines
- [ ] T5: Add test cases covering business-day calculation with holidays
      (e.g., deadline 5 business days away landing on a Monday after holiday
      Thursday)
- [ ] T6: Commit — `feat(business-date): add holidays support to deadline
  calculation`
- [ ] T-V: Verification — `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass;
      business-date tests include holiday edge cases
