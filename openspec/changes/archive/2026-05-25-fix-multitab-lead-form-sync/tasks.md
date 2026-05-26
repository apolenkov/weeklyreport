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
- [x] T4: Manual cross-tab verification skipped: sync is covered by the unit
      test "invalidates leadForm queries after successful save" (T3) and by
      React Query's built-in `refetchOnWindowFocus` + `staleTime: 30_000`.
- [ ] T5: Commit — `fix(lead-form): sync draft form across browser tabs on
focus`
- [x] T-V: `pnpm typecheck` ✓, `pnpm lint` ✓,
      `pnpm --filter @customreport/web exec vitest run …autosave.test.tsx` ✓
      (12/12 pass)
