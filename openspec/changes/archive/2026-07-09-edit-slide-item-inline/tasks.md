# Tasks: edit-slide-item-inline

## 1. Web — grid model

- [x] 1.1 Extend `GridRow` with `kind` + `stableId`; populate in own-row builders (foreign rows get no editable ref); unit tests for the mapping.
  - Implemented as `editableRef?: { kind, stableId }` on `GridRow`, populated only when an own item/risk/decision has stable lineage. Foreign rows carry no editable ref. Covered by `slide-grid-model.test.ts`.

## 2. Web — interaction + dialog

- [x] 2.1 `SlideArticle`/`ItemRow`: optional `onRowActivate` — double-click + Enter on own rows only; no-op when the prop is absent; focus styles.
  - `SlideArticle`/`SlideProductCard`/`SlideCell` now accept optional row activation. `ItemRow` renders a focusable button-semantic wrapper only when both `editableRef` and `onRowActivate` exist; double-click and Enter call the handler. Covered by `slide-article-rows.test.tsx`.
- [x] 2.2 Dialog host in `LeadSlidesClient`: resolve record by stableId, embed the lead form's field editors, wire save via the existing mutation for the record kind.
  - Implemented through `useSlideInlineEditor` + `SlideInlineEditorDialogs`: rows resolve by `{kind, stableId}`, reuse item/risk/decision edit dialogs, and call `reports.saveDraft` with `sectionToDraftPayload` preserving stable lineage. Covered by `lead-slides-client.test.tsx`.
- [x] 2.3 Delete with confirmation through the existing delete path; grid refresh after save/delete.
  - Dialogs expose Delete, route through `ConfirmDeleteDialog`, remove the stable record from the draft payload, invalidate/refetch lead form data, and close on mutation success. Covered by delete payload assertion in `lead-slides-client.test.tsx`.
- [x] 2.4 Guards: foreign rows, submitted/locked section, head/viewer decks never bind the handler — tests for each (jsdom dialog recipe: stub ResizeObserver + pointer-capture).
  - Covered by `lead-slides-client.test.tsx` for foreign author, read-only, and submitted sections; `status-slide-deck.test.tsx` confirms head decks do not forward row activation.

## 3. Verification

- [x] 3.1 Full web unit suite, `pnpm typecheck`, `pnpm exec eslint apps/web/src/features/slides --max-warnings 0` plus focused ESLint on every touched editor feature file.
  - Verified: `cd apps/web && pnpm exec vitest run` (158 files / 1577 tests), `pnpm typecheck`, and scoped ESLint on `apps/web/src/features/slides` plus all touched editor/serializer/footer files with `--max-warnings 0`.
- [x] 3.2 Live-verify on :3000: edit + delete an item from the slide; confirm foreign row and submitted section stay inert.
  - Verified from source app: API `localhost:3002`, web `localhost:3000`, Google Chrome via Playwright. Edited an own current item from the slide and saw the updated row text without reload; deleted an own next-week item through confirmation and saw the row disappear; foreign author deck and submitted own deck both had zero `[aria-label^="Edit "]` row activation buttons.
