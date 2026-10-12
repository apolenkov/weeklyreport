# Proposal

## Why

Persisted provider tests can leave activation available, unmeasured embeddings look blank, and unresolved report parents can incorrectly block their editor. Background reopen refreshes and pending controls also need to preserve the user's current interaction. The selected D37-F13 BRIEF and existing public components identify these current roots.

## What Changes

- Enforce existing asynchronous-action eligibility and visible pending feedback.
- Display unmeasured embedding dimensions consistently.
- Keep unresolved parents recoverable through existing field validation; preserve product-stage and activity rules.
- Scope reopen retry autofocus to explicitly requested next-page work.
- Recheck current read-only state before confirming a local risk deletion.
- Replace the provider form's generic dispatch with its two typed callbacks and remove the unused CardHeader action variant.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `ai-provider-admin-layout`: clarify persisted queued/running activation eligibility and unmeasured diagnostics.
- `reopen-requests`: clarify background-error focus preservation.
- `risk-stage-integrity`: clarify unresolved-parent validation before product-stage ownership checks.
- `lead-dialog-lifecycle`: clarify current read-only deletion confirmation.
- `ai-prompt-management`: preserve prompt discard pending visibility.

## Impact

Only the assigned Web/UI owners and colocated tests. No API/schema, migration, authorization, dependency or runtime changes.

## Non-goals

- New lifecycle states, backend policies, provider calls or stage ownership defaults.
- Redesign, deduplication, compatibility layers or speculative performance changes.
- Claiming browser, Safari, assistive-technology or server acceptance from JSDOM.
