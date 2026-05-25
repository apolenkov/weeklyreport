# Add remind-button aria-live announcement

## Problem

The `RemindLeadButton` (commit 559a891 implementation) sends an email reminder
to a lead without visual feedback. A screen-reader user does not hear confirmation
that the reminder was sent; they must rely on a silent toast or wait for the
button to re-enable.

## Solution

Add an `aria-live="polite"` region below the button:

- Create a hidden `<div aria-live="polite" aria-atomic="true">`
- On successful reminder send, render: "Reminder email sent to [lead name]"
- On error, render: "Failed to send reminder. Please try again."
- Clear the message after 5 seconds or on the next action.

## Non-goals

- Change the reminder logic or email template.
- Refactor the button itself (styling, state machine).
- Add visual toast notifications (assumed out of scope).

## Source

- `.planning/todos/pending/2026-05-21-remind-aria-live.md` — accessibility
  audit finding.
- Implementation: `RemindLeadButton` (commit 559a891).

## Activation trigger

When accessibility compliance audit is scheduled (estimated v8.7, or when
WCAG AA certification is required by product).
