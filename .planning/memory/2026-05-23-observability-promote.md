---
name: observability-phase68-decisions
description: Locked decisions for Phase 68 full observability stack
metadata:
  type: project
date: 2026-05-23
---

# Phase 68 Observability — Locked Decisions

Phase promoted from pending-todo
`.planning/todos/pending/2026-05-14-future-ui-telemetry-coming-soon.md`
into active Phase 68 on 2026-05-23.

**Why:** Developer needs full observability locally to audit errors and
performance metrics via Claude Code agent reading `app.log`.

## Four locked decisions (user-confirmed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Isolation | git worktree `../customreport-obs` | PRJ-2 work parallel on shiny-eagle |
| Error tracking | Bugsink | 1 container, MIT, @sentry/* SDK compatible |
| OTel/metrics/logs/traces | `grafana/otel-lgtm` monolith | ARM64-native, single container |
| Log coverage | Maximum + Web Vitals + Prisma slow | All events through AppLogger |

## Branch

`obs/v8.3-full-observability` in worktree `/Users/ap/work/customreport-obs`

**How to apply:** when resuming observability work, cd to
`/Users/ap/work/customreport-obs` and check branch
`obs/v8.3-full-observability`.
