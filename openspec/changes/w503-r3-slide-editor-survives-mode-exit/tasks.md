# Tasks

## 1. Specification

- [x] 1.1 Validate with `pnpm exec openspec validate w503-r3-slide-editor-survives-mode-exit --strict`.

## 2. Web

- [x] 2.1 RED: `LeadForm` test opens a Slides editor, types, switches `mode` from `slides` to `overview` and expects the same dialog node and text with the Overview rendered; Cancel then unmounts the branch; no editor unmounts it at once.
- [x] 2.2 GREEN: `hasOpenDialog` from `useSlideInlineEditor`, `onEditorOpenChange` on `LeadSlidesClient`, hold in `LeadForm` above the mode switch.

## 3. Verification

- [x] 3.1 Focused vitest, prettier, eslint and web typecheck.
