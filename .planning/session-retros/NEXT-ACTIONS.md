# NEXT ACTIONS

updated: 2026-05-15T22:46:09+03:00 source: Demo-retro

## RUN FIRST

1. [ ] Confirm both repo states before continuing:
       cd /home/user/work/customreport && git status --short --branch
       cd /home/user/work/core-principles && git status --short --branch

## AGENT

1. [ ] Push the remaining `core-principles` commit if the user wants remote sync:
       cd /home/user/work/core-principles
       git push origin feature/PRJ-1/Demo-plan-session-evidence
2. [ ] Keep the unrelated dirty `customreport` files out of any report-domain or Demo-plan closeout unless the user explicitly assigns them.
3. [ ] Resume customreport work from current repo state, not the older PR #5 ledger.

## HUMAN

1. [ ] Decide whether to push `core-principles` now.

## BLOCKED

1. [ ] No active blocker. `customreport` has unrelated dirty files that should not be cleaned up without an explicit task.

## VERIFY

- cd /home/user/work/customreport && git status --short --branch
- cd /home/user/work/core-principles && git status --short --branch
- cd /home/user/work/core-principles && bash skills/Demo-plan/scripts/plan-self-check.sh /home/user/work/customreport/.planning/plans/2026-05-15-report-domain-data-parity-sweep.md
- cd /home/user/work/core-principles && npm run lint:md
