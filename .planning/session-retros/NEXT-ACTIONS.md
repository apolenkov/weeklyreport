# NEXT ACTIONS

updated: 2026-05-15T22:46:09+03:00 source: peo-retro

## RUN FIRST

1. [ ] Confirm both repo states before continuing:
       cd /Users/ap/work/customreport && git status --short --branch
       cd /Users/ap/work/core-principles && git status --short --branch

## AGENT

1. [ ] Push the remaining `core-principles` commit if the user wants remote sync:
       cd /Users/ap/work/core-principles
       git push origin feature/PRJ-1/peo-plan-session-evidence
2. [ ] Keep the unrelated dirty `customreport` files out of any report-domain or peo-plan closeout unless the user explicitly assigns them.
3. [ ] Resume customreport work from current repo state, not the older PR #5 ledger.

## HUMAN

1. [ ] Decide whether to push `core-principles` now.

## BLOCKED

1. [ ] No active blocker. `customreport` has unrelated dirty files that should not be cleaned up without an explicit task.

## VERIFY

- cd /Users/ap/work/customreport && git status --short --branch
- cd /Users/ap/work/core-principles && git status --short --branch
- cd /Users/ap/work/core-principles && bash skills/peo-plan/scripts/plan-self-check.sh /Users/ap/work/customreport/.planning/plans/2026-05-15-report-domain-data-parity-sweep.md
- cd /Users/ap/work/core-principles && npm run lint:md
