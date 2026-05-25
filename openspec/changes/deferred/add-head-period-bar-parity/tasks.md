# Tasks

- [ ] T1: Audit lead period-bar component — inspect the lead form's period
      navigation (likely in `apps/web/src/components/lead/period-nav-bar.tsx`
      or similar) and document its behavior, styling, and logic
- [ ] T2: Extract as reusable component — if not already generic, refactor the
      period-bar into a shared component in `@customreport/ui`
- [ ] T3: Add period-bar to head dashboard — import and render the component
      on the head report view (top of the page or in the header)
- [ ] T4: Sync context — ensure the period-bar reads the current period from
      the same context/query param as the lead form
- [ ] T5: Test navigation — click previous/next period arrows on head view,
      verify report updates and bar reflects the new period
- [ ] T-V: Verification — `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass;
      manual head dashboard navigation test
