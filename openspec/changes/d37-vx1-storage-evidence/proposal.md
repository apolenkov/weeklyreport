# Proposal

## Why

A crawler can lose a completed observation when saving recovery evidence fails. The actual generated batch rejects on sessionStorage quota failure after creating a stale-select row, leaving its caller only the older stored results.

## What Changes

- Return completed rows and the original storage failure as an explicitly stopped batch.
- Stop immediately if the initial storage reset fails; never read old results as new observations.
- Retain unknown request consumption without refunding it.
- Stop dependent quick/full traversal through its existing incomplete-recovery path.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- ui-crawl: clarify failed-batch evidence delivery when its own persistence fails.

## Impact

Owned batch.ts and press.ts, existing artifacts.test.ts and recovery tests. D37-VX1 F6921-8 generated-DOM RED and Root's bounded decision define the repair.

## Non-goals

- Volatile fallback storage, retry, new failure enum or corruption policy.
- Native quota workloads, actual navigation, browser presses or new actions.
- Changes to real transport exception recovery.
