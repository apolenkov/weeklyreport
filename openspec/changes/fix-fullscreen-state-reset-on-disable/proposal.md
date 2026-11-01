# Proposal

## Why

In `apps/web/src/shared/hooks/browser/use-fullscreen.ts:47-87`, when `enabled`
turns `false` while the deck is in fullscreen (for example browser Back from
slides to document mode), the `fullscreenchange` listener is removed while
`isFullscreen` and `wasFullscreenRef` stay `true`. The browser exits fullscreen
on its own because the element leaves the DOM, but no listener observes the
change, so the toggle keeps reporting a fullscreen that does not exist, and
the first real `fullscreenchange` after returning to slides moves focus to the
toolbar toggle on the stale `wasFullscreenRef`.

Identified under TASK-503.113 (C4758, C4875).

## What Changes

- `apps/web/src/shared/hooks/browser/use-fullscreen.ts`: when `enabled`
  transitions `true -> false` (and on unmount), the hook resets `isFullscreen`
  to `false` and `wasFullscreenRef.current` to `false`, via a dedicated
  `useEffect` scoped to `[enabled]` with the reset in its cleanup, so churn of
  the error callback identity never resets the state.
- `apps/web/src/shared/hooks/browser/use-fullscreen.test.ts`: regression tests
  for the stale state after disable (A) and the stale exit focus after
  re-enabling (B), plus a characterization test that an error-callback identity
  change during fullscreen does not reset the state (C).
- Add a `status-slide-rendering` requirement that a deck's fullscreen state
  ends when the deck is no longer available.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `status-slide-rendering`: A deck's fullscreen state ends when the deck is no
  longer available.

## Impact

- `apps/web/src/shared/hooks/browser/use-fullscreen.ts`
- `apps/web/src/shared/hooks/browser/use-fullscreen.test.ts`
- No API, database schema, or persistence changes.
