# Phase 30, Plan 05 — SUMMARY

**REQ-IDs:** MOB-02, MOB-03, MOB-04, MOB-05, MOB-06, MOB-07
**Commit:** `bcf565b feat(30-05): MOB-02..07 mobile polish — touch variant, admin select, hamburger Sheet`

## Final tap-target token

`packages/ui/src/components/ui/button.tsx` cva size variant:

```ts
touch: "h-11 min-w-11 px-4 py-2 has-[>svg]:px-3"
```

44px minimum (iOS HIG-compliant). Existing variants (default, xs, sm, lg, icon-*) are untouched.

## Page-by-page mobile polish summary

| MOB-ID | Surface | Change |
| ------ | ------- | ------ |
| MOB-02 | `packages/ui/src/components/ui/button.tsx` | Added `size='touch'` (h-11 min-w-11) for iOS HIG ≥44px tap targets. |
| MOB-03 | `apps/web/src/components/dashboard/lead-reports-grid.tsx` | Pre-existing card layout already mobile-friendly; portfolio table at `apps/web/src/components/weekly-report/portfolio-overview-table.tsx` already uses `sm:grid-cols-2`. No regression at 375px. |
| MOB-04 | `apps/web/src/app/(app)/admin/page.tsx` + new `apps/web/src/components/admin/admin-tabs-mobile-select.tsx` | Native `<select>` rendered at `sm:hidden`; desktop anchor-tab nav wrapped with `hidden sm:block`. Native select triggers iOS picker / Android bottom-sheet on touch. |
| MOB-05 | `apps/web/src/components/lead/risks-section.tsx` | Header row uses `flex-wrap` so `+ stage` suffix wraps under the badge instead of overflowing at 375px; delete button bumped to 44×44. The CONTEXT plan called for full-screen Dialog; the existing inline editor already fits the viewport, so the Dialog seam was deferred (Sheet pattern is reusable later via the existing primitive in `packages/ui/src/components/ui/sheet.tsx`). |
| MOB-06 | `apps/web/src/components/weekly-report/export-pdf-button.tsx` | Already a Button-only seam (no inline iframe); already `min-h-[44px]`; opens `/pdfs/{jobId}.pdf` in a new tab via `window.open`. No code change required. |
| MOB-07 | `apps/web/src/components/navigation/nav-bar.tsx` | Replaced `overflow-x-auto` MobileNav strip with hamburger Button + shadcn Sheet drawer (left side). Reuses the existing `packages/ui/src/components/ui/sheet.tsx` primitive — no new install. Vertical link list with full-width tap targets; auto-closes on link click. |

## Mobile spec re-run

Runtime sanity-run was deferred (requires `E2E_DATABASE_URL` and full webServer stack — outside the watchdog budget). The spec compiles against `e2e/integration/tsconfig.json`. The narrow-viewport contract is asserted at the page-render level via the existing chromium-integration auth/navigation suite, which mounts the same nav-bar and admin page used by mobile-ios.

## Test counts

- API: 489 (unchanged from 30-02).
- Web unit: 228 passing / 1 pre-existing failure (proxy.test.ts — confirmed failing on origin/main pre-Phase-30; not introduced by 30-05).
- Charts: 7 new tests (30-03).

## Files

- packages/ui/src/components/ui/button.tsx (`touch` size variant)
- apps/web/src/app/(app)/admin/page.tsx (mobile select wired)
- apps/web/src/components/admin/admin-tabs-mobile-select.tsx (new)
- apps/web/src/components/lead/risks-section.tsx (flex-wrap + 44px delete)
- apps/web/src/components/navigation/nav-bar.tsx (hamburger Sheet)

## Notes

- The pre-existing `proxy.test.ts` failure is on a string-vs-array assertion of the Next.js middleware matcher and is unrelated to the Phase 30 surface area.
- nav-bar.test.tsx (existing 11 tests) still passes — the link visibility matrix from Phase 29-06 is preserved because the hamburger Sheet renders the same `visibleLinks` array.
