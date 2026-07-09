# Design: redesign-lead-slide-by-product-grid

Decision log source: grill session 2026-07-05 (Саша + Codex adviser, both recommendations recorded per question). Reference mock: "Слайд 1b — спецификация" (Claude Design project; layout only — mock hex values are NOT adopted).

## Architecture

```
status-slide-deck.tsx
  └── SlideArticle (new, replaces LeadSlideArticle + HeadSlideArticle)
        ├── SlideGridHeader    (pill, name, counters, N-of-M chip, mode toggle)
        ├── SlidePriorityStrip (items with priorityRank only)
        ├── SlideColumnHeaderRow (Current/Next/Risks/Decisions — once per slide)
        ├── SlideProductCard × N (stripe + dot; Product-level → project subsections)
        │     └── SubsectionRow (shared grid 1.15fr 1fr 1.1fr 1fr → 4 cells)
        └── SlideLegend        (contributors, optional role)

slide-grid-model.ts (+ slide-grid-rows/cells/foreign — pure modules)
  buildSlideGridModel({section, productStatuses, foreign}) → view model:
    product → [product-level, ...projects] → per-column sorted rows
    + author color assignment + author series collapsing + priority strip + header stats
```

## Key decisions

1. **Colors**: existing tokens only; mock supplies layout. No raw hex in TSX (repo no-magic-literals law; slides were just tokenized). Author cycle + canvas dimensions become named tokens in `packages/ui/src/styles/globals.css` referencing existing palette vars.
2. **Author identity**: deterministic cycle of 6 token colors assigned per slide — lead first (darkest), contributors in stable name order. >6 authors: cycle repeats, initials + `title` disambiguate — accepted.
3. **Author series**: badge only on the first of consecutive same-author rows within a cell; invisible fixed-width spacer keeps text alignment on following rows.
4. **Canvas**: centered, `max-width: 1088px`, `min-width: ~900px` (horizontal scroll below), `min-height: 680px`, auto-grow, zero clipping/truncation; fullscreen scrolls. Reverses the 2026-06-21 scroll-only-in-frame decision. Compromise adjudicated over Codex's fixed-1088 preference: ≥1280 viewports see the mock 1:1; the min-width floor protects the fr-column proportions Codex worried about.
5. **Scopes**: Product and Leads scope are shell-owned; both feed the same article layout. No separate Product layout remains. The old deck-level Own/Product ScopeToggle and `LeadSlidesProductView` are superseded and deleted.
6. **Statuses**: item `blocked` coerces to IN PROGRESS on this surface (existing convention); blocker semantics only via `riskSeverity: "blocked"` → row highlight, no badge, Risks column only. Badge map is an open record so future statuses (paused/postponed — deferred, task #1) slot in.
7. **Sorting**: cell rows by first stage's `STAGE_NAMES` index (alias-folded via `normalizeStageName`), then author (lead first), stable. Priority strip: rank asc, lead first on ties, items only (risks/decisions have no `priorityRank` — verified in schema).
8. **Stage icons**: reuse `STAGE_ICONS` from `stage-chip-config.ts`; watermark = absolute bottom-right, low opacity, `title` tooltip; product-level rows only (schema forbids stages on activity-parent records anyway). NOTE: record `stageIds` actually carry stage NAMES (text[], legacy field name) — no id→name mapping needed.
9. **Deletions in the same change** (repo dead-code rule): `LeadUnifiedSlide`, `LeadProductGrid`, `LeadSlideHero`, `LeadSlidesProductView`, `HeadSlideArticle`/`HeadSectionCard` (in-file), `buildUnifiedSlideModel`/`scopeSlideToProduct` + Unified types, `SlideFitAdvisory`, `SLIDE_SECTION_SOFT_CAP`, plus their tests (~1470 lines). Codex verified no other consumers.
10. **Pure model modules**: grouping/sorting/color-assignment lives in `slide-grid-model.ts` + `slide-grid-rows.ts` + `slide-grid-cells.ts` + `slide-grid-foreign.ts` (max-lines 250 forces the split), NOT in `section-slide-utils.ts` (already 1000+ lines). Unit-test the model; RTL-test the article's render contract via the deck; snapshots minimal.
11. **a11y**: DOM order = visual column order; icon-only affordances keep sr-only text.
12. **Authorship reality (discovered during apply)**: records carry NO per-record author — the section author owns every own row. Multi-author rows exist ONLY via the Everyone merge: `CrossAuthorContentRow` already ships `authorId`/`authorName` (+ per-record `stageNames`); only the old slide adapter anonymized them. The new grid model keeps foreign author identity, so Mine = single-author slide, Everyone = multi-author slide. Foreign rows carry no `priorityRank` (documented Decision 8) — the priority strip stays own-only. No data-model change.
13. **Activity placement (discovered during apply)**: today activity-parented records NEVER reach the slide grid (pills lane only) — the new grid surfaces them as project subsections. Placement rule: an activity with exactly ONE linked product renders under that product; zero or multiple linked products → under the "Shared context" card (no duplication, counters stay honest). The grid model is computed inside `buildSectionSlideModel` (a `grid` field on `SectionSlideModel`) so pagination/scoping/Everyone-merge thread through the existing plumbing; the health fold is applied to product statuses BEFORE the grid derives its cards. Activities already shown as grid subsections leave the pills lane (pills keep surfacing status-only activities).

## What survives untouched

- Deck pagination/carousel (pages now slice `grid.products` in step with `productSlides`), fullscreen affordances, Mine/Everyone visibility gates, product chips component, `SectionSlideModel` deck chrome fields.
- Admin product-count advisory (slide-capacity-signals) — only the section-fit advisory dies.

## Risks

- Big deletion surface: run the FULL web unit suite, not folder-scoped (prior red-tree incident).
- `status-slide-deck.test.tsx` is rewritten for the new contract, fixtures built through `buildSectionSlideModel` (realistic integration), not hand-rolled models.
- Live-verify from source (`pnpm --filter @customreport/web dev`) — docker web image is stale.
- 2026-07-05: a parallel session's `git reset --hard` on the shared tree wiped the first uncommitted implementation; work restored and now proceeds committed, in a dedicated worktree (`worktree-slide-1b-redesign`).
