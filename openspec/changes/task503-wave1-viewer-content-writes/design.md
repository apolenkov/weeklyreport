# Design

## Context

TASK-503 C0489 real-role native RED confirmed that a retained author can write after Lead→Viewer demotion. wrk42 policy 2026-10-13 13:10 excludes Viewer content writes while retaining review permissions. Existing reports mutations use protectedProcedure, which authenticates but admits every canonical role. ReportSectionsService correctly guards author identity, not role.

## Decision

Keep protectedProcedure and its canonical chain intact. Inside only saveDraft, submit and fillFrom resolvers, call the existing shared assertRole for Lead/Head/Admin before calling the section service. Each resolver emits role-denied using the existing audit logger on FORBIDDEN, then rethrows; the outer canonical mutation audit records a failed mutation with validated input capture. This keeps author/lifecycle/version checks at their existing service owner. Fill-from retains its target and source author checks and its published-lineage lock.

## Alternatives

Global leadProcedure changes would affect unrelated permissions and exclude approved Head/Admin author writes. A new builder or appended middleware would violate exact canonical-chain ownership. The focused resolver check is sufficient.

## Compatibility and verification

Viewer reads and assigned review operations retain their current paths. Current-session role resolution is unchanged. Tests use the real routers and real ReportSectionsService/LeadFormService with repository fixtures to observe saved state, typed errors and audit events. The fill-from fixture uses the existing repository harness with a stateful copy callback; it proves role and ownership admission, not PostgreSQL copy transactions. Root independently repeats real-role native controls and composed gates before acceptance.
