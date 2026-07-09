# Tasks: edit-slide-item-inline

## 1. Web — grid model

- [x] 1.1 Extend `GridRow` with `kind` + `stableId`; populate in own-row builders (foreign rows get no editable ref); unit tests for the mapping.
  - Implemented as `editableRef?: { kind, stableId }` on `GridRow`, populated only when an own item/risk/decision has stable lineage. Foreign rows carry no editable ref. Covered by `slide-grid-model.test.ts`.

## 2. Web — interaction + dialog

- [x] 2.1 `SlideArticle`/`ItemRow`: optional `onRowActivate` — double-click + Enter on own rows only; no-op when the prop is absent; focus styles.
  - `SlideArticle`/`SlideProductCard`/`SlideCell` now accept optional row activation. `ItemRow` renders a focusable button-semantic wrapper only when both `editableRef` and `onRowActivate` exist; double-click and Enter call the handler. Covered by `slide-article-rows.test.tsx`.
- [ ] 2.2 Dialog host in `LeadSlidesClient`: resolve record by stableId, embed the lead form's field editors, wire save via the existing mutation for the record kind.
- [ ] 2.3 Delete with confirmation through the existing delete path; grid refresh after save/delete.
- [ ] 2.4 Guards: foreign rows, submitted/locked section, head/viewer decks never bind the handler — tests for each (jsdom dialog recipe: stub ResizeObserver + pointer-capture).

## 3. Verification

- [ ] 3.1 Full web unit suite, `pnpm typecheck`, `pnpm exec eslint apps/web/src/features/slides --max-warnings 0` plus focused ESLint on every touched editor feature file.
- [ ] 3.2 Live-verify on :3000: edit + delete an item from the slide; confirm foreign row and submitted section stay inert.
