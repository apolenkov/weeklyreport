# Design

## Context

`rate.ts` already fails closed for ledger reads (only ENOENT is an empty
ledger). The remaining gap is the lock path: acquisition, stale takeover and
release all hid filesystem failures behind the contention loop.

`batch.ts` instruments `window.fetch` so status failures are recorded, but the
rejection path skipped the log entirely and a handled rejection never reached
the global `unhandledrejection` listener.

## Decisions

- A single `errCode(error, code)` guard classifies Node errno failures without
  unsafe casts, matching the `loadPasswords` precedent in `config.ts`.
- `EEXIST` is the only retryable acquisition failure; everything else surfaces
  immediately. `ENOENT` is the only suppressed stale-cleanup failure — it is
  the released-meanwhile race. Other stat/removal failures propagate.
- On a failed ledger action the release attempt still runs; when it also
  fails the action's error stays first inside an `AggregateError` carrying the
  release error second, and the action's message stays the thrown message.
- The fetch wrapper logs `fetch failed: <method> <url-without-query-or-fragment>`
  under the existing `page-error` kind for non-`AbortError` rejections, then
  rethrows the identical rejection object. A `WeakSet` of reported rejections
  suppresses the duplicate in the global `unhandledrejection` listener; other
  page failures keep reporting as before.
- `AbortError` cancellations stay silent: intentional cancellation is not a
  product failure and is not added to the reported set, so existing behavior
  for it is unchanged.

## Risks

- A stricter lock contract can surface failures earlier in environments with
  unusual filesystem permissions — that is the intent of failing closed.
- Native browser timing of `unhandledrejection` is verified separately; the
  generated-realm test proves the dedup logic, not the native event ordering.
