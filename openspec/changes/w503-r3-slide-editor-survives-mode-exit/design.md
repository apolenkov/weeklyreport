# Design

## Context

The editor state (`inlineEdit`, `pendingDeleteRef`) lives in
`useSlideInlineEditor`, called by `LeadSlidesClient`. The dialogs keep their typed
field state in their own components. The routes pass `LeadForm` only the mode
`slides` or `overview`, so Back from Slides gives `overview`. `LeadForm` renders
`LeadStatusOverview` for it and no longer renders `LeadFormEditor`, which unmounts
the whole editor subtree (`LeadFormLoaded`, the deck and its dialogs). Holding the
deck inside `LeadFormLoaded` would not help: it is gone with its parent branch.

## Options considered

1. **Confirm on exit.** Not possible: Back/Forward are handled by the Next router
   before any page code can cancel them; a re-push races the router.
2. **Lift the draft and restore it later.** Needs the field state of three dialog
   kinds hoisted; large and easy to desync.
3. **Hold the editor mounted (chosen).** Smallest code and the most
   conservative result: nothing is discarded and the user decides.

## Decisions

- `useSlideInlineEditor` returns `hasOpenDialog` (edit record or pending delete
  record present). `LeadSlidesClient` reports it through an optional
  `onEditorOpenChange(open)` prop (effect on change, and `false` on unmount so a
  deck removed by another mode cannot leave a stale flag).
- `LeadForm` owns the `slidesEditorOpen` flag and passes the setter down through
  `LeadFormEditor` and `LeadFormLoaded`. In the fragment under the stage-memory
  scope, `LeadStatusOverview` renders while `mode === "overview"`, and the editor
  branch renders while `mode !== "overview"` or `slidesEditorOpen`, in its own
  wrapper slot and with the mode `slides` while held. The slot and element type
  are the same in both modes, so React keeps the branch mounted. The wrapper is
  `contents` normally and `invisible h-0 overflow-hidden` while held.
- The wrapper uses `invisible`, not the `hidden` attribute: the dialogs portal
  into an element inside the deck (so they stay in a fullscreened deck), and
  `display: none` on an ancestor would hide them. The portal target carries
  `visible`, which overrides the inherited `visibility: hidden` for the fixed
  dialogs only.
- The flag is reported `false` on close, which unmounts the held branch.

## Assumptions

- Holding for the duration of the open dialog is acceptable UX: the dialog is
  modal and the user finishes or cancels it explicitly.
- A changed section closes the editor via the existing isolation rule; a changed
  report remounts the whole `LeadForm` scope (keyed by report id) and resets the
  flag.
