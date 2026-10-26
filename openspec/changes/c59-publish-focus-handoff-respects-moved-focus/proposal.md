# Proposal

## Why

Publish & lock and Reopen period hand keyboard focus to the control that
replaces them. The request is armed by the mutation's `onSuccess`, but the
status flip that mounts the successor arrives only after the lifecycle refetch
(`periodMutationCallbacks` invalidates without awaiting). A reviewer who moves
focus in that window, for example by tabbing on or clicking a field, has focus
pulled back to the successor when the flip lands (C4678, TASK-503.59). The
failure-path guards (`30f1b97`) cover a failed mutation only.

## What Changes

- The success hand-off moves focus only when focus was dropped (the document
  body, or nothing). Focus the reviewer placed elsewhere stays.
- The existing fallbacks stay: the successor button when focus was dropped, the
  page main region when Publish is disabled.

## Dispositions in the same card (no product change)

- **C4678, foreign-transition clause: OPEN.** A request armed by a successful
  mutation whose flip never arrives, followed much later by someone else's
  transition while focus rests on the body, still moves focus. Ending the
  request needs a signal (refetch settled, or an expiry) that the control does
  not receive; choosing one is a policy decision and is not made here.
- **C4679: no RED.** Confirm closes the dialog (`setShowDialog(false)`) before
  the mutation call, React flushes discrete events synchronously so a second
  click cannot reach the dialog, and the outer trigger is disabled while
  `isPending`. The dialog has an enter animation only, no exit animation that
  would keep Confirm clickable. Two native Enter presses before unmount need a
  browser; `handleConfirmReopen` and `handleConfirm` being private is not a
  producer.
- **C4673: no RED.** The five dialog flags are independent, but each dialog is
  modal (`aria-modal`, focus trap, backdrop) so a second admitted action while
  one is open has no pointer or keyboard route; setting two flags directly is
  parent-state injection, which the card does not accept.
- **C4720: no RED.** `handleSave` has no invalid early return, yet the visible
  Save is `disabled` from `hasInvalidField` on every render, the fieldset is
  not a form (Enter does not submit) and validity updates are discrete events
  flushed before the next click. A stale-invalid Save needs an autofill or
  keyboard route that the card requires to be shown.
- **C4667: no RED.** A fresh `QueryClient` per `renderTab` and the global RTL
  cleanup contradict a shared cache; no cross-test failure is shown. Defaults
  such as `gcTime: 0` are not added from source omission.

## Open items

- Native focus after a real publish with a slow refetch, and the exact
  announcement, are unobserved.

## Capabilities

### head-report-visibility

ADDED: the publish/reopen focus hand-off never takes focus the reviewer moved.

## Impact

`publish-lock-button.tsx` and its test only.
