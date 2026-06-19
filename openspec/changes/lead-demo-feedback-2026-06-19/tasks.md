# Tasks — lead-demo-feedback-2026-06-19

## 1. Hero geometry parity across scopes (item 1 — CONFIRMED)

- [ ] 1.1 Make the product-scope branch in `lead-slides-client.tsx` wrap
      `LeadSlideHero` at the same inset as the own-scope path (reuse the deck
      shell or match its padding token), so the hero x/y is identical across
      scopes.
- [ ] 1.2 Live-verify: re-measure hero x and y in Summary vs Product — equal
      within ±1px; content below the hero unchanged per scope.

## 2. Collapsed `+N more` styled tooltip (item 2 — CONFIRMED)

- [ ] 2.1 Replace the native `title` on the collapsed-stages indicator
      (`sdlc-pipeline.tsx`) with `useSdlcTooltip` show/hide on
      enter/leave/focus/blur, passing `hiddenStagesRevealText(hiddenStages)`.
      Keep the `aria-label`.
- [ ] 2.2 Test: hovering the indicator drives the shared tooltip; leaving hides
      it; aria-label retained.

## 3. Pipeline status legibility (item 3 — NEEDS-CONFIRM)

- [ ] 3.1 BLOCKED on reviewer: confirm narrow (color the `+N more` indicator by
      worst hidden status) vs broad (chip legibility pass). No code until chosen.

## 4. ComingSoon tooltip consistency (item 4 — NEEDS-CONFIRM)

- [ ] 4.1 BLOCKED on reviewer: confirm the exact control/pixel and whether the
      dark-`sdlc-tooltip` vs amber-`ComingSoonBadge` duality is in scope. No code
      until confirmed.

## 5. Validate

- [ ] 5.1 `openspec validate lead-demo-feedback-2026-06-19 --strict` clean.
