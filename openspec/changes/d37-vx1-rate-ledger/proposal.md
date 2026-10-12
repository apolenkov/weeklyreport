# Proposal

## Why

A crawler can issue another request after losing access to its existing rate history. C4148's rate.ts treats every read error as an absent ledger; a real writable but unreadable file permits an extra reservation instead of preserving the filesystem failure.

## What Changes

- Treat only ENOENT as the first-run empty ledger.
- Preserve all other read failures before a reservation is appended.
- Preserve signed reservation refunds and existing caps/window/lock behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- ui-crawl: clarify that diagnostic ownership includes unavailable existing request history.

## Impact

Owned scripts/ui-crawl/rate.ts and its existing rate.test.ts. Evidence: D37-VX1 BRIEF C4148 and actual permission-boundary RED in its durable handoff.

## Non-goals

- Ledger compaction, new retention or corruption policy.
- Stale-lock replacement, heartbeat or request budget changes.
- Browser, network or live crawler acceptance.
