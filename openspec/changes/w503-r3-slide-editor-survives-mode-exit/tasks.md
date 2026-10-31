# Tasks

## 1. Specification

- [x] 1.1 Validate with `pnpm exec openspec validate w503-r3-slide-editor-survives-mode-exit --strict`.

## 2. Web

- [ ] 2.1 RED: lead form test opens a Slides editor, types, leaves Slides mode and expects the dialog and text to remain; Cancel then unmounts the deck; no editor unmounts at once.
- [ ] 2.2 GREEN: `hasOpenDialog` from `useSlideInlineEditor`, `onEditorOpenChange` on `LeadSlidesClient`, hold in `LeadFormLoaded`.

## 3. Verification

- [ ] 3.1 Focused vitest, prettier, eslint and web typecheck.
