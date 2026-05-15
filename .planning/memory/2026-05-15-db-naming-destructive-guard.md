# Session Handoff: DB Naming And Destructive Guard Rule

Date: 2026-05-15 08:46 MSK Project: CustomReport + core-principles
Status: recovered from unstaged resume context; preserve before continuing

## Session Summary

The session started from a review finding: the shortened CustomReport
`CLAUDE.md` mentioned `POSTGRES_DB` but not the `DATABASE_URL` database name
that `prisma/_destructive-guard.ts` actually parses. The fix was expanded from
a local wording patch into a source-of-truth cleanup.

The user then clarified the main requirement: environment names must be clear,
and repo-level `CLAUDE.md` should carry an abstract rule, not a list of
CustomReport-specific database names.

## Completed Work

- CustomReport `CLAUDE.md` stays abstract:
  - environment names must match purpose;
  - docs/config/guards must align on the same target variable.
- CustomReport concrete docs/config now use clear names:
  - local dev and Docker verifier: `customreport_dev`
  - API integration: `customreport_test`
  - web integration: `customreport_e2e`
  - no active manual UAT/staging DB now; `customreport_uat` is reserved only
    if such an environment is explicitly created later
  - production: `customreport`
- Docker dev compose output was verified to use `customreport_dev` for
  `POSTGRES_DB`, `DATABASE_URL`, and `DIRECT_URL`.
- core-principles got the reusable destructive DB guidance:
  guard docs/config must describe the actual target the guard parses.

## Current State

- CustomReport branch: `fix/PRJ-2/uat-v7-2026-05-12`
- core-principles branch mentioned by the recovered note:
  `feature/PRJ-1/v2.23-control-clarity`
- User decision: separate manual UAT/staging environment is not needed now.
- This note was recovered after a pre-commit/lint-staged stash restore, so
  verify live `git status` before acting on commit hashes from older handoffs.

## Next Steps

1. Re-check `git status --short --branch` in both repos before new DB/env work.
2. If resuming DB/env work, keep `CLAUDE.md` abstract and concrete names in
   operations docs/config only.
3. Do not create a manual UAT/staging contour unless the user reopens it.
4. Keep the reserved `customreport_uat` wording in docs only as future scope.

## Key Files

- `/home/user/work/customreport/CLAUDE.md`
- `/home/user/work/customreport/docker-compose.yml`
- `/home/user/work/customreport/docker-compose.dev.yml`
- `/home/user/work/customreport/docker-compose.observability.yml`
- `/home/user/work/customreport/docs/OPERATIONS.md`
- `/home/user/work/core-principles/catalog/claude-md/sources/security.md`
- `/home/user/work/core-principles/catalog/claude-md/sources/rules-behavior.md`
- `/home/user/work/core-principles/docs/workflow/security.md`

## Command Reference

```bash
git -C /home/user/work/customreport status --short --branch
git -C /home/user/work/core-principles status --short --branch
cd /home/user/work/customreport && pnpm lint:md
cd /home/user/work/customreport && docker compose -f docker-compose.yml -f docker-compose.dev.yml config | rg -n "DATABASE_URL|DIRECT_URL|POSTGRES_DB|customreport_(dev|uat|test|e2e)" -C 1
cd /home/user/work/core-principles && npm run lint:md
```

## Technical Context

Do not reintroduce concrete CustomReport DB names into repo-level `CLAUDE.md`.
The correct split is:

- abstract rule in `CLAUDE.md`;
- concrete names in `docs/OPERATIONS.md`, compose files, and env examples;
- reusable cross-repo rule in core-principles security sources.
