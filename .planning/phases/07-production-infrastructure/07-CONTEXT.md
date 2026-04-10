# Phase 7: Production Infrastructure - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — discuss skipped)

<domain>
## Phase Boundary

Application runs as a containerized stack with async job processing, health monitoring, and production-grade operational controls. BullMQ handles PDF export and email reminder jobs via Redis. Docker Compose orchestrates PostgreSQL, Redis, PgBouncer, API, and Web services. Health and metrics endpoints provide operational visibility.

Requirements: JOBS-01, JOBS-02, JOBS-03, JOBS-04, JOBS-05, DOCK-01, DOCK-02, DOCK-03, DOCK-04, DOCK-05, DOCK-06, OBS-01, OBS-02, OBS-03, OBS-04

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Key pitfalls to address (from ROADMAP rationale):
- Pitfall #4: Redis `noeviction` policy for BullMQ (default `allkeys-lru` destroys job metadata)
- Pitfall #6: `workspace:*` in Docker — use `turbo prune` for monorepo Docker builds

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
