# Tasks — Redesign Lead Slide Quadrants (Concept B)

Design decisions D1–D9 live in `design.md`; the spec contract in
`specs/lead-slide-quadrants/spec.md`.

## 1. Tokens (packages/ui)

- [x] 1.1 `packages/ui/src/styles/globals.css`: add dimension token
      `--slide-quadrant-min` (~120px) next to `--slide-row-min` (:130),
      and named token `--color-status-dot-at-risk: #d4a017` (D6 — names
      the existing literal, zero visual delta).

## 2. Model and shared status mapping (apps/web)

- [x] 2.1 `slide-product-chips.tsx`: export the worst-status mapping
      (`"red"/"yellow"/"green" → "blocked"/"at-risk"/"on-track"/"empty"`)
      and the dot color-class map; at-risk now references
      `var(--color-status-dot-at-risk)` (D3, D6).
- [x] 2.2 `section-slide-utils.ts`: add
      `productStatus: "blocked" | "at-risk" | "on-track" | "empty"` to
      `UnifiedSectionRow`; `buildUnifiedSlideModel` maps via the shared
      helper; `cross-product` rows get `"empty"` (D2, D7).
- [x] 2.3 `status-slide-deck.tsx`: `LeadSlideArticle` reuses the shared
      mapping for its chip entries (delete the inline ternary chain).

## 3. Quadrant rewrite (apps/web)

- [x] 3.1 `lead-unified-slide.tsx`: rewrite `SectionBlock` into framed
      quadrant cards — card shell + left status stripe per D4, neutral
      headers, per-quadrant `min-h-[var(--slide-quadrant-min)]`, keep
      fullscreen variants on the wrapper; delete `inlineProductMarker`.
- [x] 3.2 Row rendering: 8px status dot (multi-product only, >1 real
      product excluding `cross-product`) with `title` + sr-only product
      name (D7, D8); keep the gold `P{n}` chip and
      `MAX_ITEMS_PER_SECTION = 4` + "+N more".
- [x] 3.3 Empty state: dashed placeholder per quadrant ("Nothing in
      flight" / "Nothing queued" / "No risks raised" / "No decisions
      recorded"), reusing the `textList` empty pattern's classes (D5).
- [x] 3.4 Watermark: large low-opacity quadrant lucide icon in the card
      corner, `aria-hidden`, `overflow-hidden` on the card (D9).

## 4. Tests

- [x] 4.1 Unit tests for the new contract: empty quadrant renders the
      placeholder (never a bare header); multi-product rows show dots
      with sr-only names and no name column; single-product rows show no
      dots; `buildUnifiedSlideModel` fills `productStatus`. Update any
      existing tests/snapshots that assert the old DOM.

## 5. Verification and acceptance

- [x] 5.1 Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
      — record results here.
      Evidence: final run 2026-06-10 after round 4 — typecheck ✓, lint ✓,
      tests 868 api + 905 web ✓, build ✓ (see Evidence section).
- [x] 5.2 Live screenshots (servers on :3100): lead "Own" slide in
      normal + fullscreen, multi-product and single-product, an
      empty-quadrant case; before/after pair for user acceptance before
      archiving.
      Evidence: rounds 1-4 in `.playwright-mcp/unify-toolbar/`; ACCEPTED
      by the user 2026-06-10 («Мне понравилось, как выглядит слайд.
      Отлично») + explicit archive approval same day.

## 6. Feedback round 2 (2026-06-10, live review — see design.md addendum)

- [x] 6.1 Quadrant grid gets a normal-view vertical floor
      (`min-h-[52dvh]`) so cards distribute evenly.
- [x] 6.2 Decisions accent → blue token `--color-decisions-accent:
  #4a7494` (recorded user color sign-off 2026-06-10).
- [x] 6.3 Next focus card → dashed frame, solid left stripe.
- [x] 6.4 Remove `MAX_ITEMS_PER_SECTION` + "+N more" — all rows always
      render; spec scenario updated.
- [x] 6.5 Hero → one-line status strip (frontend-design pass): tone badge + author + segmented metric capsule (icons, one h-11 height) left;
      scope toggle right.

## Evidence (implementation + verification)

- Workflow `quadrants-apply` failed mid-run (implementer died without
  structured output); groups 1-2 salvaged from its working tree, the rest
  implemented in the main session. 3-lens review workflow
  (`quadrants-review`: opus contract + sonnet regressions + sonnet
  quality) returned 2 must-fix + 1 nice-to-have + 4 nits — all applied or
  consciously documented (countRealProducts comment).
- 5.1 gates: typecheck ✓, lint ✓ (ESLint no issues), tests 868 api + 907
  web ✓ (6 new slide tests), build ✓ — re-run after each feedback round.
- 5.2 screenshots in `.playwright-mcp/unify-toolbar/`: round 1
  (quadrants-boris/igor/olga/lead1), round 2-3 (quadrants-r2-olga,
  r2-maria-empty-risks, r3-maria, r3-maria-fullscreen). Docker postgres
  had died (Exited 255, Docker restart) — restarted, DB intact.
- AWAITING final user acceptance of round-3 screenshots before archive.

## 7. Feedback round 3 (2026-06-10, live review — design.md addendum §6)

- [x] 7.1 Row dots → neutral product badges (muted pill, truncate +
      title); status colors stay only on the chip strip.
- [x] 7.2 Remove `productStatus` from `UnifiedSectionRow` + builder;
      `STATUS_DOT_CLASS` back to module-private; spec attribution
      requirements rewritten; tests updated (905 web tests green).

## 8. Feedback round 4 (2026-06-10 — commit 64e1c6dd)

- [x] 8.1 Fixed-width tone badge, name zone, tabular metric values — hero
      geometry stable across slides/periods.
- [x] 8.2 Row product badges fixed width (w-[110px]) so texts align.
