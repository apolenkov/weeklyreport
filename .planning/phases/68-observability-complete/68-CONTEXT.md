---
phase: 68
title: Full Local Observability + Sentry-Compatible Error Tracking
status: in-progress
started: 2026-05-23
branch: obs/v8.3-full-observability
worktree: /home/user/work/customreport-obs
---

# Phase 68 — Context

## Why

Developer needs a fully instrumented local environment where errors, traces,
logs, and web vitals are captured in persistent files and UIs so Claude Code
agents can read and audit them between sessions.

## Locked decisions

- **Isolation**: git worktree `../customreport-obs` (avoids PRJ-2 conflicts)
- **Error tracking**: Bugsink (1 container, MIT, `@sentry/*` SDK compatible)
- **OTel/metrics/logs/traces**: `grafana/otel-lgtm` monolith
- **Log coverage**: maximum — Web Vitals + Prisma slow via AppLogger

## Plan

See `.planning/plans/tingly-wandering-brooks.md` (the approved plan file).

## Prior state (Phase 37 + Phase 52 baseline)

- prometheus + grafana running in observability compose
- AppLogger (custom, JSON rotation) in api; logs to `app.log` if LOG_DIR set
- prom-client ~15 metrics, OTel SDK disabled by default
- No Sentry/Bugsink, no Loki, no Tempo, no traceId in logs
