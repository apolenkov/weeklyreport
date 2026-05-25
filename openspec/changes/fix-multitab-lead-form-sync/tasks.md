# Tasks

- [x] T1: No custom hook needed — React Query's built-in `refetchOnWindowFocus`
      covers cross-tab sync when `staleTime` is finite. No new file created.
- [x] T2: Wired `invalidateLeadForm(qc, trpc)` into `use-lead-form-autosave.ts`
      `onSuccess` handler. Added `useQueryClient` import; `qc` resolved at hook
      init time. Also set `staleTime: 30_000` + `refetchOnWindowFocus: true` on
      `byPeriod` query in `lead-form.tsx` (was `staleTime: Infinity`).
- [x] T3: Added "invalidates leadForm queries after successful save" test to
      `use-lead-form-autosave.test.tsx` — spies on `queryClient.invalidateQueries`
      and asserts at least one call targets a `leadForm` key.
- [ ] T4: Manual verification — open the report in two tabs, edit Section A in
      Tab 1, switch focus to Tab 2, confirm edit appears without reload
- [ ] T5: Commit — `fix(lead-form): sync draft form across browser tabs on
  focus`
- [x] T-V: `pnpm typecheck` ✓, `pnpm lint` ✓,
      `pnpm --filter @customreport/web exec vitest run …autosave.test.tsx` ✓
      (12/12 pass)
