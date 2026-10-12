# Proposal

## Why

The guarded migration wrapper can validate a supplied non-production environment while passing an inherited production value to its child when NODE_ENV is omitted. The existing destructive-db-guard contract requires refusal before that child is invoked.

## What Changes

- Resolve the inherited child environment once before validation and pass that snapshot to the guard and child.
- Preserve the existing requirement that the injected input supplies DATABASE_URL and exact consent, even if ambient values exist.
- Extend the existing port/DB-free migration boundary tests for inherited production refusal, explicit safe override and required-input preservation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `destructive-db-guard`: clarify that production refusal applies to the resolved environment passed to a guarded migration child.

## Impact

Only prisma/operations/migrate-deploy.ts and its existing test. Existing CLI command, guard APIs, targets, consent and pins are unchanged. OCR C3794; external D37-V13 scope-contract-red-plan.md and actual RED receipt document the admitted exported boundary.

## Non-goals

- No new target policy, cleanup, migration/seed behavior or diagnostic formatting.
- No real database/Redis/process operation or claim about a deployed production migration.
- No dependency, runtime, hook or shared configuration changes.
