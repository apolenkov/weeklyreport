# Tasks — demo feedback polish

## 1. Head draft visibility (items 6 + 4)

- [ ] 1.1 Relax the empty-state gate in `weekly-report-page.tsx` (~line 547) so
      the head sees draft content; show the empty state only when content is truly
      empty (no section has data), not when `submitted === 0`.
- [ ] 1.2 Keep `canPublish` gated at `submitted > 0`; ensure the "Nothing to
      publish" label and `showPublishHint` key off the publish precondition, not the
      empty screen. Relabel the now-misleading strings: the status-line hint
      "No submitted report content yet." (`weekly-report-page.tsx` ~line 466) and
      `publishDisabledReason` (~line 517) MUST read as a publish precondition
      (e.g. "Publish requires at least one submitted section."), not as
      absence-of-content.
- [ ] 1.5 Define "truly empty" for the empty state as no item/risk/decision
      across sections (reuse `hasExpandableProducts` or equivalent), never
      `submitted === 0`.
- [ ] 1.3 Leave the API content query and the viewer service gate unchanged.
- [ ] 1.4 Test: head + 0 submitted with drafts renders content; empty state only
      on truly-empty content; viewer unpublished still rejected.

## 2. View-mode toggle (item 7)

- [ ] 2.1 Pass `mode={mode === "slides" ? "slides" : "edit"}` into `ViewModeToggle`
      in `head-report-shell.tsx`.
- [ ] 2.2 Encode `scope` and `includeArchive` in the URL (currently local
      `useState`); restore them on load.
- [ ] 2.3 Test: active segment matches URL mode; refresh / shared link restore
      mode + scope.

## 3. Pipeline tooltip color (item 9)

- [ ] 3.1 Thread `hiddenStagesEffectiveStatuses` (`StageStatus[]`) into
      `CollapsedStagesIndicator` alongside the reveal lines.
- [ ] 3.2 Color each row via `STATUS_CONFIG[status].text` + a leading status dot
      (blocked/at-risk/on-track/neutral); no new token; keep the light popover surface.
- [ ] 3.3 Test: mixed-status reveal rows carry the right token colors.

## 4. Summary clip (item 1) — conformance bug, no spec delta

- [x] 4.1 ALREADY CONFORMANT on main — no code change needed. The own/Summary
      scope renders `LeadUnifiedSlide`, whose `QuadrantCard` inner already carries
      `overflow-y-auto` + `min-h-0` for BOTH the in-page and fullscreen renders
      (`lead-unified-slide.tsx:76`), so the rule `lead-slide-quadrants` mandates is
      honored in-page, not fullscreen-only. The grill's premise (in-page clips) was
      resolved earlier by `lead-slide-quadrants` / the lead-report-feedback batch
      (PR #21, merged 2026-06-22).
- [x] 4.2 Regression test ALREADY EXISTS: `lead-unified-slide.test.tsx`
      "dense quadrant overflow is scroll-reachable" asserts the inner
      `overflow-y-auto` + `min-h-0` (in-page render, no fullscreen). No duplicate
      added.
- [x] 4.3 Live-verified (1728px, lead Summary): the dense "Current work" quadrant
      (9 rows) has `overflow-y:auto`, `min-height:0`, content 386px in a 260px card;
      the last row is NOT visible at rest but IS reachable by scrolling — a working
      scroll, not an unreachable clip. `slide-frame` and the grid do not clip.

## 5. Product-grid section alignment (live demo feedback 2026-06-22, item 10)

- [x] 5.1 Split the merged Risks+Decisions band in `lead-product-grid.tsx` into
      two SEPARATE subgrid rows so each of the five bands (header, Current, Next,
      Risks, Decisions) aligns independently across sibling cards. Bump the card
      to `row-span-5`; both Risks and Decisions ALWAYS render (quiet placeholder
      when empty), so a risk-less card no longer floats its Decisions up.
- [x] 5.2 Modify the `lead-product-grid-alignment` spec (4 bands → 5 separate
      bands) and update the component test (row-span-5; both empty placeholders).
- [x] 5.3 Live-verify: at 1728px all of Current/Next/Risks/Decisions share one
      baseline across all cards in a row even when a card lacks risks.

## 6. Product-grid Decisions divider (live demo feedback 2026-06-22, item 11)

- [x] 6.1 Add the same top divider above the Decisions band as Risks has, so both
      bands are delimited (`lead-product-grid.tsx`); +test asserting both bands
      carry `border-t`. Uniform divider keeps the subgrid tracks aligned.

## 7. Fullscreen Exit pill vs hero controls (live demo feedback 2026-06-22, item 12)

- [x] 7.1 In fullscreen the floating "Exit" pill (`slide-fullscreen-button`
      floating variant, `fixed top-4 right-4`) overlapped the hero's right-hand
      scope toggle. Reserve right space ONLY in fullscreen on the hero status
      strip (`[:fullscreen_&]:pr-28` in `lead-slide-hero.tsx`) so the toggle
      clears the pill; non-fullscreen layout unchanged. Bug fix, no spec delta.
      +test asserting the class. Live fullscreen verification pending (headless
      fullscreen is restricted — verify on the user's real browser).

## 8. Gates

- [ ] 8.1 `pnpm typecheck && pnpm lint && pnpm test && openspec validate demo-feedback-polish --strict`.
