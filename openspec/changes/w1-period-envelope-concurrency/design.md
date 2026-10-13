# Design

## Context

See proposal.md for the reproduced C0767 problem. The writer already owns a
Report lock after the status-graph barrier and reminder-policy locks. The
service's read and overlap precheck happen before that transaction.

## Goals / Non-Goals

Protect the values used to compute changed-field audit diffs and effective
ranges. Preserve PATCH omission and nullable clear semantics. No public input
schema, lifecycle tuple or dependency changes are needed.

## Decisions

Before: read → calculate PATCH/diff → validate range → lock lifecycle → write.

After: read → calculate PATCH/diff → validate range → lock lifecycle and
envelope → compare relevant before-values → write.

Forward the existing envelope snapshot through the repository port. Compare
only changed fields, except range edits compare both boundaries. Whole-row
version checks would unnecessarily reject independent deadline/label changes.
Date comparison uses instants; nullable values compare null explicitly.

Keep graph → policy → Report ordering and the existing lifecycle validation.
The database exclusion constraint remains the authority for other-report
overlap races. The guarded write does not mutate periodState or lifecycle.

## Risks / Trade-offs

Concurrent edits to different range boundaries conflict because their combined
range was never validated. Clients retry after reloading. An ABA edit returning
to the same values is accepted because the relevant before-values are accurate.
No new timestamp or historical-change contract is introduced.

## Migration Plan

Deploy service and repository input contract together. Existing direct-call
fixtures receive an explicit expected snapshot. No migration, feature flag,
destructive operation or web change is required. Coordinator runs guarded
PostgreSQL regressions and repository gates before acceptance.
