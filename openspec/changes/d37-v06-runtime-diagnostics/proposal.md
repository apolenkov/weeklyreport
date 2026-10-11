# Proposal

## Why

Development reseeding exposes child-process output and internal paths to API callers, while Nest startup exceptions lose their original name and stack in application logs. D37-V06 findings C0476 and C0599 reproduce these failures at the real tRPC transport and Nest exception producer boundaries; evidence lives in the coordinator's D37-V06 handoff.

## What Changes

- Return a fixed safe reseed success summary and a generic failure message, preserving result shape, failure status and existing request correlation.
- Preserve an actual Error's name and stack in `NestAppLoggerAdapter.error`, with explicit caller stack/context taking precedence and no cause or arbitrary-object serialization.

## Capabilities

### Modified Capabilities

- `destructive-db-guard`: constrain the development `wipeAndReseed` response to safe status instead of raw child diagnostics.
- `error-trace-correlation`: retain Nest Error identity and stack through AppLogger.

## Impact

Two API sources and their existing colocated tests change. The web role switcher already ignores successful output and displays error messages. No dependency, database schema, configuration, roles, dev-mode gate, destructive-target eligibility, command timeout or consent changes are required.

## Non-goals

- Database reset/seed end-to-end acceptance or new diagnostic storage.
- Shutdown stderr delivery guarantees, arbitrary object/cause serialization, other logger levels or two-argument string overload inference.
- Main specification synchronization; the coordinator owns that integration step.
