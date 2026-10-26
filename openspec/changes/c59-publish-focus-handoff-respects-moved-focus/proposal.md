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

## Open items

- **C4678, foreign-transition clause.** A request armed by a successful mutation
  whose flip never arrives, followed much later by someone else's transition
  while focus rests on the body, still moves focus. Ending the request needs a
  signal (refetch settled, or an expiry) that the control does not receive;
  choosing one is a policy decision and is not made here.
- Native focus after a real publish with a slow refetch, and the exact
  announcement, are unobserved.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `head-report-visibility`: the publish/reopen focus hand-off never takes focus
  the reviewer moved.

## Impact

`publish-lock-button.tsx` and its test only.
