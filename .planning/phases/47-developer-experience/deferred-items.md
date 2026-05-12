# Phase 47 — Deferred Items

Items discovered during execution that are out of scope for the current plan.

## From 47-01 (docker compose watch)

### Pre-existing: `luxon` module missing in api container

**Discovered:** 2026-05-10 during 47-01 smoke test.

**Symptom:**

```
api-1 | Error: Cannot find module 'luxon': luxon cannot be resolved in
api-1 |   file:///app/apps/api/src/modules/reminders/policy-applicator.service.ts
api-1 | Failed running 'src/main.ts'. Waiting for file changes before restarting...
```

The container's `node_modules` does not contain `luxon`, but `policy-applicator.service.ts`
(introduced in 44-02 — UFB-036 ReminderPolicy work) imports it. The api container
crash-loops on every restart.

**Out of scope for 47-01:** 47-01 is purely about compose-watch DX. The luxon
dependency gap is a separate runtime / dependency issue in the 44-02 work.

**Fix (separate task):** add `luxon` (and `@types/luxon`) to `apps/api/package.json`,
or rebuild the api image (`docker compose build api`) so the container's `pnpm install`
picks up the dep. If the dep is already in `package.json` but missing in the image,
this is a stale-image issue and `docker compose build --no-cache api` resolves it.

**Impact on 47-01 acceptance:** none. `docker compose watch` is observed to restart
the api container in <3s on file edits — confirmed by `service(s) ["api"] restarted`
in the watch log. The fact that the running process inside the container then
crashes is a separate, pre-existing issue.

### Re-confirmed during 47-03 live `/metrics` smoke-test

**Discovered:** 2026-05-10 during 47-03 step 11 (smoke `curl /metrics`).

The luxon-missing crash-loop is still present (same stack, same module).
Tried `docker exec customreport-api-1 pnpm install --frozen-lockfile` — it
ran the api postinstall (prisma generate) successfully but did NOT
re-create the top-level `node_modules/luxon` symlink because the container
uses a bind-mounted workspace where pnpm's `.pnpm` virtual store has
`luxon@3.7.2` but the top-level symlink layer is stale.

**Smoke-test substitute used in 47-03:** the dedicated unit suite
`apps/api/src/infrastructure/metrics/trpc-metrics.middleware.test.ts` (4
tests, all passing) verifies the same emit contract the live `/metrics`
endpoint would. It exercises:

1. Two successful queries → counter=2, histogram `_count`=2 with labels
   `{procedure="admin.snapshot",type="query",status="success"}`.
2. A `result.ok=false` (`TRPCError`) → counter and `_count` with
   `status="error"`.
3. A raw thrown `Error` in `next()` → re-thrown AND `status="error"`
   recorded.
4. Histogram `_sum` line present and `≥ 0` (timer fires, bucket bounds
   sane); `getSingleMetric` returns the same singletons that the registry
   exports.

The live `/metrics` GET will work the moment the container can boot —
the middleware is registered on every procedure helper and the
`MetricsController` from Phase 37 is unchanged.

**Suggested fix (separate plan):**

1. `docker compose -f docker-compose.yml -f docker-compose.dev.yml stop api`
2. On host: `pnpm install` from repo root (rebuilds top-level symlinks).
3. `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d api`

Or rebuild the image: `docker compose build --no-cache api`.
