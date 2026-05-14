# Session Handoff: Agentation Docker Dev Stack

Date: 2026-05-13 23:13 MSK
Project: customreport
Branch: fix/PRJ-2/uat-v7-2026-05-12
Status: Clean and pushed

## Session Summary

Integrated Agentation as a development-only UI feedback tool, verified it in the browser, then fixed the Docker dev stack so the same setup works in containers rather than only in host/node_modules.

A later Agentation page annotation on `/` reported a visual jump in the last-session hint. The login page now reserves a stable text slot, and browser sampling confirmed no movement between skeleton and hydrated states.

## Completed Work

- Commit `f7ef2f6 chore: format repo and add agentation`
  - Added `agentation` to `apps/web`.
  - Added `AgentationDevtools` and root layout wiring.
  - Added `.mcp.json` for `agentation-mcp@1.2.0`.
- Commit `82e415d fix: stabilize docker dev stack and login hint layout`
  - Added Docker ignore rules for large local artifacts such as `.turbo`, `.next-e2e`, `.pnpm-store`, logs, and tsbuildinfo.
  - Fixed API dev Prisma generation to use `../../prisma/schema.prisma`.
  - Stabilized `apps/web/src/app/login-page.client.tsx` last-role status height.

## Current State

- Git clean and synced with `origin/fix/PRJ-2/uat-v7-2026-05-12`.
- `customreport-api-1`, `customreport-web-1`, `customreport-postgres-1`, and `customreport-redis-1` are healthy.
- `http://localhost:3000/` returns 200.
- `http://localhost:3002/health/live` returns ok.
- Agentation MCP is listening on `:4747`.
- Extra host Next dev server on `:3010` was stopped.

## Verification

- `pnpm exec prettier --write apps/web/src/app/login-page.client.tsx docker-compose.dev.yml`
- `git diff --check`
- `pnpm --filter @customreport/web test -- src/app/page.test.tsx`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml build api web`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d api web`
- Browser smoke on `http://localhost:3000/`
  - `statusHeightRange=0`
  - `statusTopRange=0`
  - `hintHeightRange=0`
  - `ctaTopRange=0`
  - `consoleErrors=[]`
  - Agentation toolbar present
  - no visible `Can't resolve 'agentation'` error
- Pre-push `pnpm test` passed.

## Next Steps

No mandatory follow-up remains for this thread.

Optional next agent checks:

- Re-run browser smoke after a fresh machine/container restart.
- If Agentation annotations stop syncing, check `lsof -nP -iTCP:4747 -sTCP:LISTEN` and restart `npx agentation-mcp@1.2.0 server`.
- If Docker rebuild gets slow again, inspect `docker build` context size and update `.dockerignore`.

## Key Files

- `apps/web/src/components/agentation-devtools.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/login-page.client.tsx`
- `.mcp.json`
- `.claude/settings.json`
- `.dockerignore`
- `docker-compose.dev.yml`

## Command Reference

```bash
cd /home/user/work/customreport
docker compose -f docker-compose.yml -f docker-compose.dev.yml ps api web postgres redis
curl -fsS http://localhost:3002/health/live
curl -fsS http://localhost:3000/
lsof -nP -iTCP:4747 -sTCP:LISTEN
```

## Technical Context

The original web error was container drift: the running Docker image did not have `agentation` installed even though host dependencies did. The durable fix is rebuilding images from source plus keeping Docker build context small enough to make rebuilds practical.

The original API container issue was similar drift plus Prisma schema lookup. The dev command now generates Prisma Client with an explicit schema path from `apps/api`.
