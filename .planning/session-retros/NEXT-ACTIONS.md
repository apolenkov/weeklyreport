# NEXT ACTIONS

updated: 2026-05-15T17:35:00+03:00 source: peo-retro

## RUN FIRST

1. [ ] Confirm branch is still clean and ahead of origin:
       git status --short --branch
2. [ ] Push the five local commits to PR #5:
       git push origin fix/PRJ-2/uat-v7-2026-05-12
3. [ ] Re-check PR #5 CI after push:
       gh pr view 5 --json mergeStateStatus,statusCheckRollup,url

## AGENT

1. [ ] Keep the Docker MVP stack running for manual UAT unless the user asks to stop it:
       docker compose ps postgres redis mailhog api web
2. [ ] If PR #5 checks become green, merge:
       gh pr merge 5 --merge
3. [ ] Continue broader MVP UAT outside the now-closed Lead Form matrix:
   - reports skeleton/right rail;
   - route-level checks;
   - head/dashboard route smoke;
   - STATE.md phase metric verification.
4. [ ] Keep future parked scope out of MVP unless user reopens it:
   - dark mode / live theme switching;
   - MOB-PARKED mobile signoff;
   - Telegram real integration;
   - i18n;
   - AI telemetry/eval;
   - observability/perf/index/Redis audit;
   - screenshot UI review/background improvements.
5. [ ] Do not create a new git worktree.

## HUMAN

1. [ ] Repeat manual UAT in browser against the running Docker MVP stack:
       http://localhost:3000
2. [ ] Decide next milestone priority after PR #5 is merged.

## BLOCKED

1. [ ] PR #5 is still not mergeable: latest run 277310 is queued; PR mergeStateStatus is UNSTABLE.

## VERIFY

- git status --short --branch
- docker compose ps postgres redis mailhog api web
- curl -fsS http://localhost:3002/health/ready
- pnpm --filter @customreport/web exec playwright test --config=playwright.regression.config.ts e2e/regression/lead-form-uat-recovery.spec.ts --reporter=list
- pnpm --filter @customreport/web lint
- pnpm lint:md
