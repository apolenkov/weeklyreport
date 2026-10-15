# Proposal

## Why

The review-comment composer's text field names its description through
`aria-describedby`. Two defects survive in the ordinary flows (TASK-503.38):

- **C5096.** The ids are `[limit, validationError ? validationErrorId : feedbackId]`,
  so the feedback id is dropped while a validation error shows. The two states
  coexist in an ordinary flow: the reviewer types an invisible-only or
  over-limit draft, then deletes a comment; the delete outcome is shown as
  feedback while the draft error stays. The feedback is still announced by its
  own live region, so the claim is narrowed to the **description association**,
  not to announcement loss.
- **C5097.** One paragraph is both the hint ("Up to N characters.") and the
  validation alert: its text, `id` and `role="alert"` change in place. The
  hint disappears while the draft is invalid, and an alert role added to an
  already mounted element is announced unreliably. The reliability part needs
  assistive-technology evidence; the structural part is testable.

## What Changes

- The textarea description keeps the limit counter, the validation error (when
  shown) and the feedback (when shown).
- The hint paragraph stays mounted; the validation error is a separate element
  carrying `role="alert"`.

## Dispositions in the same card (no product change)

- **C5107.** Trim-after-validate: **rejected**. The shared text schema bounds
  the untrimmed draft and trimming only shortens it, so the sent value always
  passes the same bounds (the draft counter being stricter than the server for
  trailing whitespace is a friction note, not a safety defect). Rapid native
  double-submit: **open**; a textarea never submits on Enter, the submit
  button is disabled while pending, and no public native producer is admitted.
- **C5108 / C5109.** **FIXED-EXISTING**: `3b53d1085` and `15ef94a3e` (both
  ancestors of main) close an idle stale delete confirmation when its comment
  leaves the list or the actor may no longer delete it, and keep it open while
  the delete is in flight. A single delete mutation disables every Delete
  button while pending by design; per-row pending is not a defect. Native
  reachability of a stale dialog remains open. Change
  `c5108-stale-comment-delete-confirmation` is unarchived.

## Open items

- Announcement reliability of the validation alert (C5097) needs browser/AT
  observation; no speech claim is made from jsdom.

## Capabilities

### record-comment-save-coordination

ADDED: composer description keeps every live reference; hint and validation
alert are separate elements.

## Impact

`record-comment-composer.tsx` and `record-comments.test.tsx` only.
