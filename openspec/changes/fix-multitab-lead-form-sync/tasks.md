# Tasks

- [ ] T1: Create a shared multi-tab event hook `usePageVisibilityChange()` in
      `apps/web/src/hooks/` — listen to visibility-change and page-focus
- [ ] T2: Wire the hook into `use-lead-form-autosave.ts:126` — on page focus,
      call `invalidateLeadForm()` to refresh server state
- [ ] T3: Add a test case to `use-lead-form-autosave.test.ts` that mocks
      visibility change and asserts invalidateLeadForm is called
- [ ] T4: Manual verification — open the report in two tabs, edit Section A in
      Tab 1, switch focus to Tab 2, confirm edit appears without reload
- [ ] T5: Commit — `fix(lead-form): sync draft form across browser tabs on
    focus`
- [ ] T-V: Verification — `pnpm typecheck`, `pnpm lint`,
      `pnpm test:lead-form` pass; multi-tab manual spot-check in browser
