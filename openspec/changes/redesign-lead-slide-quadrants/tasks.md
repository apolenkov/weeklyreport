# Tasks — Redesign Lead Slide Quadrants (Concept B)

Design decisions D1–D9 live in `design.md`; the spec contract in
`specs/lead-slide-quadrants/spec.md`.

## 1. Tokens (packages/ui)

- [ ] 1.1 `packages/ui/src/styles/globals.css`: add dimension token
      `--slide-quadrant-min` (~120px) next to `--slide-row-min` (:130),
      and named token `--color-status-dot-at-risk: #d4a017` (D6 — names
      the existing literal, zero visual delta).

## 2. Model and shared status mapping (apps/web)

- [ ] 2.1 `slide-product-chips.tsx`: export the worst-status mapping
      (`"red"/"yellow"/"green" → "blocked"/"at-risk"/"on-track"/"empty"`)
      and the dot color-class map; at-risk now references
      `var(--color-status-dot-at-risk)` (D3, D6).
- [ ] 2.2 `section-slide-utils.ts`: add
      `productStatus: "blocked" | "at-risk" | "on-track" | "empty"` to
      `UnifiedSectionRow`; `buildUnifiedSlideModel` maps via the shared
      helper; `cross-product` rows get `"empty"` (D2, D7).
- [ ] 2.3 `status-slide-deck.tsx`: `LeadSlideArticle` reuses the shared
      mapping for its chip entries (delete the inline ternary chain).

## 3. Quadrant rewrite (apps/web)

- [ ] 3.1 `lead-unified-slide.tsx`: rewrite `SectionBlock` into framed
      quadrant cards — card shell + left status stripe per D4, neutral
      headers, per-quadrant `min-h-[var(--slide-quadrant-min)]`, keep
      fullscreen variants on the wrapper; delete `inlineProductMarker`.
- [ ] 3.2 Row rendering: 8px status dot (multi-product only, >1 real
      product excluding `cross-product`) with `title` + sr-only product
      name (D7, D8); keep the gold `P{n}` chip and
      `MAX_ITEMS_PER_SECTION = 4` + "+N more".
- [ ] 3.3 Empty state: dashed placeholder per quadrant ("Nothing in
      flight" / "Nothing queued" / "No risks raised" / "No decisions
      recorded"), reusing the `textList` empty pattern's classes (D5).
- [ ] 3.4 Watermark: large low-opacity quadrant lucide icon in the card
      corner, `aria-hidden`, `overflow-hidden` on the card (D9).

## 4. Tests

- [ ] 4.1 Unit tests for the new contract: empty quadrant renders the
      placeholder (never a bare header); multi-product rows show dots
      with sr-only names and no name column; single-product rows show no
      dots; `buildUnifiedSlideModel` fills `productStatus`. Update any
      existing tests/snapshots that assert the old DOM.

## 5. Verification and acceptance

- [ ] 5.1 Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
      — record results here.
- [ ] 5.2 Live screenshots (servers on :3100): lead "Own" slide in
      normal + fullscreen, multi-product and single-product, an
      empty-quadrant case; before/after pair for user acceptance before
      archiving.
