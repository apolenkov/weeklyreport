# Tasks: redesign-lead-slide-by-product-grid

## 1. Pure view model (TDD)

- [x] 1.1 Create `apps/web/src/components/slides/slide-grid-model.ts` (+ rows/cells/foreign split) + `slide-grid-model.test.ts`: `buildSlideGridModel` — products (with no-data collapse flag) → product-level + project subsections → per-column rows.
- [x] 1.2 Cell sorting: first stage's `STAGE_NAMES` index, then author (lead first), stable; unit tests incl. stage-less legacy rows.
- [x] 1.3 Author color assignment: deterministic ≤6-token cycle, lead first, stable across renders.
- [x] 1.4 Author series collapsing: consecutive same-author rows per cell → `showAuthorBadge` flags; tests.
- [x] 1.5 Priority strip model: items with `priorityRank` only, rank asc; header stats (counters, worst status, N-of-M on track); tests.
- [x] 1.6 Status badge map (open record): COMPLETED / IN PROGRESS (blocked coerces) / PLANNED / AT RISK; risk severity `blocked` → highlight flag; tests.

## 2. Slide article component

- [x] 2.1 Build `SlideArticle` (slide-article.tsx + header/grid/rows subfiles): header, priority strip, single column-header row, product cards, legend; tokens only, no raw hex.
- [x] 2.2 Canvas geometry: centered max-w 1088 / min-w ~900 / min-h 680 via tokens, auto-height, no clipping; deck wrapper scrolls horizontally.
- [x] 2.3 Item row: initials badge (+spacer variant), optional P-badge, wrapping text, status badge, blocker row highlight (Risks only, right edge flush), stage watermark icons via `STAGE_ICONS` with `title` tooltips (product-level rows only).
- [x] 2.4 Summary/Product toggle wired to existing chips; re-click unscopes.
- [x] 2.5 a11y: DOM order = visual column order; RTL tests for render contract (badges, series collapse, empty cell "—", collapsed no-data product, legend role suffix) — covered in status-slide-deck.test.tsx.

## 3. Deck integration

- [x] 3.1 Route lead AND head section slides through `SlideArticle` on all three surfaces; keep pagination, fullscreen, Mine/Everyone intact; `grid` field threaded through buildSectionSlideModel/paginate; health fold pre-applied; Everyone rows reach the grid with author identity.
- [x] 3.2 Rewrite `status-slide-deck.test.tsx` for the new contract (fixtures via buildSectionSlideModel).

## 4. Deletions

- [x] 4.1 Delete `lead-unified-slide.tsx`, `lead-product-grid.tsx`, `lead-slide-hero.tsx`, `lead-slides-product-view.tsx`, `HeadSlideArticle`/`HeadSectionCard`, `buildUnifiedSlideModel`/`scopeSlideToProduct` + Unified types, and their tests.
- [x] 4.2 Delete `slide-fit-advisory.tsx` (+ test) and `SLIDE_SECTION_SOFT_CAP` from `@customreport/shared`; remove call sites in lead form sections.
- [x] 4.3 Grep-verify no orphan imports/tokens (`SLIDE_SECTION_SOFT_CAP`, `firstOverCapRowIds`, deleted component names).

## 5. Verify

- [x] 5.1 Full gate: `pnpm --filter @customreport/api db:generate && pnpm typecheck && pnpm lint && pnpm test` (FULL web suite — no folder scoping).
- [ ] 5.2 Live-verify from source (`pnpm --filter @customreport/web dev`): lead deck, head present, viewer present; dense seed for auto-height; fullscreen scroll; Product mode scoping.
- [x] 5.3 UI-string check on changed files: `grep -nE '[а-яА-Я]'` — hits only in data/comments/tests.
