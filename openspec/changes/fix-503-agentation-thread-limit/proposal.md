# Proposal

## Why

C3623 and C3628: nothing limits the length of an annotation thread. Two
server-built events grow with it (`annotation.updated` carries the full thread,
`action.requested` carries every annotation with its thread), and the response
contract already caps `thread` at 50 messages, so a thread past 50 breaks the
retry-safe create replay (the stored row no longer parses) and delivery
confirmation.

## What Changes

- A thread holds at most 50 messages. A reply is rejected with 409 before
  persistence once the thread holds 49, keeping the last slot for dismissal.
  Dismissing a thread already at 50 (reachable only through repeated reopen and
  dismiss cycles) is rejected with 409 and changes nothing.
- The check is a count under the existing annotation/session lock, in one
  helper used by the reply and dismiss paths. No new column or migration.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `authenticated-product-feedback`: thread length bound and its 409 behavior.

## Impact

`agentation.repository.ts`, `agentation-inbox-actions.ts`, the shared helpers,
the `FeedbackLimitError` class and its mapping in `product-feedback.handler.ts`.

## Non-goals

- `action.requested` keeps carrying all annotations (upstream parity) and stays
  bounded only by the annotation count. Its byte growth is a separate hold with
  its own label, not a performance deferral.
- No cap on annotations per session and no typed event envelope.
- Legacy threads already above the cap are not rewritten; they stay readable
  and cannot grow further.
