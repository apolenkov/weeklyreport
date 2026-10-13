# Design

## Context

TASK-503 C0489 real-role native RED confirmed that a retained author can write after Lead→Viewer demotion. wrk42 policy 2026-10-13 13:10 excludes Viewer content writes while retaining review permissions. Existing reports mutations use protectedProcedure, which authenticates but admits every canonical role. ReportSectionsService correctly guards author identity, not role.

## Decision

Keep protectedProcedure and its canonical chain intact. Inside only saveDraft and submit resolvers, call the existing shared assertRole for Lead/Head/Admin before calling ReportSectionsService. A private router guard emits role-denied using the existing audit logger on FORBIDDEN, then rethrows; the outer canonical mutation audit records a failed mutation with validated input capture. This keeps author/lifecycle/version checks at their existing service owner.

## Alternatives

Global leadProcedure changes would affect unrelated permissions and exclude approved Head/Admin author writes. A new builder or appended middleware would violate exact canonical-chain ownership. The focused resolver check is sufficient.

## Compatibility and verification

Viewer reads and assigned review operations retain their current paths. Current-session role resolution is unchanged. Tests use the real router and real ReportSectionsService with the existing in-memory repository fixture to observe saved state, typed errors and audit events. Root independently repeats real-role native controls and composed gates before acceptance.
