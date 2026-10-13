# Proposal

## Why

A reminder whose adapter rejects with an unstringifiable value can remain in
`sending`: formatting the failure throws before the worker releases its claim
or records the final failure. TASK-503 C0572 identifies this shared boundary in
`apps/api/src/lib/error-message.ts` and its email-reminder consumer.

## What Changes

- Make failure normalization return the existing `Unknown error` fallback when
  inspecting or converting a thrown value fails.
- Extend the existing worker regression to cover rejected unstringifiable values
  on both intermediate and final attempts.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `reliable-reminder-delivery`: error formatting must not prevent claim release
  or final failure recording for an adapter rejection.

## Impact

The shared API error helper and existing email-reminder processor tests change.
No dependencies, migrations, public interfaces, or frontend code change.

## Non-goals

- Change the existing textual policy for nullish or stringifiable objects.
- Extract arbitrary object `message` properties.
- Add new retry, delivery, or logging policies.
