## Why

The product is renamed from CustomReport to WeeklyReport (Backlog TASK-369, decision-161: no compatibility layer, no aliases, synthetic databases are recreated with an explicit seed). The destructive-database guard, Redis resolver, bootstrap/reset/seed scripts, env schema, CI and coordination rules still name the old disposable databases and the old env variable.

## What Changes

- The exact approved disposable targets become `weeklyreport_e2e` and the provisioned lanes `weeklyreport_e2e_lane_a_test` / `weeklyreport_e2e_lane_b_test`; the guard pattern, the Redis resolver pattern and the seeded mailbox domain (`@weeklyreport.local`) follow.
- The optional dev-only env variable `CUSTOMREPORT_REPO_ROOT` becomes `WEEKLYREPORT_REPO_ROOT`.
- Redis DB assignment (15 main, 1 lane a, 2 lane b; 0/13/14 never touched), guard consent, loopback checks and all other requirements stay as they are; only names change.

## Impact

- Affected specs: `destructive-db-guard`, `env-schema-coverage`, `reset-script-redis-flush`, `operations-local-readiness`, `behavioral-ui-regression-gate` (name-only MODIFIED requirements).
- Local synthetic databases are dropped under the old guard and recreated under the new names with a guarded reset and an explicit seed. The shared PostgreSQL role `customreport` is not removed (separate, coordinator-approved step).
- No server deployment and no production data are in scope.
