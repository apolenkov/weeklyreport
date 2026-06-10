# Tasks — Hoist Query Error Policy

Decisions D1-D3: `design.md`. NOT STARTED — captured 2026-06-10.
Opens per the Sequencing section of `proposal.md` (after
`fix-lead-stripe-and-archived-badges`, `require-risk-stage`, and
`refactor-web-trpc-test-harness` are archived).

**Execution note (standing): Sequential single-writer edits only;
parallel agents only for read-only analysis (repo lesson: parallel
mechanical edits pass gates but break behavior).** Run the full gates
after EVERY commit; read each diff before committing.

## 1. web: hook + contract test (test-first, D2)

- [ ] 1.1 NEW `apps/web/src/lib/use-query-error-handler.test.tsx`
      (renderHook; `vi.mock("sonner")`): (a) on `isError` flip,
      `logClientError` envelope fires exactly once with
      event/component/procedure + caller context; (b) `toastPrefix`
      set → `toast.error` called with `formatClientErrorMessage`
      output; (c) `toastPrefix` absent → toast never called (pins the
      slides silent policy); (d) rerender with the same error object →
      no second log/toast; (e) context prop change during a persistent
      error → no re-fire (ref semantics).
- [ ] 1.2 NEW `apps/web/src/lib/use-query-error-handler.ts`
      (`"use client"`, kebab-case precedent:
      `use-cursor-pagination.ts`): signature and semantics exactly as
      design.md D2 — effect deps `[query.isError, query.error]`, opts
      via ref, delegates to `logClientError` and (iff `toastPrefix`)
      `toast.error(formatClientErrorMessage(...))`.
      `client-error-reporting.ts` stays byte-identical.
      Commit: `feat(web): add useQueryErrorHandler error-policy hook`.

## 2. web: behavior-identical migrations (D3 rows 5-7)

- [ ] 2.1 `apps/web/src/components/dashboard/dashboard-page.tsx`:
      replace the 2 query-error `useEffect` blocks at ~85-108 (reviewQ,
      weeklyQ) with hook calls carrying the same
      event/component/procedure/context and toast prefixes
      "Failed to load dashboard" / "Failed to load status report".
      Do NOT touch the watchdog sites (~:142, ~:169) or the render-time
      `formatClientErrorMessage` at ~:210.
      `apps/web/src/components/weekly-report/weekly-report-page.tsx`:
      same for the 1 effect at ~137-149 ("Failed to load status
      report"). `dashboard-page.test.tsx` and
      `weekly-report-page.test.tsx` must pass UNMODIFIED.
      Commit: `refactor(web): route dashboard and weekly-report query
errors through useQueryErrorHandler`.

## 3. web: slides migrations, log-only (D3 rows 8-10)

- [ ] 3.1 `apps/web/src/components/slides/lead-slides-client.tsx`
      (~102-117: activeQ, byPeriodQ) and
      `apps/web/src/components/slides/head-slides-client.tsx`
      (~64-70: weeklyQ): replace the 3 silent `logClientError` effects
      with hook calls WITHOUT `toastPrefix` (slides stay silent —
      design.md D3). Existing slides tests
      (`status-slide-deck.test.tsx` et al.) must pass UNMODIFIED.
      Commit: `refactor(web): route slides query errors through
useQueryErrorHandler`.

## 4. web: lead-form — the only behavior-changing commit (D3 rows 1-4)

- [ ] 4.1 `apps/web/src/components/lead/lead-form.tsx`: replace the 4
      effects at ~440-498 with hook calls — events/contexts unchanged
      (activeQ: `reportId: pinnedReportId ?? null`; byPeriodQ:
      `reportId: targetReportId || null, role: sessionRole`; versionsQ:
      `reportSectionId: sectionIdForActions || null`; historyQ: none) —
      toastPrefixes "Failed to load active report" / "Failed to load
      form" / "Failed to load versions" / "Failed to load history".
      Visible change: toasts gain "Reference: \<requestId\>." and stop
      echoing raw internal messages.
- [ ] 4.2 EXTEND `apps/web/src/components/lead/lead-form.test.tsx` (on
      the existing tRPC-proxy-boundary harness; sonner already mocked):
      byPeriod queryFn rejects with a TRPCClientError carrying
      `requestId: "req-X"` + INTERNAL_SERVER_ERROR; assert
      `toast.error` receives "Failed to load form. Reference: req-X."
      Existing mutation-error assertions ("Submit blew up", "Version
      not found") stay green untouched. Isolated commit (easy revert +
      screenshot acceptance).
      Commit: `fix(lead): unify lead-form load-failure toasts onto the
client error policy`.

## 5. Verification

- [ ] 5.1 Gates (after every commit, recorded here on the final run):
      `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- [ ] 5.2 Unchanged-green proof:
      `apps/web/src/lib/client-error-reporting.test.ts` passes
      unmodified (pins the console envelope consumed by
      `client-logger.ts` / `app.log`), plus unmodified
      dashboard/weekly-report/slides tests.
- [ ] 5.3 Residue check:
      `grep -rn "logClientError" apps/web/src --include="*.tsx"` shows
      only the 2 non-query dashboard watchdog sites; query-error
      effects exist only inside the hook.
- [ ] 5.4 Live check: force a lead-form load failure in the browser;
      screenshot the toast showing the "Reference: \<id\>." suffix
      (lead-surface acceptance practice); user acceptance.
- [ ] 5.5 File the follow-up change stub for the 5 unlogged toast
      sites (`apps/web/src/app/(app)/reports/page.tsx`,
      `apps/web/src/app/print/[reportId]/page.tsx`,
      `apps/web/src/components/admin/admin-panel.tsx`) — adoption adds
      logging there, out of scope here.
- [ ] 5.6 Archive on merge:
      `openspec archive hoist-query-error-policy` + commit
      `chore(openspec): archive hoist-query-error-policy`.
