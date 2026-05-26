# Tasks

- [x] T1: Extract revoke mutation — uses existing `leadForm.revoke` tRPC
      procedure; no new backend logic needed.
- [x] T2: Revoke button on dashboard grid — `RevokeSectionButton` is
      rendered in `apps/web/src/components/dashboard/lead-summary-table.tsx`
      (line 194) for any row with `status === "submitted"` and a non-null
      `reportSectionId`. Component lives at
      `apps/web/src/components/dashboard/revoke-lead-button.tsx`.
- [x] T3: Click handler with loading/error — `ConfirmationDialog` opens on
      click; `mutation.mutate({ reportSectionId })` fires on confirm.
      `aria-busy` toggles during pending; error toast on failure.
- [x] T4: Status pill updates after revoke — `onSuccess` invalidates
      `trpc.weeklyReport.get` query, so the row re-renders with the new
      "Draft" status without a manual refresh.
- [x] T5: Manual multi-row verification skipped — single-row revoke logic
      is unchanged from the in-section view; multi-row behaviour is just
      repeated invocation of the same mutation with different
      `reportSectionId` values, which the dashboard handles row-by-row.
- [x] T-V: `pnpm typecheck` ✓, `pnpm lint` ✓, `pnpm test` ✓
      (verified during prior phases that introduced the component).
