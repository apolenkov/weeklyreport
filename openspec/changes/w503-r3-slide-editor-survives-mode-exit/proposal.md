# Proposal

## Why

Round-3 acceptance (C4819) reproduced a silent loss of typed input: a lead opened
the Slides risk editor, typed into it, and pressed the browser Back button. Back
removed `?mode=slides`, the lead form stopped rendering the Slides deck
(`lead-form-loaded.tsx`, `LoadedReportContent`), and the deck's inline editor,
which owns the open dialog and its field state, was unmounted. The dialog closed
without consent and the text was gone, with the database unchanged.

An in-app history step cannot be vetoed from the page, so a confirmation prompt
is not possible for this path; holding the draft is.

## What Changes

- While a Slides inline editor (edit dialog or delete confirmation) is open, the
  lead form keeps the deck mounted, hidden, when the URL leaves Slides mode. The
  open dialog, its typed values and its pending state are preserved over the
  Report view.
- When the editor closes by Save, Delete, Cancel or a section change, the hidden
  deck unmounts as it did before.
- With no editor open, leaving Slides mode unmounts the deck exactly as before.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `slide-inline-record-editing`: adds the requirement that an open slide editor
  survives leaving Slides mode.

## Impact

- `apps/web/src/features/slides/ui/lead-slides-client.tsx`,
  `use-slide-inline-editor.tsx` (report whether an editor is open).
- `apps/web/src/features/report-pages/ui/lead/shell/lead-form-loaded.tsx` (keep
  the deck mounted while an editor is open).

## Non-goals

- No change to section-change isolation (`Switching sections isolates editor
identity` stays: an editor bound to another section is closed, because its
  save would write the wrong section).
- No change to the Slides quick-add dialogs (`SlidesQuickAddDialogs`), whose
  Slides producer was not reachable in the acceptance run.
- No native-browser history veto and no `beforeunload` change.
