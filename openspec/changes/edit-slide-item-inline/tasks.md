# Tasks: edit-slide-item-inline

## 1. Web — grid model

- [ ] 1.1 Extend `GridRow` with `kind` + `stableId`; populate in own-row builders (foreign rows get no editable ref); unit tests for the mapping.

## 2. Web — interaction + dialog

- [ ] 2.1 `SlideArticle`/`ItemRow`: optional `onRowActivate` — double-click + Enter on own rows only; no-op when the prop is absent; focus styles.
- [ ] 2.2 Dialog host in `LeadSlidesClient`: resolve record by stableId, embed the lead form's field editors, wire save via the existing mutation for the record kind.
- [ ] 2.3 Delete with confirmation through the existing delete path; grid refresh after save/delete.
- [ ] 2.4 Guards: foreign rows, submitted/locked section, head/viewer decks never bind the handler — tests for each (jsdom dialog recipe: stub ResizeObserver + pointer-capture).

## 3. Verification

- [ ] 3.1 Full web unit suite, `pnpm typecheck`, `pnpm exec eslint apps/web/src/features/slides --max-warnings 0` plus focused ESLint on every touched editor feature file.
- [ ] 3.2 Live-verify on :3000: edit + delete an item from the slide; confirm foreign row and submitted section stay inert.
