# Tasks — Lead Stripe Semantics and Archived Badges

Decisions D1-D4: `design.md`. User sign-offs 2026-06-10: stripe =
«Живой из своих стейджей»; "[Archived]" text → neutral badge
everywhere.

## 1. Live stripe (D1)

- [x] 1.1 `sdlc-pipeline.tsx`: compute `worstOwnStatus` per product
      from `ownership === 'mine'` stages (blocked > at-risk >
      on-track; all empty → `empty`); feed `getProductCardStyle` with
      it instead of `product.overallStatus`; dashed rule unchanged.
- [x] 1.2 Update `sdlc-pipeline.test.tsx`: amber persisted status +
      empty own stages → neutral dashed stripe; own blocked stage →
      blocked stripe; all-own-filled → solid.

## 2. Archived badge in Fill From (D2)

- [x] 2.1 `fill-from-button.tsx`: drop the "[Archived] " prefix; add
      the neutral muted "Archived" pill on archived rows (coexists
      with "Previous" on the first row).
- [x] 2.2 Update `fill-from-button.test.tsx`: badge asserted instead
      of the text prefix.

## 3. PeriodNavigator custom listbox (D3)

- [x] 3.1 Replace the native select with a trigger + portaled listbox
      (fill-from portal pattern; same props API, same control height;
      combobox/listbox roles, arrows/Enter/Escape, focus return).
- [x] 3.2 "Archived" badge on archived options; selected state marked.
- [x] 3.3 Verify the head toolbar consumer (`head-report-shell.tsx`)
      renders and operates unchanged.
- [x] 3.4 Recon + update e2e/sweep selectors that assumed a native
      select (`grep -rn "Select reporting period" e2e/ apps/`);
      validate with `playwright test --list`.
- [x] 3.5 Update/extend `period-navigator.test.tsx` for the listbox
      (open, select, keyboard, badge).

## 4. Seed coherence (D4)

- [x] 4.1 `prisma/seed-simple.ts`: per-section `ProjectStatus` =
      worst of the author's own seeded stage statuses (none → omit or
      green); reseed dev DB.

## 5. Feedback round (user, 2026-06-10): broken Edit/Slides pill on the lead header

- [x] 5.0 `view-mode-toggle.tsx`: the shared ViewModeToggle returned two
      sibling links with no wrapper, so the lead header's `gap-3` flex
      split the segmented pill into two broken halves (the head looked
      fine only because it wrapped the toggle itself). Made the
      component self-contained (`inline-flex` wrapper), removed the
      now-redundant wrapper in `head-report-shell.tsx`, updated the
      view-mode snapshot (now pins exactly the toggle, not the whole
      action row). Verified live: lead header matches the head pattern
      (`12-lead-header-segmented-toggle.png`).

## 6. Verification and acceptance

- [x] 6.1 Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm
build` — record results here.
      RESULTS 2026-06-10 (workflow `wf_11b83ac7-c64`, 0 fix rounds):
      typecheck PASS, lint PASS, test PASS, build PASS; `playwright test
--list` parses. The review agent died on a session limit — replaced
      by an inline main-session review of every diff. Post-workflow seed
      simplification (fallback-to-lightStatus dropped in favor of plain
      green per D4) re-verified via `pnpm lint:prisma:typecheck` +
      prettier, both clean.
- [x] 6.2 Live screenshots on fresh reseeded data, WHOLE-surface
      re-walk (`.playwright-mcp/lead-surface-fixes/08-11*.png`):
      08 all three stripes neutral+dashed with zero own statuses (no
      phantom amber); 09 period listbox open — Current ✓, four
      neutral "Archived" pills, no bracketed text; 10 Fill From rows
      with Previous + Archived pills; 11 head toolbar renders and
      opens the shared listbox unchanged. USER ACCEPTANCE PENDING.
