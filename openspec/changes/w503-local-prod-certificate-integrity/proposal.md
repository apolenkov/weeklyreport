# Proposal

## Why

Operators can deploy a local stand with a missing, corrupt, or mismatched IdP signing pair because `deploy/local-prod/setup.sh` masks OpenSSL conversion failures. TASK-503 C0052/C0053 and the real-OpenSSL baseline in `~/work/handoffs/task-503/wave-06/local-prod-baseline.json` reproduce this; generation errors also hide their diagnostic.

## What Changes

- Validate both signing files and their matching public keys before Kubernetes operations.
- Reuse a valid existing pair; generate only when both files are absent.
- Reject incomplete or invalid existing identity without replacing either file.
- Preserve OpenSSL failure statuses during conversion and expose generation stderr.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `local-stand-provisioning`: admit only a valid matching IdP identity before local stand bootstrap mutations.

## Impact

Only `deploy/local-prod/setup.sh`, its executable regression tests, and this change's specifications. No new dependencies.

## Non-goals

- Kubernetes context or namespace policy changes.
- Automatic identity rotation, certificate renewal, or changes to tester-kit setup.
- Shared database, Redis, or browser operations.
