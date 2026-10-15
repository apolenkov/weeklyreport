# Proposal

## Why

`SessionProvider` passed TanStack's `isLoading` through when `auth.me` had no
data yet. When the first `auth.me` fails and the browser goes offline or the
tab moves to the background before the retry, the query stays `pending` with
`fetchStatus: "paused"`, so `isLoading` is false and every `useSession()`
consumer sees an anonymous session while the user is in fact unresolved
(TASK-503 C5223, 008 batch 03 decision).

## What Changes

- The client session state reports `isLoading: true` whenever `auth.me` has not
  resolved (`data === undefined`), including a paused retry. Only a resolved
  `null` is anonymous.
- The failed-query branch (`Could not verify your session.` with retry) is
  unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `session-hydration-error-scoping`: the web client does not show an unresolved
  session as anonymous.

## Impact

`apps/web/src/shared/lib/auth/session-provider.tsx` and its colocated test. The
`SessionState` shape is unchanged; consumers already handle `isLoading`.

## Non-goals

- Expose `isFetching`/`isError`/`isPaused` on the session context.
- Change the query client's retry, network mode or online detection.
