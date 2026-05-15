# NEXT ACTIONS

updated: 2026-05-15T09:05:00+03:00 source: Demo-retro

## RUN FIRST

1. [ ] Re-check current branch and working tree:
       `git status --short --branch`
2. [ ] Re-check PR #5 CI when GitHub API responds:
       `gh run list --limit 5`
       `gh pr view 5 --json mergeStateStatus,statusCheckRollup,url`

## AGENT

1. [ ] If latest PR #5 checks are green, merge:
       `gh pr merge 5 --merge`
2. [ ] Keep Docker MVP stack running for manual UAT unless the user asks to stop
       it:
       `docker compose ps postgres redis mailhog api web`
3. [ ] Preserve the DB naming rule recovered from resume:
   - local dev and Docker verifier: `customreport_dev`
   - API integration: `customreport_test`
   - web integration: `customreport_e2e`
   - no active manual UAT/staging DB now; reserve `customreport_uat` only if
     such an environment is explicitly created later
   - production: `customreport`
4. [ ] If changing DB/env docs again, keep `CLAUDE.md` abstract and put concrete
       names only in operations docs/config examples.
5. [ ] Do not create a new `git worktree`.

## HUMAN

1. [ ] Repeat manual UAT in browser against the running MVP stack:
       `http://localhost:3000`.
2. [ ] Choose the next milestone priority after PR #5 closes:
       future UI/theme/i18n/MOB-PARKED/Telegram/AI telemetry/perf work is parked in
       `.planning/todos/pending/2026-05-14-future-ui-telemetry-coming-soon.md`.

## BLOCKED

1. [ ] PR #5 final merge is blocked until GitHub Actions returns a real green
       run. Last live API calls failed with `EOF`.

## VERIFY

- `git status --short --branch`
- `pnpm lint:md`
- `docker compose ps postgres redis mailhog api web`
- `curl -fsS http://localhost:3002/health/ready`
- `curl -fsS -o /tmp/customreport-web.html -w '%{http_code} %{content_type} %{size_download}\n' http://localhost:3000/`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config | rg -n "DATABASE_URL|DIRECT_URL|POSTGRES_DB|customreport_(dev|uat|test|e2e)" -C 1`
