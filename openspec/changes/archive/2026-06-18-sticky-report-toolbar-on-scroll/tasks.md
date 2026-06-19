# Tasks

- [x] In `apps/web/src/components/report-shell/report-toolbar.tsx`, add an
      opt-in `sticky?: boolean` prop to `ReportToolbar` (default `false` so
      existing usages are unchanged).
- [x] When `sticky` is true, apply `sticky top-0` plus a raised z-index to the
      toolbar wrapper, choosing a z-index below the NavBar's dropdown layer
      (NavBar uses `z-30`) but above report content.
- [x] When `sticky` is true, render an opaque background (not the resting
      `bg-[var(--color-surface-hover)]/70` translucent frame) and add a subtle
      elevation cue (a shadow and/or a stronger border edge) so the pinned bar
      reads as raised. Keep the resting (non-sticky) appearance byte-identical
      for non-opt-in usages — split the frame class so the opaque/elevated bits
      only apply in the sticky branch.
- [x] Confirm pinning does not alter the single-row, two-cluster content or the
      shared `--toolbar-control-h` height (positioning/surface only).
- [x] In `apps/web/src/components/lead/lead-form.tsx` (~line 1219), pass
      `sticky` to the lead `ReportToolbar` usage so the lead context bar pins;
      leave the document-action `<header>` above it in normal flow.
- [x] Verify the document-action header is NOT inside the sticky region and the
      pinned toolbar never overlaps it (the header scrolls away above the bar).
- [x] Update `apps/web/src/components/report-shell/report-toolbar.test.tsx`:
      assert the sticky variant renders the sticky positioning class and the
      default render stays non-sticky.
- [x] Run gates: `pnpm typecheck`, `pnpm lint`, `pnpm test`. UI-string check on
      the changed `.tsx` files (`grep -nE '[а-яА-Я]'` must only match comments).
- [x] Live-verify on a long lead report: scroll down, confirm the context bar
      pins at the top, stays clickable, shows the elevation cue, has an opaque
      background, and does not overlap the document-action header.
