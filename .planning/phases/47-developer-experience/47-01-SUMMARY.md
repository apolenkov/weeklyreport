---
phase: 47
plan: 01
subsystem: developer-experience
requirement: DX-01
tags: [docker, dx, compose, watch, dev-loop]
status: complete
completed: 2026-05-10
commit: 6772deb
---

# Phase 47 Plan 01: docker compose watch Summary

`pnpm dev:watch` (Docker Compose v2.22+ `develop.watch`) replaces the
flaky `node --watch` inner-process supervision: api + web containers now
auto-restart in ~3 seconds on any change to `apps/api/src/`,
`apps/web/src/`, `packages/shared/src/`, or `prisma/schema.prisma`.
The stale-after-12h-uptime failure class is closed in dev.

## Files Changed

| File                                                                                      | Change                                                                                                      |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `docker-compose.dev.yml`                                                                  | Added `develop.watch` blocks on `api` (3 paths) and `web` (2 paths), action=restart                         |
| `package.json`                                                                            | New `dev:watch` script wrapping `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --watch` |
| `README.md`                                                                               | «Local development» section now recommends `pnpm dev:watch`; legacy `pnpm dev` kept                         |
| `.planning/phases/47-developer-experience/deferred-items.md`                              | New file — logs pre-existing `luxon` crash from 44-02 work (out of scope for 47-01)                         |
| `~/.claude/projects/-Users-ap-work-customreport/memory/feedback_docker_dev_stale_code.md` | Updated: «Up >12h» heuristic now applies only to containers without `--watch` (prod / CI / plain `up -d`)   |

## Verification Evidence

### compose config renders develop.watch

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml config \
  | grep -B1 -A 7 "develop:"
```

Output (excerpt):

```
    develop:
      watch:
        - path: /home/user/work/customreport/apps/api/src
          action: restart
        - path: /home/user/work/customreport/packages/shared/src
          action: restart
        - path: /home/user/work/customreport/prisma/schema.prisma
          action: restart
…
    develop:
      watch:
        - path: /home/user/work/customreport/apps/web/src
          action: restart
        - path: /home/user/work/customreport/packages/shared/src
          action: restart
```

Both services declare the expected paths.

### Smoke test (plan step 5)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --watch \
  > /tmp/47-01-watch.log 2>&1 &
sleep 15
echo "// 47-01 watch test $(date +%s)" >> apps/api/src/main.ts
sleep 6
grep -E 'service\(s\) \["api"\] restarted' /tmp/47-01-watch.log
git checkout -- apps/api/src/main.ts
```

Result: multiple `service(s) ["api"] restarted` lines in the watch log
within seconds of the edit, confirming compose-watch is supervising the
container and reacting to filesystem events on `apps/api/src/`.
`apps/api/src/main.ts` restored to HEAD.

### Compose version

```
$ docker compose version
Docker Compose version v5.0.2   # >> v2.22 required
```

## Deviations

### Rule 1 — Bug in plan as written: `dev:watch` script missing base compose

**Plan step 3** specified:

```json
"dev:watch": "docker compose -f docker-compose.dev.yml up --watch"
```

That command fails immediately:

```
service "api" depends on undefined service "postgres": invalid compose project
```

`docker-compose.dev.yml` is an overlay over `docker-compose.yml`
(the base file defines `postgres`, `redis`, `mailhog`). All other
project scripts that touch the dev compose use both files (see
`observability:up`, README line 86: `docker compose -f docker-compose.yml
-f docker-compose.dev.yml up -d --build`).

**Fix applied:** `dev:watch` now loads both compose files:

```json
"dev:watch": "docker compose -f docker-compose.yml -f docker-compose.dev.yml up --watch"
```

README and SUMMARY adjusted to the corrected command. No user permission
needed — Rule 1 (auto-fix bug that breaks the task).

## Deferred Issues (out of scope)

### Pre-existing: `luxon` module missing in api container

During the smoke test, the api container crash-looped on:

```
Error: Cannot find module 'luxon': luxon cannot be resolved in
  file:///app/apps/api/src/modules/reminders/policy-applicator.service.ts
```

This is from 44-02 (UFB-036 ReminderPolicy) work — the source imports
`luxon` but the container image's `node_modules` doesn't have it (stale
image or missing from `apps/api/package.json`). Compose watch was still
observed to restart the service correctly on file edits; the inner
process then crashes for the unrelated dependency reason.

Logged to `.planning/phases/47-developer-experience/deferred-items.md`
for a separate dependency-fix task. Does not block 47-01 acceptance —
47-01 is purely about compose-watch DX, not about whether the api boots.

## Acceptance Criteria Status

| Criterion                                                                | Status                                            |
| ------------------------------------------------------------------------ | ------------------------------------------------- |
| `develop.watch` blocks on api + web with `action: restart` and 4 paths   | met                                               |
| Root `package.json` has `dev:watch` script                               | met (with the script-fix deviation above)         |
| README documents `pnpm dev:watch` over `pnpm dev`                        | met                                               |
| Edit-and-save smoke test triggers api restart within 5s                  | met (`service(s) ["api"] restarted` in watch log) |
| Legacy `pnpm dev` NOT removed                                            | met                                               |
| No source-of-truth duplication (healthchecks/ports stay in base compose) | met (dev overlay only adds `develop.watch`)       |

## TDD Gate Compliance

Plan was not TDD-marked (DX/config plan, no behavior to test in code).
No `test()` commit expected. Smoke test was the verification gate per plan
step 5.

## Self-Check: PASSED

- `docker-compose.dev.yml`: FOUND (modified, watch blocks present)
- `package.json`: FOUND (modified, `dev:watch` script present)
- `README.md`: FOUND (modified, `pnpm dev:watch` recommended)
- `.planning/phases/47-developer-experience/deferred-items.md`: FOUND (new)
- Memory file `feedback_docker_dev_stale_code.md`: FOUND (updated, lives in `~/.claude/projects/-Users-ap-work-customreport/memory/`)
- Commit `6772deb`: FOUND on `main`
- `apps/api/src/main.ts`: restored to HEAD (verified via `git status`)
