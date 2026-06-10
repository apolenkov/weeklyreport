# Design — Redesign Head Slide Density

## Context

The lead "Own" slide was rebuilt 2026-06-10 into a strict, framed, neutral
density idiom (`redesign-lead-slide-quadrants`, concept B, four live
feedback rounds, user-accepted). The head deck did not follow — the code
records this gap itself:

```
/* TODO(v8.4.3-slide-redesign): 2-column grid breaks visual rhythm at
   sparse / medium / heavy content density. Redesign to fixed topology
   (min-h + line-clamp or 4-row vertical stack) after density audit ... */
```

(`apps/web/src/components/slides/status-slide-deck.tsx:225-228`, verified.)

Current head render path (verified against code):

```
ReportSlides (variant "head", report-slides.tsx:42-56)
  → StatusSlideDeck (mode "head", status-slide-deck.tsx:309)
    → head sidebar list of leads (:439-483, lg:grid-cols sidebar)
    → HeadSlideArticle (:180-307) for the selected lead
        → owner header + tone badge + metric tiles + AgentReviewComingSoon
        → free-flowing content block (xl:grid-cols-2, :229) ← subject
        → readiness aside (:272-303)
```

The lead idiom, for reference, is `LeadUnifiedSlide`
(`apps/web/src/components/slides/lead-unified-slide.tsx`): a strict
`grid-cols-2 auto-rows-fr` of framed `QuadrantCard`s, neutral headers,
per-card left status stripe from a token, height floor
`min-h-[var(--slide-quadrant-min)]`, no count truncation, watermark icon,
and a neutral `productBadge` for multi-product attribution. Its durable
contract is `openspec/specs/lead-slide-quadrants/spec.md`.

Specific defects on the head slide today (verified against code):

1. Content block is a free-flowing `grid gap-4 xl:grid-cols-2`
   (`status-slide-deck.tsx:229`) of bare `<section>`s — no card frames, no
   height floor, so it collapses at low density and sprawls at high.
2. Section headers carry hue: Risks header is `--color-destructive` (red,
   `:247`), Decisions header is `--color-starbucks-accent` (green, `:257`)
   — the lead idiom moved these to neutral with token stripes.
3. Items render via `textList` with a `limit = 3` default + "+N more"
   (`:104, :115-128`) — count truncation the lead slide dropped in round 2.
4. Decisions section is conditionally hidden when empty (`:255`) rather
   than rendering a framed empty floor.

## Goals / Non-Goals

**Goals:**

- Carry the accepted lead density idiom to `HeadSlideArticle`: framed
  cards, neutral section headers with token-driven left stripes, fixed
  topology (height floor, no rhythm collapse), token-only accents.
- Resolve `TODO(v8.4.3-slide-redesign)` (`status-slide-deck.tsx:225`).
- Keep the head deck legible at the densities the head actually sees —
  many leads, uneven fill, long decision lists.
- Stay inside `status-color-semantics`: section labels neutral, red only
  for blocked, amber only as the at-risk accent, no new color literal.

**Non-Goals:**

- The lead "Own" slide and its durable `lead-slide-quadrants` contract —
  untouched; this change is the parallel head surface.
- The `product`-scope grid (`lead-product-grid.tsx`) — different view.
- New colors, backgrounds, theme tokens (repo visual rule). The lead
  redesign already added every token this surface needs
  (`--slide-quadrant-min`, `--color-decisions-accent`,
  `--color-status-dot-at-risk`, chip-border tokens — `globals.css:51-141`,
  verified); reuse them, add none.
- Any backend / API / schema work — `SectionSlideModel` already carries
  every field the head slide renders (`section-slide-utils.ts:47-71`); no
  tRPC, Prisma, or `@customreport/shared` change, so no data-flow diagram.
- Implementation — this is a CAPTURE-ONLY change. Direction is opened, not
  chosen.

## SAME idiom vs HEAD-specific (the core enumeration)

The proposal promises this enumeration; it is the spine of the design.

**SAME as the lead idiom (carry over verbatim where possible):**

1. Framed cards instead of bare `<section>`s — the established slide-card
   recipe (`lead-unified-slide.tsx:66` shell: border `rgba(0,0,0,0.10)`,
   `border-l-4` token stripe, `rounded-[var(--radius)]`, `bg-white/80`).
2. Neutral section headers — hue moves off the label onto the stripe
   (drops the red Risks header `status-slide-deck.tsx:247` and the green
   Decisions header `:257`), per `status-color-semantics`.
3. Per-card left status stripe from a named token: Current →
   `--color-chip-on-track-border`, Next → `--color-primary`, Risks →
   `--color-chip-at-risk-border`, Decisions → `--color-decisions-accent`
   (same map as `lead-unified-slide.tsx:150-175`).
4. Fixed topology / height floor — no rhythm collapse at sparse density
   (lead uses `min-h-[var(--slide-quadrant-min)]` + `auto-rows-fr`).
5. No count truncation — every row renders (lead dropped "+N more" in
   round 2); the head's `textList` `limit = 3` (`:104`) goes away.
6. Token-only accents, zero new color literals.
7. Watermark lucide icon per card (lead D9) — optional, a taste question.

**HEAD-specific (stays distinct, NOT folded into the lead idiom):**

1. The multi-lead sidebar list (`status-slide-deck.tsx:439-483`) — the
   head navigates across leads; the lead has one section. Out of the
   card-idiom scope; restyle only for consistency, not structure.
2. The per-lead readiness aside (`:272-303`, score gauge + readiness
   checklist) — a head-only review affordance; the lead slide has no
   equivalent. Keep as an aside; do not quadrant-ize it.
3. The 4 metric tiles (Current / Next / Risks / Priority, `:215-220`) —
   head portfolio summary; the lead hero uses a different segmented
   capsule. Open question whether to align the visual treatment.
4. `AgentReviewComingSoon` control (`:221`) — head-only deferred feature;
   keep its `ComingSoonBadge` placement.
5. Owner identity header (lead name + role + products, `:191-213`) — the
   head views many owners; this is the portfolio "who am I looking at"
   anchor, heavier than the lead hero. Stays head-shaped.
6. Multi-lead portfolio framing overall — the head slide answers "how is
   each lead doing" across the deck; the lead slide answers "what is my
   own work". Same idiom, different information scent.

## Decisions

### D1 — New durable capability `head-slide-density`, not an edit to `lead-slide-quadrants`

The lead contract is explicitly lead-only ("It governs the lead slide
surface", `lead-slide-quadrants/spec.md:8-9`) and names the head slide a
Non-goal. A parallel head capability keeps each durable spec scoped to one
surface. Alternative — widen `lead-slide-quadrants` to both surfaces —
rejected: it would couple two surfaces that diverge (sidebar, readiness
aside) and muddy the lead contract.

### D2 — Reuse tokens, add none

Every token the head cards need already exists from the lead redesign
(`globals.css:51-141`, verified). The change references them; it introduces
no `--color-*` or dimension token. This keeps the change inside the repo
visual rule with no sign-off needed.

### D3 — Whether to extract a shared `QuadrantCard` (open lean)

`lead-unified-slide.tsx` owns `QuadrantCard` (`:46-109`). The head cards
want the same shell. Two paths: (a) extract `QuadrantCard` to a shared
module both slides import; (b) head keeps its own card matching the recipe.
Lean: (a) if the shell is truly identical after the taste round, else (b).
Decided at implementation once geometry is settled — flagged, not forced.

### D4 — Head fixed topology: which shape

The TODO offers two options verbatim: "min-h + line-clamp" or "4-row
vertical stack". The lead chose a 2×2 grid with a floor. The head has the
readiness aside competing for width (`xl:grid-cols-[1fr_310px]`, `:188`),
so a head 2×2 may be too narrow. This is the top taste question (see Open
Questions); the spec fixes the invariant (framed + floored + neutral) but
not the exact grid shape, so the user can choose visually.

### D5 — Attribution on the head slide

The lead slide added a neutral product badge per row for multi-product
disambiguation. The head slide groups by LEAD, not product, and the lead
name is already the section anchor. Open question whether head rows need a
product badge at all, or whether per-lead grouping makes it redundant.

## Invariants (load-bearing check)

- **period dual-state** — untouched (no Report/period writes).
- **role-coverage gate** — untouched (no tRPC procedures added/changed).
- **destructive-db guard** — untouched (no DB work at all).
- **deferred-feature pattern** — preserved: `AgentReviewComingSoon`
  (`status-slide-deck.tsx:221`) keeps its coming-soon control; the
  `TODO(v8.4.3-slide-redesign)` deferral is RESOLVED (its redesign lands),
  so the TODO comment is removed, not left orphaned.
- **status-color-semantics (durable spec)** — engaged, preserved: tokens
  only (D2), red reserved for blocked, amber as risk accent not label
  color, neutral section labels; before/after screenshots before archive.
- **status-slide-rendering (durable spec)** — its density rules scope to
  the lead deck and call the head view "out of scope"
  (`status-slide-rendering/spec.md:39, 50`); this change adds the head
  density contract without mutating those lead-scoped requirements.
- **lead-slide-quadrants (durable spec)** — untouched; head is its
  Non-goal.
- **ui-control-density / report-badge-resolution** — not in scope; no
  control rows or badge name resolution touched.

## Risks / Trade-offs

- [Idiom mismatch] The lead 2×2 grid may not fit the head's narrower
  content column (readiness aside steals width) → mitigate via D4: the
  spec fixes the invariant, not the grid shape; settle the shape in the
  screenshot round.
- [Sidebar drift] Restyling the lead sidebar (`:439`) for consistency
  could creep into a structural rewrite → mitigate: sidebar is explicitly
  HEAD-specific, restyle-only, no structure change.
- [Header restyle surprise] Dropping the red Risks / green Decisions
  headers changes a familiar head cue → intentional per the durable
  spec; called out for the screenshot round (same as the lead round).
- [Over-extraction] Forcing a shared `QuadrantCard` before geometry is
  settled couples two diverging surfaces → mitigate via D3: extract only
  if identical after the taste round.
- [Multi-feedback-round cost] The lead slide needed four rounds; the head
  likely needs several too (the user reviews visually) → expected; tasks
  budget a screenshot-acceptance loop, not a one-shot.

## Migration Plan

Pure frontend, no flags, no data migration, no API consumers.

1. Settle the taste questions (Open Questions) with the user first — this
   is capture-only, so implementation does not start until direction is
   chosen.
2. Implement on a feature branch (the head `HeadSlideArticle`, possibly a
   shared card extract per D3).
3. Gates: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`;
   update/extend head-slide unit tests for the new framed/floored DOM.
4. Live screenshot acceptance: head deck with one lead, many leads, an
   empty-section lead, a heavy decisions lead, fullscreen; before/after
   pairs per `status-color-semantics`.
5. Rollback: single `git revert` — no persisted state involved.

## Open Questions — ANSWERED (user sign-off 2026-06-10, recorded verbatim)

All six settled with the user in-session; screenshot acceptance still
applies after implementation (expect taste feedback rounds as on the
lead slide):

1. **Grid shape** (D4): **2×2 like the lead.** If the readiness aside
   makes it visibly cramped during implementation, show the 4-row
   alternative as a screenshot pair before asking again.
2. **Watermark icons** (SAME #7): **yes, carry the lead watermark.**
3. **Attribution** (D5): **yes, head rows keep a product badge** —
   neutral identity badge, never a status hue.
4. **Sidebar treatment**: **restyle to the card idiom** (frames,
   neutral headers).
5. **Metric tiles**: **align to the lead hero's segmented capsule.**
6. **Shared `QuadrantCard` extraction** (D3): **decide after the
   geometry is final** (per recommendation); start head-local, extract
   only if the shells converge.
