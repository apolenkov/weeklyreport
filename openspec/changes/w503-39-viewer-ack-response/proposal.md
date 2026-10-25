# Proposal

## Why

A Viewer needs their own acknowledgement state, but currently receives peer
names and receipts despite the UI hiding the roster. Root adopted an explicit
own-receipt-only response for TASK-503.39 / C5117 in
`/home/user/work/handoffs/task-503/ack-roster-39/ROOT-DECISION-A.json`.

## What Changes

- Define the Viewer response of `review.acknowledgements` as an empty array or
  one own receipt with exactly `userId`, `reportId`, `groupId`, `seenAt`.
- Preserve scoped Head/Admin rosters and existing role/group denials.
- Assert real-router/service responses against unfiltered repository fixtures;
  the service shaping is the delivered repair, not a source-only preparation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `review-acknowledge-placement`: add the explicit role-specific response contract.

## Impact

The existing router, `ReviewActionsService`, shared optional `userName` receipt
shape, and Viewer own-state consumer define the affected boundary. Discovery and
current caller/test inventory are in the external TASK-503.39 source report.
No dependency, database schema, endpoint or migration is required.

## Non-goals

- No endpoint split, new response union, route, Zod schema or database change.
- No native database, browser or HTTP-transport acceptance; the focused router
  suite is the admitted evidence and native proof remains separate.
- No changes to acknowledgement writes, reviewer designation, group scope,
  loading/error/refetch behavior or publish prerequisites.
