# Tasks — head dashboard declutter

## 1. Seed (prisma) — D5, D6-seed

- [ ] 1.1 In `prisma/seed-demo.ts` (small tier), flip exactly ONE active-period
      lead section to `ReportSectionStatus.submitted` (set a deterministic
      `submittedAt`); keep every other active section draft so the period stays
      `open`. Pick a lead whose submission does not move the three-color health
      mapping or the Mine/Everyone foreign content.
- [ ] 1.2 In `prisma/seed-demo.ts`, seed one active `ReminderPolicy` (deadline
      kind, `active: true`, `validFrom` ≤ active deadline, no `validUntil`) and
      one active `ReminderRule` (`reportId = ACTIVE_REPORT_ID`, `status: active`,
      deterministic `fireAt` from the active deadline) — mirror the existing
      `seed-simple.ts` policy+rule shape. Use fixed UUIDs.
- [ ] 1.3 Reseed the small tier (`pnpm db:seed:small`) and confirm: one lead
      Submitted with Revoke, period still open, three health colors unchanged,
      `hasActiveReminderRule` true.

## 2. Web — remove cards (D2, D4)

- [ ] 2.1 Delete `apps/web/src/components/dashboard/product-kpi-card.tsx` and its
      test `product-kpi-card.test.tsx`.
- [ ] 2.2 Delete `apps/web/src/components/dashboard/activity-24h-card.tsx` and
      `activity-24h-card.test.tsx`. Also delete `activity-querykey.test.tsx` — it
      is a dedup guard that exists ONLY to assert `Activity24hCard` and
      `ActivityLivePanel` share the `activity.live` queryKey; with one card gone
      the duplication it guards no longer exists.
- [ ] 2.3 Unmount both from `dashboard-page.tsx`: remove the `ProductKpiCard`
      `dynamic()` import + render, the `Activity24hCard` import + render, and any
      now-orphaned imports (`SessionContext` role usage, skeleton slots in
      `dashboard-skeleton.tsx`).
- [ ] 2.4 Confirm `recharts` is NOT removed from `apps/web/package.json` or
      `packages/ui/package.json` — it is still used by `reports/trends` charts
      and the `@customreport/ui` chart component.

## 3. Web — Period Summary table (D1)

- [ ] 3.1 In `lead-summary-table.tsx`, tighten column widths/padding so the
      `<table>` fits its `overflow-x-auto` wrapper at standard dashboard width
      (no phantom horizontal scrollbar). Drop the fixed `min-w-[840px]` if it is
      what overflows.
- [ ] 3.2 Bring the rows into the rounded card idiom of the other dashboard cards
      (match border/padding/typography treatment); no new color token.

## 4. Web — gate Remind (D6-gate)

- [ ] 4.1 In `dashboard-page.tsx`, thread `canSendReminder`
      (`= periodStatus !== "published" && hasActiveReminderRule`) into
      `LeadSummaryTable` as a prop.
- [ ] 4.2 In `lead-summary-table.tsx`, render the per-lead `RemindLeadButton`
      only when that gate is true (same gate `AlertBar` honors); otherwise show
      the neutral `—` cell.

## 5. Tests

- [ ] 5.1 Update `dashboard-page` / dashboard tests: assert no `ProductKpiCard`
      and no `Activity24hCard` render, `ActivityLivePanel` renders once.
- [ ] 5.2 Add a `lead-summary-table` test: Remind hidden when the gate is false,
      Remind shown when true and the row is draft; Revoke shown for a submitted
      row.

## 6. Docs

- [ ] 6.1 Note the removal + recharts-kept finding in
      `docs/demo-feedback-2026-06-23-head-surfaces.md` (Change 1 status) when
      implementing.

## 7. Verification (required before archive)

- [ ] 7.1 Same-viewport before/after screenshots on `:3000`: dashboard with the
      two cards gone, Period Summary fitting its container with no horizontal
      scroll, a Submitted lead with Revoke, and a working Remind dispatch.
- [ ] 7.2 Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green,
      and `openspec validate head-dashboard-declutter --strict` valid.
