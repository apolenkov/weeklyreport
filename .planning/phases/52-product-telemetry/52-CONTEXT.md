# Phase 52: Product Telemetry & Dashboards (STUB)

**Status:** idea — not yet scoped for execution
**Driver:** «ещё важны метрики и телеметрия для дашбордов» (2026-05-10 in-chat capture)
**Distinct from:** Phase 47-03 (tRPC infra telemetry — Prometheus/Grafana for ENGINEERING SLOs). This phase is **product telemetry** — business-readable dashboards for the head and director.

## Scope (idea-level, to be discussed)

- **Big-screen dashboards** for the head — projector-friendly view of:
  - Submission status across reporting groups this period
  - Period-over-period trends (4-8 weeks)
  - Traffic-light health of all active projects
  - Risks/decisions/priorities heatmap
- **Business KPI metrics** captured in addition to tRPC technical metrics:
  - Period completion rate (% of leads submitted by deadline)
  - Average submission time (deadline - submittedAt)
  - Reopen frequency per group
  - Risks logged per week (volume trend)
- **Director-level export**: weekly PDF rollup of all departments
- **Optional Grafana product-dashboard** alongside the engineering dashboard
  from Phase 47-03 (separate folder, separate audience)

## Likely shape

| Plan | Scope                                                                                              |
| ---- | -------------------------------------------------------------------------------------------------- |
| 52-A | Capture business events into a new `BusinessEvent` table (submission, publish, reopen, late, etc.) |
| 52-B | Aggregation views (materialized? or computed on the fly?) for the KPIs above                       |
| 52-C | Head dashboard widget components (extends the existing /head/dashboard)                            |
| 52-D | Big-screen mode (`/head/dashboard?fullscreen=true` with auto-rotate panels)                        |
| 52-E | Director rollup PDF generator (BullMQ job, weekly cron)                                            |

## Dependencies

- Phase 50 (period lifecycle automation — auto-publish events are sources)
- Phase 51 (period state-machine — KPI calculations need stable state transitions)
- Phase 54 (AI RAG, optional — auto-summaries could augment dashboards)

## Open questions for /gsd-discuss-phase

- Audience: head only, or also viewer / director?
- Real-time (live updates) or daily snapshot?
- Embed external BI tool (Metabase, Superset) vs custom panels?
- Anonymized aggregate vs per-lead drill-down?
