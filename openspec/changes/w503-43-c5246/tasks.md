# Tasks

## 1. Red

- [x] 1.1 Add a jsdom test in `apps/web/src/shared/ui/dialogs/confirm-delete-dialog.test.tsx` (C5246 block): the opener is removed while the dialog closes and a fallback container is passed; expect the container to hold focus. Confirm it fails before the source change.

## 2. Green

- [x] 2.1 Add `restoreFocusFallbackRef` to `dialog-focus.ts`, `dialog.tsx` and `ConfirmDeleteDialog`.
- [x] 2.2 Pass the deck container from `LeadSlidesClient` through the slide inline editor hooks into `SlideInlineEditorDialogs`, and set `tabIndex={-1}` on the deck root.

## 3. Verification

- [x] 3.1 `pnpm exec openspec validate w503-43-c5246 --strict`
- [ ] 3.2 Run the six gates on the final tree and record exit codes in `fix-503-43-RESULT.md`
