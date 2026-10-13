# Proposal

## Why

A corrupted persisted crawler request ledger can grant another request despite
an exhausted shared budget (TASK-503 C4148). `rate.ts` parses non-finite values
and silently ignores extra fields before the crawler calls `pace`.

## What Changes

- Reject malformed ledger rows before reserving another request.
- Preserve valid signed `actual - reserved` corrections and first-run absence.
- Preserve corrupted bytes and surface the failure without skipping or repair.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ui-crawl`: the shared request ledger fails closed on corrupt persisted rows.

## Impact

`scripts/ui-crawl/rate.ts` and its existing test owner. Callers in `worker.ts`,
`press.ts`, and `scenario-api.ts` keep the same API and ledger format. Existing
`ui-crawl` failure evidence contracts remain in force. No dependencies change.

## Non-goals

- No ledger compaction, reset, or signed refund ban.
- No reservation/refund identity redesign or new rate-limit policy.
