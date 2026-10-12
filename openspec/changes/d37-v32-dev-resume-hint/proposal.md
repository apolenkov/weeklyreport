# Keep authenticated resume-hint writes inside dev auth

## Why

SessionProvider currently writes name/email to persistent localStorage in production and when the dev auth stub is disabled. Its only landing reader already uses webEnv.authStub, so those writes have no active production consumer.

## What Changes

- Reuse the existing webEnv.authStub predicate in SessionProvider's effect.
- Preserve enabled dev resume behavior, including retaining its hint after auth.me resolves null.
- Replace mocked Query/state/storage controls in the approved existing session test with a real QueryClient, existing in-memory tRPC transport, schema-admitted synthetic auth.me and isolated jsdom storage.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `prod-security-hardening`: authenticated SessionProvider hint persistence follows the existing fail-closed dev auth predicate.

## Impact

Only owned session-provider.tsx/test.tsx. No auth/session fallback, TTL, logout cleanup, old stored-record migration, storage type or deployment flag changes. Native shared-device/privacy lifecycle acceptance remains outside this focused proof.
