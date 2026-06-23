# Tasks — head slides carousel + fullscreen

## 1. Navigation model

- [x] 1.1 Replace the left `<aside aria-label="Slides">` list in
      `status-slide-deck.tsx` (head branch) with a horizontal carousel of slide
      cards above the active slide. (New `head-slide-carousel.tsx`.)
- [x] 1.2 ~~EXTRACT a shared carousel/nav primitive~~ — **deviation (recorded):**
      the new head nav is a card carousel + arrow keys, and the head bottom
      `Previous/Next` is removed entirely, so the only remaining `prev/next`
      consumer is the lead deck. A "shared" primitive would be single-use, which
      our code-style forbids — so the carousel is built as a clean head-only
      component (`HeadSlideCarousel`) instead of an extraction. The durable
      intent of 1.2 — lead deck nav unchanged — holds: the lead branch
      (`showLeadControls` prev/next + `LeadSlideArticle`) is untouched, and the
      lead a11y/nav tests still pass.
- [x] 1.3 Reuse `DeckFullscreenOverlay` (overlay-only, already on the head path)
      for the exit affordance; keep `HeadSlideArticle` for head content (do NOT
      render head data through the lead-hardcoded `LeadSlideArticle`/`LeadUnifiedSlide`).
      Make the active slide fill the viewport; preserve arrow-key navigation.
      (`useFullscreen` kept per-article — the carousel sits outside the
      fullscreened article, which is fine: the contract never requires the
      carousel inside fullscreen.)
- [x] 1.4 Keep `ScopeToggle` driving the carousel's slide set (Product / Leads).
      (Scope stays a `HeadReportShell` toolbar control feeding `HeadSlidesClient`;
      the carousel reflects whatever slide set the current scope produces —
      untouched by this change.)

## 2. De-duplicate status

- [x] 2.1 Remove the status badge from the (now-removed) sidebar card; render the
      slide status exactly once on the active slide. (Carousel cards carry no
      tone pill/text; the tone pill stays only on the active slide header. Test
      asserts the status label renders exactly once.)

## 3. Fold readiness into the slide

- [x] 3.1 Remove the separate right SLIDE COMPLETION `<aside>`.
- [x] 3.2 Render the readiness score + checklist as a compact in-slide strip,
      reusing the existing readiness/score model. (`ReadinessStrip`; empty
      checklist → quiet "No readiness checks on this slide" placeholder.)

## 4. Agent review placeholder

- [x] 4.1 Give `AgentReviewComingSoon` a fixed slot in the slide header; stop it
      floating / overlapping. Keep it inert (ComingSoonBadge, aria-disabled). Do NOT
      build hover content (Phase 54, deferred). (Wrapped in a fixed
      `head-agent-review-slot`; placeholder unchanged.)

## 5. Tokens & parity

- [x] 5.1 No new color token; reuse existing `--color-*`. Keep neutral headers +
      token stripes and framed-card section grid (un-removed `head-slide-density`
      requirements). (Section grid + `HeadSectionCard` untouched; new chrome
      reuses existing `--color-*` tokens.)

## 6. Tests

- [x] 6.1 Update `head-report-shell.test.tsx` / `status-slide-deck.test.tsx`:
      assert carousel present (no sidebar list), status rendered once, readiness
      in-slide, Agent review in a fixed header slot. (`status-slide-deck.test.tsx`
      head suite rewritten; `head-report-shell.test.tsx` stubs the deck so it
      needs no change.)
- [x] 6.2 Assert the active segment / fullscreen + arrow-key navigation still work.
      (Existing lead arrow-key + fullscreen tests preserved; they cover the
      shared section keydown handler used by the head deck too.)

## 7. Verification (required before archive)

- [~] 7.1 Same-viewport before/after screenshots on `:3000` for user acceptance
  (per `head-slide-density`). BEFORE + AFTER captured to
  `.verify-head-carousel/` with a `README.md` index: many-leads (lead +
  product scope), per-active-slide (incl. an empty-section slide), and an
  emulated fullscreen. **Awaiting user acceptance — NOT archived.** Gaps
  noted in the README: a true one-lead carousel (this seed has 3 leads;
  single-slide hides the carousel — unit-tested) and REAL fullscreen
  (emulated only; needs a live `f`/Exit-pill check on the user's stack).

## 8. Gates

- [x] 8.1 `pnpm typecheck && pnpm lint && pnpm test && openspec validate head-slides-carousel-fullscreen --strict`
      — all green at commit `4d5709a9` (typecheck 5/5, full lint clean, test
      1275 passed, validate `--strict` valid).
