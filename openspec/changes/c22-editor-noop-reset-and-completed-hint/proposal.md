# Proposal

## Why

Two lead-editor defects are admitted by source with an ordinary producer
(TASK-503.22; Backlog TASK-503.22, C5076 and C5002):

- **C5076.** `useActivityFieldsDraft.reset` sets the title to `""` and marks the
  draft dirty unconditionally. On an Activity whose weekly title is already
  empty, Reset changes nothing, yet it arms the unload guard (browser-leave and
  link-click prompts), reports the activity as pending to the Overview and
  enables a no-op Save. A pending activity id also disables the other Overview
  actions (`canStartAction`).
- **C5002.** The basic Overview item editor hides the next-step field. When a
  completed item still carries a next step, Save is blocked and the focused
  fallback says only "Cancel, then choose More actions → Update status.". The
  real rule ("A completed item cannot have a next step.") is never shown, and
  following the hint discards the inline edits already made.

## What Changes

- Reset to catalogue name marks the weekly-fields draft pending only when it
  changes the title; an unchanged draft stays clean and Save stays disabled.
- The basic Overview editor fallback shows the actual next-step validation
  message and keeps the routing hint. It remains the focus target of a blocked
  Save.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `weekly-activity-presentation`: a no-op Reset is not a pending edit.
- `lead-status-overview`: the basic editor states the reason a plan blocks Save.

## Impact

`status-overview-activity-fields.tsx` (`reset`) and `item-inline-editor.tsx`
(fallback paragraph), with regression tests beside both. No server, schema,
full-dialog or autosave change.

## Open items kept out of this change (no admitted producer)

- **C5074 (clauses 2 and 3).** Save hands the pair synchronously to the canonical
  lead-form draft, and the autosave payload key is derived from content
  (`use-lead-form-autosave.ts:58-63`), so an equal pair does not by itself make
  the draft dirty. Whether an identical `activity-status` patch leaves the
  payload unchanged, and how long the canonical draft keeps its own unload
  guard, were not traced; there is no producer, so no test is authored.
- **Legacy next-step text.** A stored next step that is invisible-only or over the
  length limit puts the shared message (for example "Text must contain visible
  characters", which has no full stop) into the alert, so it reads as a run-on
  sentence before the routing hint and names a field the basic editor hides.
  Fixing the shared message belongs with the invisible-text work (TASK-503.107),
  not here.
- **C5011.** `ParentPicker` disables a single-option select whose value is a
  stale id, but no ordinary flow produces a resolved parent outside the current
  options (shared class with C5009). No test is authored without a producer.
- **C5004 and C5005.** The static ids duplicate only if two item editors mount
  at once. The Overview blocks other actions while its editor is open
  (`canStartAction`), so a second mount needs another entry point on the same
  page; this is a native observation, not a source defect.

## Non-goals

- Blocking the Completed chip in the basic editor, or mounting the next-step
  field there.
- Changing the full item dialog, which already shows the field and its error.
- Rewording the validation message. It is shown as the form produces it,
  including "Resume it or clear the plan."; Resume works inline, while clearing
  the plan needs the full dialog named by the routing hint.
- Any claim about assistive-technology speech or real-browser focus; those need
  a native window.
