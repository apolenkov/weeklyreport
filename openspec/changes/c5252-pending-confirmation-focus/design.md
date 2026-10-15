# Design

## Context

`ConfirmationDialog` (shared) owns `isPending`: it disables both actions, sets
`aria-busy`, and suppresses Escape/outside dismissal. Disabling the focused
button makes the browser move focus to `<body>`. Radix `FocusScope` ignores a
focusout without `relatedTarget`, so its trap does not pull focus back, and Tab
from `<body>` reaches the page. Open/close focus is owned by `useDialogFocus`
(`packages/ui`), which this change does not touch.

## Goals / Non-Goals

**Goals:** focus containment during pending in the shared component; no change
to disabled/busy semantics, guards, write path or open/close focus.

**Non-Goals:** keeping actions focusable via `aria-disabled` (would change the
existing native assertion that both actions are `disabled` and weaken the
guard); timers; test seams.

## Decisions

- When `isPending` becomes true, an effect checks the active element; if it is
  outside the panel or a disabled control, it focuses the dialog panel (Radix
  Content, already `tabIndex=-1`). With no tabbable controls, Radix `FocusScope`
  prevents Tab/Shift+Tab on the panel, so focus stays inside.
  Alternative `aria-disabled` rejected (above). Alternative change in
  `packages/ui` `DialogContent` rejected: pending is a confirmation concept and
  other dialogs have no such phase.
- Other callers (organization AI provider/prompt, feedback workflow, admin users,
  periods, dashboard revoke, lead-form dialogs and submit, role switcher) gain the
  same containment during their pending phase; non-pending behaviour unchanged.

## Risks / Trade-offs

- Screen readers announce the dialog again when the panel takes focus; this is the
  expected cue that the action is in progress (the busy status region stays).
- Invariants: period dual-state, role-coverage gate and destructive-db guard are
  untouched (UI-only change).
