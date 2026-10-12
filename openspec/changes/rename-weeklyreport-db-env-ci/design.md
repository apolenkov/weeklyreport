## Context

The names are literals in the guard (`E2E_DATABASE_NAME`, runtime database pattern, Redis lane pattern), in tests that pin them, in CI job variables, in tester-kit scripts and in coordination docs.

## Decisions

- Rename in one change so that guard code, its tests, CI and docs never disagree about which database is destructible. No alias for the old names: a stale target is rejected by the guard like any other unknown database.
- Order of operations: drop the old synthetic databases under the old guard first, then switch names, then create/reset/seed the new targets under the new guard. Redis DB numbers do not change.
- The generation-only URL (`weeklyreport_generate_only`) is build configuration, not a database target.
- The old shared PostgreSQL role is left in place; a new `weeklyreport` role is used for new targets.

## Risks

- Other sessions holding the old names fail the guard until they rebase; this is intended.
