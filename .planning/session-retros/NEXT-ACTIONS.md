# NEXT ACTIONS

updated: 2026-05-15T08:31:00+03:00 source: peo-retro

## RUN FIRST

1. [ ] Re-check PR #5 CI when GitHub API responds:
       `gh run list --limit 5`
2. [ ] If latest PR #5 checks are green, merge:
       `gh pr merge 5 --merge`

## AGENT

1. [ ] Re-run CI status check; current `gh` calls return EOF from
       `ghe.example.org`, so the blocker is external API/Actions availability.
2. [ ] After merge, verify `main` and tag/release only if the project policy
       still expects v8.1 tagging.
3. [ ] Keep Docker MVP stack running for manual UAT unless the user asks to stop
       it.
4. [ ] If the user says "продолжай", start from PR/CI status, not from another
       planning loop.

## HUMAN

1. [ ] Repeat manual UAT in browser against the running MVP stack:
       `http://localhost:3000`.
2. [ ] Choose the next milestone priority after PR #5 closes:
       future UI/theme/Safari/Telegram/AI telemetry/perf work is parked in
       `.planning/todos/pending/2026-05-14-future-ui-telemetry-coming-soon.md`.

## BLOCKED

1. [ ] PR #5 final merge is blocked until GitHub Actions returns a real green
       run. Last live API calls failed with `EOF`.

## VERIFY

- `git status --short --branch`
- `docker compose ps postgres redis mailhog api web`
- `curl -fsS http://localhost:3002/health/ready`
- `curl -fsS -o /tmp/customreport-web.html -w '%{http_code} %{content_type} %{size_download}\\n' http://localhost:3000/`
- `gh run list --limit 5`
- `gh pr view 5 --json mergeStateStatus,statusCheckRollup,url`
