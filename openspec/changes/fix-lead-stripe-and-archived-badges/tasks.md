# Tasks — Lead Stripe Semantics and Archived Badges

Decisions D1-D4: `design.md`. User sign-offs 2026-06-10: stripe =
«Живой из своих стейджей»; "[Archived]" text → neutral badge
everywhere.

## 1. Live stripe (D1)

- [ ] 1.1 `sdlc-pipeline.tsx`: compute `worstOwnStatus` per product
      from `ownership === 'mine'` stages (blocked > at-risk >
      on-track; all empty → `empty`); feed `getProductCardStyle` with
      it instead of `product.overallStatus`; dashed rule unchanged.
- [ ] 1.2 Update `sdlc-pipeline.test.tsx`: amber persisted status +
      empty own stages → neutral dashed stripe; own blocked stage →
      blocked stripe; all-own-filled → solid.

## 2. Archived badge in Fill From (D2)

- [ ] 2.1 `fill-from-button.tsx`: drop the "[Archived] " prefix; add
      the neutral muted "Archived" pill on archived rows (coexists
      with "Previous" on the first row).
- [ ] 2.2 Update `fill-from-button.test.tsx`: badge asserted instead
      of the text prefix.

## 3. PeriodNavigator custom listbox (D3)

- [ ] 3.1 Replace the native select with a trigger + portaled listbox
      (fill-from portal pattern; same props API, same control height;
      combobox/listbox roles, arrows/Enter/Escape, focus return).
- [ ] 3.2 "Archived" badge on archived options; selected state marked.
- [ ] 3.3 Verify the head toolbar consumer (`head-report-shell.tsx`)
      renders and operates unchanged.
- [ ] 3.4 Recon + update e2e/sweep selectors that assumed a native
      select (`grep -rn "Select reporting period" e2e/ apps/`);
      validate with `playwright test --list`.
- [ ] 3.5 Update/extend `period-navigator.test.tsx` for the listbox
      (open, select, keyboard, badge).

## 4. Seed coherence (D4)

- [ ] 4.1 `prisma/seed-simple.ts`: per-section `ProjectStatus` =
      worst of the author's own seeded stage statuses (none → omit or
      green); reseed dev DB.

## 5. Verification and acceptance

- [ ] 5.1 Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm
  build` — record results here.
- [ ] 5.2 Live screenshots on fresh data, re-verifying the WHOLE lead
      surface (all three stripes vs chips, period dropdown open with
      badges, Fill From list, head toolbar combo); user acceptance.
