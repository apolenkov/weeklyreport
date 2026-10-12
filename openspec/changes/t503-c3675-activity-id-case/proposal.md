# Proposal

## Why

C3675: only `linkedProductIds` was case-folded at the project-activity wire.
`groupId`, `id`, `activityId` and `leadId` passed through verbatim, but ids are
byte-compared TEXT generated lowercase, so a mixed-case id misses its lookup
and returns NOT_FOUND while the same payload's product ids are admitted. This
is an admission inconsistency; no live caller is known to send uppercase ids.

## What Changes

- The four project-activity write schemas accept any letter case for
  `groupId`, `id`, `activityId`, `leadId` and `linkedProductIds` and emit them
  in lowercase.
- The read model `projectActivitySchema` keeps persisted ids verbatim.
- The inaccurate "Postgres uuid type is case-insensitive" parenthetical in the
  duplicate-ids requirement is corrected.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `activity-reporting-unit`

## Impact

`project-activity.schema.ts` and its colocated tests. A stored row with an
uppercase id (for example inserted by hand) would no longer be addressable
through these commands; a read-only scan on live targets is a native check.

## Non-goals

- Other shared schemas that pass ids verbatim; a repo-wide UUID case policy is a
  separate decision.
