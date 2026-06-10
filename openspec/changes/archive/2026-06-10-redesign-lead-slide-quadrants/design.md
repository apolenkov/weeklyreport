# Design — Redesign Lead Slide Quadrants (Concept B)

## Context

User feedback (2026-06-10, slide mode, scope "Own"): the lead slide reads
sparse and messy — four bare sections float on the canvas with dead
whitespace, and the product name repeats on every row. The research memo
(`memos/quadrant-redesign-concepts.md`) offered Concepts A/B/C; the user
chose **Concept B** (2026-06-10): framed quadrant cards, hero legend
dots, and icon watermarks, borrowing Concept A's framed-card shell and
empty-state floor.

Current render path (verified against code, all line refs current):

```
LeadSlidesClient (scope "own")
  → ReportSlides → StatusSlideDeck (mode "lead")
    → LeadSlideArticle (status-slide-deck.tsx:140-184)
      → LeadSlideHero (tone badge + metric tiles)
      → SlideProductChips (only when >1 product, :177-179)
      → LeadUnifiedSlide (lead-unified-slide.tsx) ← subject
```

Specific defects being fixed (memo §"Why it reads sparse", re-verified):

1. No quadrant boundaries — `grid grid-cols-2 gap-3` with bare
   `<section>`s (`lead-unified-slide.tsx:104-106`).
2. Empty section collapses to a lone header — `SectionBlock` renders
   `null` for zero items (`:97`).
3. No height floor outside fullscreen — only `[:fullscreen_&]:min-h-[60dvh]`.
4. `inlineProductMarker` stamps a 130px product-name column with a gray
   dot on every row (`:15-30`).
5. The hero chip strip (`SlideProductChips`) already establishes product
   identity with colored status dots — per-row names duplicate it.

## Goals / Non-Goals

**Goals:**

- Strict 2×2 quadrant grid: Current Work | Next Focus / Risks | Decisions,
  each a framed card with a min-height floor and a real empty state.
- Single-source product attribution: hero chip strip becomes the legend;
  rows carry only an 8px status-colored dot (multi-product only).
- Visually richer within existing tokens: left status stripe per card,
  low-opacity lucide icon watermark in sparse cards.
- Align the slide with the `status-color-semantics` spec: section labels
  neutral (typography-led), red never appears except on blocked-product
  dots, amber only as the risk/at-risk accent.

**Non-Goals:**

- The head slide (`HeadSlideArticle`, same density problem,
  `TODO(v8.4.3-slide-redesign)`) — separate follow-up surface.
- The `product` scope grid (`lead-product-grid.tsx`) — different view.
- New colors, backgrounds, or theme tokens (repo visual rule). One
  exception is D6 below: naming an existing hex as a token, zero visual
  delta on existing surfaces.
- Any backend/API/schema work — purely presentational; no tRPC, Prisma,
  or `@customreport/shared` changes, so no before/after data-flow diagram
  is needed.

## Decisions

### D1 — Concept B with A's shell (user choice, recorded)

Framed quadrant cards + one legend in the hero + per-row colored dots.
Alternatives considered in the memo: A (grouped product sub-headers —
more vertical space per card), C (initials avatars — new component,
collision handling). B chosen by the user as the densest option; the
items matter more than per-row product naming on a status slide.

### D2 — Per-row status travels in the model row

`UnifiedSectionRow` (local to `apps/web` — `section-slide-utils.ts:529`,
NOT a shared schema) gains `productStatus: "blocked" | "at-risk" |
"on-track" | "empty"`. `buildUnifiedSlideModel` already iterates
`slide.productSlides` and sees `product.status`; it maps once at build
time.

Alternative considered: prop-drill a `productName → worstStatus` map from
`LeadSlideArticle` into `LeadUnifiedSlide`. Rejected — duplicates the
derivation the builder already does and couples the component to a second
input that can drift from the rows.

### D3 — Single-source the status mapping and dot colors

The `"red"/"yellow"/"green" → "blocked"/"at-risk"/"on-track"/"empty"`
mapping currently lives inline in `LeadSlideArticle`
(`status-slide-deck.tsx:152-159`); the dot color map lives in
`statusDot` (`slide-product-chips.tsx:15-32`). Both get exported from
`slide-product-chips.tsx` (mapping helper + dot class map) and reused by
the legend chips, the row dots, and the model builder — the legend and
the rows must never disagree on color.

### D4 — Quadrant card shell and stripes (existing tokens only)

- Card: `bg-[var(--color-card)]` (or `bg-white/80` matching sibling slide
  cards), border `rgba(0,0,0,0.10)`, radius `var(--radius)` — the
  established slide-card recipe (`status-slide-deck.tsx:165`).
- Left stripe per quadrant, replacing today's per-row `border-l-2`:
  Current → `--color-chip-on-track-border`, Next → `--color-primary`,
  Risks → `--color-chip-at-risk-border` (amber), Decisions →
  `--color-starbucks-accent`.
- Section headers go **neutral** (muted foreground, weight carries
  hierarchy). Today's red RISKS header (`--color-destructive`) and green
  DECISIONS header are dropped per `status-color-semantics` ("section
  labels neutral; red only for blocked"). Risk identity moves to the
  amber stripe — consistent with the shipped "advisory = amber band"
  precedent.
- Gold `P{n}` priority chip stays unchanged (gold reserved for
  priorities).

### D5 — Empty state and floor

- Placeholder when a quadrant has zero rows: dashed-border block reusing
  the `textList` empty pattern's classes (`status-slide-deck.tsx:104-110`),
  copy per quadrant ("Nothing in flight" / "Nothing queued" / "No risks
  raised" / "No decisions recorded" — exact strings at implementation,
  English per UI-strings rule).
- Floor: new **dimension** token `--slide-quadrant-min` (~120px) in the
  slide token block next to `--slide-row-min` (globals.css:130). A
  dimension token is not a color/theme token, so it needs no sign-off.
  Alternative considered: reuse `--slide-row-min` (80px) — too small for
  a card with header + placeholder.
- Keep the fullscreen behavior (`[:fullscreen_&]:min-h-[60dvh]` +
  `content-between`) on the grid wrapper.
- `model.emptyProducts` stays available for a future per-product empty
  note; the placeholder trigger is simply `items.length === 0`
  (alternative — rendering per-product "Vega: nothing" notes inside
  partially-filled quadrants — rejected as noise).

### D6 — Tokenize the at-risk dot hex (flagged for review)

`statusDot` hardcodes `#d4a017` for at-risk. Reusing the map for the new
row dots would propagate a hardcoded status literal into a new surface,
which `status-color-semantics` forbids. Fix: name the existing value as
`--color-status-dot-at-risk: #d4a017` and reference it in the map. Zero
visual delta anywhere (same hex, now named). This is a naming refactor,
not a palette change, but it is called out here and in tasks so the user
sees it during screenshot review.

### D7 — Multi-product gating

- Row dots and the legend render only when the slide has >1 real product
  (excluding the `cross-product` pseudo-entry, same filter the chips use
  today). Single product → flat rows, no dots, no legend — nothing to
  disambiguate.
- `cross-product` rows ("Shared context") get the muted "empty" dot with
  `title="Shared context"`; they never appear in the legend.
- Rows cap stays `MAX_ITEMS_PER_SECTION = 4` + "+N more"; legend wraps
  at 4+ products.

### D8 — Non-color attribution cues (WCAG 1.4.1)

Color-only product attribution would fail color-blind users. Each row dot
carries `title={productName}` and a visually-hidden (`sr-only`) product
name for screen readers; the legend remains the primary index; the gold
`P{n}` chip is unaffected. This mirrors the recorded WCAG note from
`apply-status-palette`.

### D9 — Watermark icon

Each card gets its quadrant's lucide icon (`Target` / `ArrowRight` /
`AlertTriangle` / `FileText` — already imported) absolutely positioned in
the bottom-right corner, large, `aria-hidden`, very low opacity on the
existing foreground color (opacity on an existing color, no new token).
`overflow-hidden` on the card clips it.

## Invariants (load-bearing check)

- **period dual-state** — untouched (no Report/period writes).
- **role-coverage gate** — untouched (no tRPC procedures added/changed).
- **destructive-db guard** — untouched (no DB work at all).
- **deferred-feature pattern** — untouched (nothing deferred here; the
  head-slide `TODO(v8.4.3-slide-redesign)` stays as-is).
- **status-color-semantics (durable spec)** — engaged, preserved: tokens
  only (D4, D6), red reserved for blocked (D4), amber as risk accent not
  label color (D4), screenshot acceptance before archive (below).
- **ui-control-density / report-badge-resolution** — not in scope; no
  control rows or badge name resolution touched.

## Risks / Trade-offs

- [Color-leaning attribution] Dots index products by hue → mitigated by
  D8 (title + sr-only + legend) and the priority chip as a secondary cue.
- [Stripe semantics drift] Quadrant stripes could read as item status →
  mitigated by using border-strength tokens (not fills), neutral labels,
  and live screenshot review; colors are easy to mute in review.
- [Header restyle surprise] Dropping the red RISKS header changes a
  familiar cue → intentional per the durable spec; called out for the
  screenshot round.
- [Fullscreen regression] The grid wrapper changes → keep the fullscreen
  variants verbatim and check fullscreen during acceptance.
- [Unused `priorities` field] The model still builds `priorities[]`
  (merged into items at render since `08b57744`) → out of scope; not
  touched.

## Migration Plan

Pure frontend, no flags, no data migration, no API consumers.

1. Implement on `main` (token + 3 component files + model builder).
2. Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`;
   update/extend the existing slide unit tests for the new row shape.
3. Live screenshot acceptance (servers already on :3100/:3101): 1-product,
   2-3-product, empty-quadrant, and fullscreen states; before/after pairs
   per the `status-color-semantics` spec requirement.
4. Rollback: single `git revert` — no persisted state involved.

## Open Questions

None blocking. Exact placeholder strings, stripe widths, watermark
opacity, and `--slide-quadrant-min` value are tuned during the screenshot
acceptance loop — the user reviews visually and iterates live.

## Addendum — feedback round 2 (2026-06-10, live screenshot review)

User direction during acceptance, folded into the same change:

1. The quadrant grid keeps a vertical floor in the normal view too
   (`min-h-[52dvh]`), so the four cards distribute evenly instead of
   hugging content (fullscreen 60dvh floor unchanged).
2. **Decisions accent is blue, not green** — new named token
   `--color-decisions-accent: #4a7494` (steel blue matched to chip-border
   weight). Recorded color sign-off: user, 2026-06-10 («Decisions давай
   синеньким») — satisfies the research-gate rule.
3. The Next focus (plans) card renders a **dashed frame** ("not yet"
   semantics); its left stripe stays solid.
4. **No count-based truncation** — `MAX_ITEMS_PER_SECTION` and the
   "+N more" line are removed; every row always renders (supersedes the
   cap mentioned in D7).
5. Hero is a one-line **status strip** (frontend-design pass): tone badge
   - author + one segmented metric capsule (icon + value + label per
     segment, hairline dividers) — all static, LEFT, one h-11 height; the
     interactive scope toggle is alone on the right.

## Addendum — feedback round 3 (2026-06-10, live review)

6. **Row dots → neutral product badges.** Seeing real data, the user read
   a status-colored dot as the ROW's own severity ("why is this decision
   red?"). Rows now carry a compact neutral badge with the product name
   (muted fill, truncate + title); status color stays exclusively on the
   chip strip. Supersedes D2/D3's per-row dot: `productStatus` was
   removed from `UnifiedSectionRow`, `STATUS_DOT_CLASS` is module-private
   again; `mapTrafficLightToStatus` remains the single mapping for the
   chip strip. The WCAG 1.4.1 concern (D8) dissolves — badges are text.
