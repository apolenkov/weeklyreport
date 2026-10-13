# Proposal

## Why

A user demoted from Lead to Viewer can still save or submit a retained authored section through the reports API. Viewer report content is read-only: wrk42 confirmed this policy on 2026-10-13 at 13:10, and the real-role native RED reproduced the write after demotion (TASK-503 C0489).

## What Changes

- Reject Viewer in reports.saveDraft and reports.submit before invoking the section service.
- Keep the existing protected procedure chains, input capture, role-denied and failed mutation audit events.
- Retain Lead, Head and Admin own-section writes and the service author guard.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `report-section-write-gates`: require a content-writing role for save and submit, even when a Viewer remains the section author.

## Impact

Only reports.router.ts and its colocated role/ownership regression tests. Owning contracts: report-section-write-gates, viewer-report-navigation, role-coverage-gate. No dependencies or schema changes. Root owns native GREEN, six gates and accepted commit.

## Non-goals

- No global leadProcedure or canonical middleware-builder changes.
- No change to report reads, reviewer comments, acknowledgements or verdicts.
- No bypass of section ownership, lifecycle or version gates.
