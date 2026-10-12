# Design

## Context

See proposal.md for the accepted doc422/ADR178 policy. Ordinary group and user writers already share the user-first identity lock. Restore locks the current graph, overlays snapshot users/groups, validates the final graph, writes groups without head pointers, then users and head pointers. Existing role-only guards leave membership unconstrained.

## Goals / Non-Goals

**Goals:** enforce the same Head membership predicate at each admitted input/write boundary, preserve atomic valid restores and Admin cross/multiple headings.

**Non-Goals:** active-pointer policy, permission grants, pointer repair, lock-order redesign, migrations, performance optimization.

## Decisions

- Pass the concrete target group id into the existing locked head guard and read reportingGroupId together with role under its current User lock. No separate unlocked membership lookup is needed.
- The ordinary user guard examines all headed group ids against the desired role/group. Admin remains eligible for every group; Head is eligible only for a matching group. Looking only at the first heading misses Admin-to-Head multi-group transitions.
- Shared snapshot validation evaluates snapshot pointers against snapshot users. The locked merged graph evaluates retained live pointers as well. Preserve the existing overlay before validation and apply head pointers after upsertUsers, so a simultaneous old-pointer clear/reassignment and user move is judged by its final graph.
- Reuse existing conflict errors and boundary owners. Avoid a new shared helper/API or schema seam for a short predicate; actual transaction tests verify its consistency across writers.

## Risks / Trade-offs

- Existing incompatible pointers would make recovery fail closed → Root performed a guarded readonly synthetic inventory, observing zero mismatches; unknown targets need their own inventory and concrete repair plan.
- Pure helper/schema tests do not prove transaction serialization → both real PG interleavings, rollback and persisted graph checks remain required in Root's reserved lane, followed by browser acceptance.
- Snapshot input and merged live graph cover different boundaries → test both foreign snapshot pointers and retained live pointers omitted by a partial additive payload.

## Migration Plan

No schema migration or automatic record mutation. Root delivers this isolated patch with normal hooks after appropriate boundaries; final aggregate gates/review and OpenSpec sync/archive stay with Root. A source rollback removes the new membership enforcement without changing records.
