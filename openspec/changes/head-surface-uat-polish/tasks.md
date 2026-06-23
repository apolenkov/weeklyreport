# Tasks — head-surface-uat-polish

## 1. F3 — inline head slide fixed frame

- [x] 1.1 In `status-slide-deck.tsx`, add `.slide-frame` to `HeadSlideArticle`'s
      `<article>` and switch its inner wrapper from `space-y-5` to a column flex
      that fills the frame (`flex h-full flex-col gap-5`), mirroring
      `LeadSlideArticle`.
- [x] 1.2 Make the 2×2 section grid fill the leftover frame height (`flex-1`,
      `min-h-0`, keep `auto-rows-fr`), so the quadrants distribute over the frame.
- [x] 1.3 Ensure an overflowing section scrolls inside its own card
      (`HeadSectionCard` is now a flex column; its list is `flex-1 min-h-0
    overflow-y-auto` — replaced the Decisions-only `scrollItems` special-case
      with uniform per-card scroll) without expanding the frame; the
      `--slide-quadrant-min` floor is preserved.
- [x] 1.4 `status-slide-deck.test.tsx` asserts the head article carries
      `slide-frame` and the grid fills (`flex-1`).
- [x] 1.5 Live-verified: head slides view shows a fixed-aspect (16:10) slide;
      after-screenshot at `docs/head-design-review-2026-06-24/after-head-report-slides.png`.

## 2. F5 — Period Summary card list

- [x] 2.1 Rebuilt `lead-summary-table.tsx` from the 10-column `<table>` into a
      vertical list of per-lead cards in the `BlockedAtRiskTable` idiom (rounded
      container + soft shadow; gap-separated `rounded-lg` cards), keeping the
      section heading + caption header (+ a leads-count pill).
- [x] 2.2 Per card: avatar + name + role and the status pill on the lead line;
      counts (Products / Current / Next / Risks / Decisions / Priorities) as
      compact labeled stat cells; submitted-at + Remind/Revoke action right.
- [x] 2.3 Preserved behavior: `canSendReminder` Remind gate, Revoke for
      submitted, neutral placeholder otherwise; the 24h-inactive dim treatment
      (`lead-row-inactive-24h` + `opacity-60`).
- [x] 2.4 Re-targeted `lead-summary-table.test.tsx` to the card structure (rows
      resolved by lead name via `closest("li")`) — same assertion intent, not
      weakened. 9/9 pass.
- [x] 2.5 Live-verified: Period Summary reads as rounded cards, no horizontal
      scroll, matches the Blocked & At Risk treatment; after-screenshot at
      `docs/head-design-review-2026-06-24/after-head-dashboard.png`.

## 3. Gates

- [x] 3.1 `npx prisma generate`, then `pnpm typecheck`, `pnpm lint`, `pnpm test`
      (1263 passed), `pnpm build` — all green.
- [x] 3.2 `openspec validate head-surface-uat-polish --strict` passes.

## 4. Decisions (NOT implemented — see proposal Open Questions)

- [ ] 4.1 F1 — "Open focused report" in slides header: keep / relabel / remove.
- [ ] 4.2 F2 — "Needs Attention" banner: relabel / rework / keep.
- [ ] 4.3 F4 — dashboard Blocked & At Risk: keep-expanded / keep-collapsed /
      remove.
