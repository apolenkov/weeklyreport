# Lead Slide ("Own" scope) — Design Critique + Four-Quadrant Redesign Concept

**Status:** capture-only memo. Read-only research. No files edited. Implementation needs explicit user direction.
**Date:** 2026-06-10
**Scope:** the lead's own-status slide — `CURRENT WORK / NEXT FOCUS / RISKS / DECISIONS`.

---

## Current state

### What renders the "Own" slide (the exact path)

The slide the user is complaining about is **not** `lead-product-grid.tsx`. That file (the `ProductCard` grid) only renders the **`product`** scope (`apps/web/src/components/slides/lead-slides-client.tsx:165-195`). The complaint is the **`own`** scope, which takes the deck path:

```
LeadSlidesClient (scope === "own")            lead-slides-client.tsx:197-231
  → ReportSlides                              report-slides.tsx
    → StatusSlideDeck (mode "lead")           status-slide-deck.tsx:315
      → LeadSlideArticle                      status-slide-deck.tsx:140-184
        → LeadSlideHero                        lead-slide-hero.tsx (tone badge + 4 metric tiles)
        → SlideProductChips (if >1 product)    slide-product-chips.tsx (colored dots + name)
        → LeadUnifiedSlide                     lead-unified-slide.tsx   ← THE 4 SECTIONS
```

So `LeadUnifiedSlide` (`lead-unified-slide.tsx`) is the actual subject. It is already a 2-column grid — but the structure is what reads sparse and messy.

### Why it reads sparse / messy (specific causes)

1. **No quadrant boundaries.** `lead-unified-slide.tsx:104-106` is `grid grid-cols-2 gap-3` with **no card, border, or fill per cell**. The four `<section>`s are bare header + list, floating on the cream canvas. There is nothing that says "these are four equal zones" — they read as four loose text blobs.

2. **Empty sections collapse to a header.** `SectionBlock` renders **nothing** when `items.length === 0` (`lead-unified-slide.tsx:68-97` — the `: null` branch). The model already computes `emptyProducts` per section (`section-slide-utils.ts:542-548`) but `LeadUnifiedSlide` **never reads it**. So an empty RISKS quadrant is just the word "RISKS" with a void beneath it — this is the dead whitespace below the columns the user sees.

3. **Free / unequal row heights.** `auto-rows-fr` (`:105`) equalizes the _two rows_ of the grid, but each row's height is driven by its tallest cell. A heavy "Current work" next to an empty "Next focus" stretches one cell and leaves its neighbor with a tall empty gap. There is no per-quadrant `min-height` except a fullscreen-only `min-h-[60dvh]` (`:105`), so in the normal (non-fullscreen) embedded view the grid has no floor and content "floats."

4. **Product name repeated on every row.** `inlineProductMarker` (`lead-unified-slide.tsx:15-30`) stamps a fixed **130px** column with the product name in uppercase + a **generic gray dot** on _every list item_ in _every quadrant_. With 1 product this is pure redundancy (every row says the same name); with 2-3 products it eats ~40% of each row's width before the actual text begins (`border-l-2 … pl-3`, `:84`). This is exactly "what's the point of listing them."

5. **The hero already carries a product legend that the rows duplicate.** `SlideProductChips` (`status-slide-deck.tsx:177-179`) renders **colored status dots + product name** above the quadrants whenever there's more than one product. So product identity is _already_ established once at the top — repeating the name per row adds nothing the chip strip didn't already say, and the per-row dot is gray (no status) while the chip dot is colored (better).

> Note: a `TODO(v8.4.3-slide-redesign)` already flags the **head** variant's 2-col grid for the same "breaks visual rhythm at sparse/medium/heavy density" problem (`status-slide-deck.tsx:231-234`). The lead variant has the same root cause.

---

## Concepts

All three are a **strict 2×2 grid**, top-left→bottom-right reading order:
`Current Work | Next Focus` over `Risks | Decisions`. Each quadrant is a real bordered card with a fixed floor so the slide never collapses.

**Lucide icons per quadrant** (already imported in `lead-unified-slide.tsx:3`, keep them):
`Target` = Current work · `ArrowRight` = Next focus · `AlertTriangle` = Risks · `FileText` = Decisions.

---

### Concept A — "Four framed cards" (closest to today, lowest risk)

Wrap each section in a white card with a colored **left status stripe** (the repo's established status language), kill the per-row product column, and give every card a `min-height` floor with a real empty state.

```
┌─ hero: tone badge · name · 4 metric tiles ──────────────────┐
│ [product chips: ● Atlas  ● Vega  ● Orion]  (legend, 1×)     │
├──────────────────────────────┬──────────────────────────────┤
│▎◎ CURRENT WORK               │▎→ NEXT FOCUS                 │
│  P1 Atlas · ship auth flow   │   Vega · spike pricing model │
│     Atlas · migrate sessions │   Orion · draft RFC          │
│     Vega · QA pass           │                              │
│  (min-h floor keeps card)    │   (empty → dashed "Nothing   │
│                              │    queued" placeholder)      │
├──────────────────────────────┼──────────────────────────────┤
│▎⚠ RISKS  (amber stripe)      │▎▤ DECISIONS                  │
│   Atlas · vendor SLA slip    │   Vega · go with Postgres    │
│   ─ dashed empty if none ─   │   Orion · defer mobile       │
└──────────────────────────────┴──────────────────────────────┘
```

- **Products without per-row labels:** drop `inlineProductMarker`'s 130px column. Instead **group rows by product inside each card** — a tiny product header line (colored dot + name, shown once) followed by that product's items indented under it. With 1 product, suppress the header entirely (there's nothing to disambiguate). Color of the dot = product worst-status, matching the chip legend in the hero so the two read as one system.
- **Empty quadrant:** dashed-border placeholder ("No risks raised" / "Nothing queued") reusing the existing `textList` empty pattern (`status-slide-deck.tsx:104-110`) so the card keeps its footprint.
- **Scale 1→4+ products:** 1 product → flat list, no product headers. 2-3 → grouped with one-line product sub-headers. 4+ → cap visible rows per card (the existing `MAX_ITEMS_PER_SECTION = 4`, `:45`), append "+N more"; product chips in the hero already give the full roster.

---

### Concept B — "Quadrant with product legend dots" (most data-dense, recommended core)

Same 2×2 framed grid as A, but products are shown as **colored dots only inline** (no name on the row) + a **single legend in the hero** mapping dot color/position → product. This is the leanest way to keep product attribution without repeating the name.

```
┌─ hero ──────────────────────────────────────────────────────┐
│ tone badge · name · metrics                                 │
│ Legend:  ● Atlas   ● Vega   ● Orion        (colored chips)  │
├──────────────────────────────┬──────────────────────────────┤
│ ◎ CURRENT WORK               │ → NEXT FOCUS                 │
│  ● P1 ship auth flow         │  ● spike pricing model       │
│  ● migrate sessions          │  ● draft RFC                 │
│  ● QA pass                   │                              │
│                              │  ·· nothing queued ··        │
├──────────────────────────────┼──────────────────────────────┤
│ ⚠ RISKS                      │ ▤ DECISIONS                  │
│  ● vendor SLA slip           │  ● go with Postgres          │
│  ·· no risks raised ··       │  ● defer mobile              │
└──────────────────────────────┴──────────────────────────────┘
```

- **Dot = product, color = product's worst status**, reusing `SlideProductChips`' `statusDot` color map (`slide-product-chips.tsx:15-32`). The legend is literally the existing chip strip, relabeled "Legend." Hover/`title` on each row dot repeats the product name for the detail-seeker without spending row width.
- **Empty quadrant:** same dashed placeholder as A.
- **Scale:** dots stay a fixed 8px regardless of product count; 1 product → drop the legend and the dots (single-source, nothing to map). 4+ products → the legend wraps; rows still cap at 4 + "+N more." This is the densest of the three and the best fit for a status slide where the _items_ matter more than which product they belong to.

> Honest caveat: color-only attribution leans on hue. Keep the `title`/hover name and the priority `P{n}` chip (`lead-unified-slide.tsx:32-43`) as the non-color cues so it doesn't fail color-blind users — the dots are a _secondary_ index, the legend is the primary one.

---

### Concept C — "Initials-avatar quadrants" (most visual, highest new-surface cost)

Same framed 2×2, but each row leads with a small **rounded initials avatar** (e.g. `AT` for Atlas) tinted by status, instead of a dot or a name.

```
├──────────────────────────────┬──────────────────────────────┤
│ ◎ CURRENT WORK               │ → NEXT FOCUS                 │
│ (AT) P1 ship auth flow       │ (VE) spike pricing model     │
│ (AT) migrate sessions        │ (OR) draft RFC               │
│ (VE) QA pass                 │                              │
└──────────────────────────────┴──────────────────────────────┘
```

- Avatars are more scannable than dots at a glance and give the "more interesting visually" the user asked for, but they introduce a **new component** (initials derivation, collision handling for two products sharing initials) and more visual weight per row. The legend in the hero would map `AT → Atlas`.
- **Empty quadrant / scale:** same floor + placeholder; 1 product → suppress avatars. 4+ → initials collisions get a numeric suffix, which is fiddly.

On "icons/illustration per quadrant": the cleanest interpretation that stays on-brand is a **large, low-opacity lucide quadrant icon watermarked in the empty corner of each card** (the same `Target`/`ArrowRight`/`AlertTriangle`/`FileText`), which fills sparse cards visually without any new asset or color. Full per-quadrant illustrations would mean new SVG assets and likely new colors — out of scope under the repo's visual rule.

---

## Recommendation

**Concept B (quadrant + hero legend dots), borrowing Concept A's framed-card shell and empty-state floor.** It directly answers all three complaints:

1. **Four-quadrant** — real bordered cards in a 2×2 grid with per-quadrant `min-height` floors, so the slide reads as four equal zones and never collapses into floating columns.
2. **No repeated names** — product identity moves to a _single_ legend in the hero (the existing chip strip) + an 8px colored dot per row; the 130px name column is deleted entirely.
3. **More interesting visually** — colored left status stripe per card + a low-opacity watermark of the quadrant's lucide icon fills sparse cards, all within existing tokens.

### Files that would change

| File                                                     | Change                                                                                                                                                                                                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/slides/lead-unified-slide.tsx`  | Core rewrite. Replace bare-grid `SectionBlock` with framed-card quadrants; delete `inlineProductMarker` (`:15-30`); add row dot + empty-state placeholder; read `model.emptyProducts` (already built, `section-slide-utils.ts:542-548`) for the empty branch. |
| `apps/web/src/components/slides/slide-product-chips.tsx` | Reuse as the hero legend (already rendered at `status-slide-deck.tsx:177-179`); possibly expose the `statusDot` color map for the row dots so colors stay single-sourced.                                                                                     |
| `apps/web/src/components/slides/status-slide-deck.tsx`   | `LeadSlideArticle` (`:140-184`) — relabel/position the chip strip as "Legend"; no structural change.                                                                                                                                                          |

No model changes needed — `UnifiedSlideModel` already carries `emptyProducts` and per-row `priorityRank`/`productName`. The redesign is purely presentational.

### Token discipline

Stays inside the existing palette — **no new colors:**

- Status stripes/dots → `--color-chip-on-track-border` / `--color-chip-at-risk-border` / `--color-chip-blocked-border` (globals.css:49-57) and the `statusDot` map already in `slide-product-chips.tsx`.
- Card surfaces → `--color-card`, borders `rgba(0,0,0,0.10)`, radius `--radius` (as every other slide card already does).
- Priority chip → keep `--color-starbucks-gold` (`lead-unified-slide.tsx:37`), priorities-only, unchanged.
- Per-quadrant `min-height` → reuse `--slide-row-min` (80px, globals.css:130) or a new slide-local token, not a magic number.

The repo's **"Visual And Theme Work"** rule means: this layout/structure work is fine on existing tokens, but **any new color, background, or theme token needs explicit user sign-off first.** The watermark-icon idea uses opacity on existing foreground colors, so it stays inside the rule.

---

## Out of scope

- This memo is **capture-only**. No code was changed; all four target files were read read-only.
- **Implementation requires explicit user direction** on: (1) which concept, (2) confirmation that grouping-by-product vs. flat-with-dots is the desired product-attribution model, (3) sign-off if any genuinely new color/token turns out to be needed (none is proposed, but the watermark/illustration direction is the likeliest place one would creep in).
- The **head** variant (`HeadSlideArticle`, `status-slide-deck.tsx:186-313`) has the same `TODO(v8.4.3-slide-redesign)` density problem but is a separate surface; aligning it is a follow-up, not part of this lead-slide change.
- The **`product`** scope grid (`lead-product-grid.tsx`) is untouched by this concept — it's a different view and not the subject of the complaint.
