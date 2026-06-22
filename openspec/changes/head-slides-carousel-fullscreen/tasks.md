# Tasks — head slides carousel + fullscreen

## 1. Navigation model

- [ ] 1.1 Replace the left `<aside aria-label="Slides">` list in
      `status-slide-deck.tsx` (head branch) with a horizontal carousel of slide
      cards above the active slide.
- [ ] 1.2 EXTRACT a shared carousel/nav primitive from `StatusSlideDeck` (none
      exists today — lead uses `prev/next` under `showLeadControls`, head uses the
      bottom `Previous/Next`); verify the lead deck nav is unchanged after extraction.
- [ ] 1.3 Reuse `DeckFullscreenOverlay` (overlay-only, already on the head path)
      for the exit affordance; keep `HeadSlideArticle` for head content (do NOT
      render head data through the lead-hardcoded `LeadSlideArticle`/`LeadUnifiedSlide`).
      Make the active slide fill the viewport; preserve arrow-key navigation.
- [ ] 1.4 Keep `ScopeToggle` driving the carousel's slide set (Product / Leads).

## 2. De-duplicate status

- [ ] 2.1 Remove the status badge from the (now-removed) sidebar card; render the
      slide status exactly once on the active slide.

## 3. Fold readiness into the slide

- [ ] 3.1 Remove the separate right SLIDE COMPLETION `<aside>`.
- [ ] 3.2 Render the readiness score + checklist as a compact in-slide strip,
      reusing the existing readiness/score model.

## 4. Agent review placeholder

- [ ] 4.1 Give `AgentReviewComingSoon` a fixed slot in the slide header; stop it
      floating / overlapping. Keep it inert (ComingSoonBadge, aria-disabled). Do NOT
      build hover content (Phase 54, deferred).

## 5. Tokens & parity

- [ ] 5.1 No new color token; reuse existing `--color-*`. Keep neutral headers +
      token stripes and framed-card section grid (un-removed `head-slide-density`
      requirements).

## 6. Tests

- [ ] 6.1 Update `head-report-shell.test.tsx` / `status-slide-deck.test.tsx`:
      assert carousel present (no sidebar list), status rendered once, readiness
      in-slide, Agent review in a fixed header slot.
- [ ] 6.2 Assert the active segment / fullscreen + arrow-key navigation still work.

## 7. Verification (required before archive)

- [ ] 7.1 Same-viewport before/after screenshots on `:3000` across one-lead,
      many-leads, empty-section, dense-decisions, and fullscreen states for user
      acceptance (per `head-slide-density`).

## 8. Gates

- [ ] 8.1 `pnpm typecheck && pnpm lint && pnpm test && openspec validate head-slides-carousel-fullscreen --strict`.
