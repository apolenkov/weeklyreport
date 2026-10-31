# Proposal

## Why

Round-3 acceptance (C4819) reproduced a silent loss of typed input: a lead opened
the Slides risk editor, typed into it, and pressed the browser Back button. Back
removed `?mode=slides`, the route handed `LeadForm` the mode `overview`, `LeadForm`
swapped its editor branch for `LeadStatusOverview` (`lead-form.tsx`), and the
branch's Slides deck, whose inline editor owns the open dialog and its field
state, was unmounted. The dialog closed
without consent and the text was gone, with the database unchanged.

An in-app history step cannot be vetoed from the page, so a confirmation prompt
is not possible for this path; holding the draft is.

## What Changes

- While a Slides inline editor (edit dialog or delete confirmation) is open, the
  Lead page keeps the editor branch mounted but invisible when the URL leaves
  Slides mode for Overview. The Overview renders as usual, and the open dialog,
  its typed values and its pending state are preserved over it.
- When the editor closes by Save, Delete, Cancel or a section change, the
  invisible branch unmounts as it did before.
- With no editor open, leaving Slides mode unmounts the branch exactly as before.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `slide-inline-record-editing`: adds the requirement that an open slide editor
  survives leaving Slides mode.

## Impact

- `apps/web/src/features/slides/ui/lead-slides-client.tsx`,
  `use-slide-inline-editor.tsx` (report whether an editor is open).
- `apps/web/src/features/slides/ui/lead/lead-slides-deck-view.tsx` (the dialog
  portal target stays painted inside an invisible host).
- `apps/web/src/features/report-pages/ui/lead/shell/lead-form.tsx` (hold the
  editor branch above the mode switch while an editor is open) and
  `lead-form-loaded.tsx` (forward the editor-open callback).

## Non-goals

- No change to section-change isolation (`Switching sections isolates editor
identity` stays: an editor bound to another section is closed, because its
  save would write the wrong section).
- No change to the Slides quick-add dialogs (`SlidesQuickAddDialogs`), whose
  Slides producer was not reachable in the acceptance run.
- No native-browser history veto and no `beforeunload` change.
