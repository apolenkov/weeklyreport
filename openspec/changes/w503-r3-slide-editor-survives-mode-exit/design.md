# Design

## Context

The editor state (`inlineEdit`, `pendingDeleteRef`) lives in
`useSlideInlineEditor`, called by `LeadSlidesClient`. The dialogs keep their typed
field state in their own components. `LoadedReportContent` renders
`LeadSlidesClient` only while `isSlidesMode`, so a mode change unmounts the whole
subtree.

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
  `onEditorOpenChange(open)` prop (effect on change).
- `LeadFormLoaded` stores that flag. `LoadedReportContent` renders the deck when
  `isSlidesMode || editorOpen`; outside Slides mode the deck sits in a `hidden`
  wrapper and the Report sections render beside it as usual. The dialogs are
  portaled, so they stay visible over the Report view.
- The flag is reported `false` on close, which unmounts the hidden deck.
  `onEditorOpenChange` is not called on unmount; the parent only unmounts when
  the flag is already false.

## Assumptions

- Holding for the duration of the open dialog is acceptable UX: the dialog is
  modal and the user finishes or cancels it explicitly.
- A changed `initialReportId` while held does not reload the deck (the hook reads
  it as an initial value); a changed section closes the editor via the existing
  isolation rule.
