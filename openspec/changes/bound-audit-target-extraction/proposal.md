# Proposal

## Why

`apps/api/src/infrastructure/trpc/trpc.audit.ts:40-77` walks the decoded
mutation input for audit target identities without a depth limit, without a
visited-object set, and without a cap on the number of identities collected.
A bulk input (for example 25 items each carrying an `id`) inflates the audit
event's `targets` without bound, and a self-referencing object raises a
`RangeError` in `extractAuditTargets` before the `try` block of
`recordMutationAudit` — which would drop the mutation outcome that
`c34d94dd9` made immune to audit failures.

Identified under TASK-503.32 (C0536, C0538).

## What Changes

- `apps/api/src/infrastructure/trpc/trpc.audit.ts`: the walk reads at most 8
  levels (`MAX_AUDIT_WALK_DEPTH`), visits each object once (`WeakSet`), and
  reports at most 20 distinct identities (`MAX_AUDIT_TARGETS`);
  `extractAuditTargets` returns `{ targets, truncated }` and
  `recordMutationAudit` passes `truncated: true` on the audit event when any
  identity or branch was left out. The durable `UserActionLog` row is
  unchanged.
- `apps/api/src/lib/audit-logger-types.ts`: `MutationInput` gains
  `readonly truncated?: boolean`.
- `apps/api/src/lib/audit-logger-events.ts`: `createMutationAuditEvents`
  emits `truncated: true` next to `targets` when present.
- `apps/api/src/infrastructure/trpc/mutation-audit.bounds.test.ts` (new):
  cap, circular-input and depth bounds, plus a within-limits
  characterization.
- `apps/api/src/lib/audit-logger.test.ts`: the mutation envelope carries
  `truncated: true` only when the walk was cut off.
- `apps/api/src/infrastructure/trpc/trpc.logging.ts` and
  `trpc.logging.test.ts`: the logged input shape descends at most 5 levels,
  lists at most 50 keys per object and marks cuts (`…`, `[circular]`,
  `+N more`); values are never logged.
- New `audit-target-coverage` requirements: mutation audit target extraction
  is bounded, and mutation log shapes are bounded.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `audit-target-coverage`: mutation audit target extraction is bounded — at
  most 8 levels, each object once, at most 20 identities, `truncated: true`
  when anything is left out.

## Impact

- `apps/api/src/infrastructure/trpc/trpc.audit.ts`
- `apps/api/src/infrastructure/trpc/trpc.logging.ts` and its test
- `apps/api/src/lib/audit-logger-types.ts`
- `apps/api/src/lib/audit-logger-events.ts`
- `apps/api/src/infrastructure/trpc/mutation-audit.bounds.test.ts` (new)
- `apps/api/src/lib/audit-logger.test.ts`
- No API contract, database schema, or durable audit row changes.
