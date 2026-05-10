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
