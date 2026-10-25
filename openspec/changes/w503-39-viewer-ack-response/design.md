# Design

## Context

See proposal.md and the external Root decision. The existing leadership router
admits Viewer and the service applies group scope before parsing the repository
array. The repository returns names. Viewer UI uses only own-id membership;
Head/Admin additionally display names. Shared `userName` is already optional.

## Goals / Non-Goals

Deliver the adopted role-specific contract and its response shaping at the
existing public router with the real service. PostgreSQL, HTTP transport and
browser evidence remain separate.

## Decisions

```text
Before: Viewer -> leadership/group gates -> raw named roster -> Viewer client
After:  Viewer -> same gates -> own four-field receipt array -> Viewer client
        Head/Admin -> same gates -> existing scoped named roster
```

Keep endpoint, array and canonical leadership chain. This preserves the existing
Viewer own-state consumer and optional-name schema without endpoint splitting or
new response unions. The admitted implementation shapes the service response,
where the actor and parsed repository data meet; the intended RED preceded it and
the coordinator recorded the product-fix admission. `canReview` is a separate
write entitlement and does not widen roster reading.

Use the existing router suite with real `ReviewActionsService`, substituting
only its repository port with unfiltered named receipts. Existing trap-service
Lead write guards stay intact. This detects response shaping and role/scope
mapping without test-only production seams or a database fixture.

## Risks / Trade-offs

- Stripping names alone can retain peer ids/receipts → assert exact response rows.
- Denying the Viewer entirely can masquerade as minimization → positive own-state
  responses must resolve successfully.
- Fixture-backed caller tests do not prove SQL or network payloads → retain that
  limit and require separate admission for native evidence.
- A valid actor/group check must not be widened → include Head/Viewer foreign
  group, Lead and missing-session controls.

## Migration Plan

No schema or dependency migration. The delivered change is the admitted service
shaping with its focused RED/GREEN and controls; independent review and the
normal delivery gates close it. Rollback must not silently restore peer
identities to the Viewer response.
