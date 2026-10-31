# Proposal

## Why

Round-4 acceptance (C5227) found that while `auth.me` loads, `IfRole`
(`apps/web/src/shared/ui/auth-runtime/if-role.tsx`) renders nothing, so an admin
sees the Dashboard alert without the "Configure reminders" link and with no
sign that it is coming; the link then appears and the layout jumps.

## What Changes

- `IfRole` accepts an optional `loadingFallback` rendered while `auth.me` has no
  answer yet. Without it, behaviour is unchanged (renders nothing).
- The Dashboard alert bar passes a muted status placeholder for the "Configure
  reminders" slot, replaced by the link (admin) or nothing (other roles) once
  `auth.me` settles.
- A failed `auth.me` keeps its existing explicit session-error screen; the
  fallback is only for the pending state.

## Capabilities

### Modified Capabilities

- `dashboard-interaction-stability`: adds the requirement that role-gated alert
  actions show a loading placeholder instead of silently disappearing.

## Impact

- `apps/web/src/shared/ui/auth-runtime/if-role.tsx` and test.
- `apps/web/src/features/dashboard/ui/alert-bar.tsx` and test.

## Non-goals

- No change to role checks, `auth.me` retry or the session-error screen.
