# Tasks

## shared

- [ ] 1. Spike: pin the latest stable `@dnd-kit/core` in `apps/web` and
      smoke-test Overview drag against React 19 / React Compiler before
      feature work (design decision validation, no product behaviour).
- [ ] 2. Add the Next→Current placement-only move patch builder in
      `@weeklyreport/shared`, symmetric to the existing Current→Next
      `buildMoveItemPatch`: preserve progress, text, and `stableId`, clear
      `carriedOver`, and reject when the target week already holds an active
      occurrence for the same `stableId`.
- [ ] 3. Extend the shared `DraftPatch` validation for the description-only
      inline-edit patch (trim; reject empty/whitespace at the boundary).

## api

- [ ] 4. Accept both placement-only move directions and the description-only
      patch in `saveSection` through the existing canonical draft save path;
      add service tests for both directions, the `stableId` duplicate
      rejection, and the atomic `periodState`/lifecycle-tuple update.

## web

- [ ] 5. DnD layer with `@dnd-kit/core` (pointer + touch sensors, activation
      constraint): Current/Next columns droppable, editable cards
      draggable, Previous column inert; a completed drop applies the move
      patch and confirms through the move notification.
- [ ] 6. Hover icon cluster (→ for Current items, ← for Next items, ✎, +;
      always visible on touch) with accessible names; the week-move icon
      activates the shared move handler, ✎ opens the canonical editor, +
      opens the existing record comment flow.
- [ ] 7. `Alt+ArrowRight` / `Alt+ArrowLeft` on the focused card (Current→Next
      / Next→Current, no-op otherwise); focus follows the moved card.
- [ ] 8. Inline text editor on the item text: Enter saves, Esc cancels,
      Shift+Enter line break, click outside saves, empty text restores the
      previous value; saves through the canonical draft path.
- [ ] 9. Move confirmation notification with Undo (reverse move through the
      same handler; a refused Undo keeps server state and reports the
      failure).
- [ ] 10. Stale-tab handling: revert the card to the last server state,
      announce the standard save-failure error, re-synchronize the Overview.
- [ ] 11. Component tests: inline editor state machine, icon set by
      placement, shortcut applicability, Undo refusal, Previous
      ineligibility, rejected-drop revert.

## planning + docs

- [ ] 12. E2E scenario (agent-browser): drag Current→Next with screenshot
      evidence, icon move Next→Current, Alt+Arrow round trip, inline edit
      including empty restore, Undo, Previous read-only; evidence in the
      durable handoff directory.
- [ ] 13. Verify: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`,
      `pnpm test`, `pnpm build`, `pnpm spec:check` on the reviewed tree,
      plus guarded API integration for the move patches.
