# Tasks — head-surface-uat-polish

## 1. F3 — inline head slide fixed frame

- [ ] 1.1 In `status-slide-deck.tsx`, add `.slide-frame` to `HeadSlideArticle`'s
      `<article>` and switch its inner wrapper from `space-y-5` to a column flex
      that fills the frame (`flex h-full flex-col gap-5`), mirroring
      `LeadSlideArticle`.
- [ ] 1.2 Make the 2×2 section grid fill the leftover frame height (`flex-1`,
      `min-h-0`, keep `auto-rows-fr`), so the quadrants distribute over the frame.
- [ ] 1.3 Ensure an overflowing section scrolls inside its own card (the
      Decisions `scrollItems` path) without expanding the frame; verify Risks /
      Current / Next keep their `--slide-quadrant-min` floor.
- [ ] 1.4 Update `status-slide-deck.test.tsx` to assert the head article carries
      `slide-frame` and the grid fills (`flex-1`).
- [ ] 1.5 Live-verify in the browser: head slides view shows a fixed-aspect slide
      with no large empty gap; capture after-screenshot.

## 2. F5 — Period Summary card list

- [ ] 2.1 Rebuild `lead-summary-table.tsx` from the 10-column `<table>` into a
      vertical list of per-lead cards in the `BlockedAtRiskTable` idiom (rounded
      `rounded-lg` cards, soft surface, gap-separated), keeping the section
      heading + caption header.
- [ ] 2.2 Per card: avatar + name + role and the status pill on the lead line;
      counts (Products / Current / Next / Risks / Decisions / Priorities) as
      compact labeled chips; Remind/Revoke action right-aligned.
- [ ] 2.3 Preserve behavior: `canSendReminder` Remind gate, Revoke for submitted,
      neutral placeholder otherwise; the 24h-inactive dim treatment.
- [ ] 2.4 Re-target `lead-summary-table.test.tsx` to the card structure — same
      assertion intent (status shown, counts shown, action gating, inactive
      marker). Do not weaken assertions.
- [ ] 2.5 Live-verify: Period Summary reads as rounded cards, no horizontal
      scroll, matches the Blocked & At Risk treatment; capture after-screenshot.

## 3. Gates

- [ ] 3.1 `npx prisma generate` (repo wipes the client), then `pnpm typecheck`,
      `pnpm lint`, web tests, `pnpm build` — all green.
- [ ] 3.2 `openspec validate head-surface-uat-polish --strict` passes.

## 4. Decisions (NOT implemented — see proposal Open Questions)

- [ ] 4.1 F1 — "Open focused report" in slides header: keep / relabel / remove.
- [ ] 4.2 F2 — "Needs Attention" banner: relabel / rework / keep.
- [ ] 4.3 F4 — dashboard Blocked & At Risk: keep-expanded / keep-collapsed /
      remove.
