---
phase: 68
title: Full Local Observability — Plan Reference
---

# Phase 68 — Plan

Full plan: `.planning/plans/tingly-wandering-brooks.md`

## Wave execution status

- [ ] Wave 0 — pre-flight (worktree + scaffold + promote todo)
- [ ] Wave 1 — otel-lgtm + bugsink + sentry sdk + doc fixes (parallel x4)
- [ ] Wave 2 — traceId + logger unify + web vitals + domain logs (parallel x4)
- [ ] Wave 3 — prisma slow + alertmanager + env hygiene (parallel x3)
- [ ] Wave 4 — 10-condition self-check + commits + push

## 10 Done conditions

1. `pnpm typecheck` exit 0
2. `pnpm lint` exit 0
3. `pnpm test` exit 0 (baseline-stable)
4. `pnpm lint:md` exit 0
5. `docker compose -f docker-compose.observability.yml config` exit 0
6. `docker compose -f docker-compose.errors.yml config` exit 0
7. `grep -nE '3010|jaeger' docs/OBSERVABILITY-ONBOARDING.md` empty
8. `grep -nE 'trace.getActiveSpan' apps/api/src/lib/logger.ts` ≥1
9. `grep -rnE 'logger.(info|warn|debug)'` in 4 service dirs ≥4 matches
10. `git log --oneline -20 | grep -cE 'obs-w[0-4]'` ≥11 commits
