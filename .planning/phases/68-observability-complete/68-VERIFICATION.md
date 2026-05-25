---
phase: 68
title: Full Local Observability — Verification
---

# Phase 68 — Verification

Run after Wave 4 completes.

```bash
# Gates
pnpm typecheck
pnpm lint
pnpm test
pnpm lint:md

# Compose configs valid
docker compose -f docker-compose.observability.yml config
docker compose -f docker-compose.errors.yml config

# Doc drift fixed
grep -nE '3010|jaeger' docs/OBSERVABILITY-ONBOARDING.md  # expect: empty

# traceId in logger
grep -nE 'trace.getActiveSpan' apps/api/src/lib/logger.ts  # expect: ≥1

# Domain logs added
grep -rnE 'logger\.(info|warn|debug)\(' \
  apps/api/src/modules/report-sections \
  apps/api/src/modules/review \
  apps/api/src/modules/weekly-report \
  apps/api/src/modules/search  # expect: ≥4 matches

# Commit count
git log --oneline -20 | grep -cE 'obs-w[0-4]'  # expect: ≥11

# Stack smoke (after docker up)
curl -fsS http://localhost:3003/api/health    # Grafana
curl -fsS http://localhost:8000/              # Bugsink
curl -fsS http://localhost:3002/health/live   # API
curl -s http://localhost:3002/metrics | grep web_vital_lcp
tail -n 20 apps/api/.logs/app.log | jq '{traceId, correlationId, phase}'
```
