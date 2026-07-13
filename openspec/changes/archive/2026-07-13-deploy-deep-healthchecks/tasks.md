## 1. PgBouncer query-path healthcheck

- [ ] 1.1 Determine which query-capable client is available in the
      `edoburu/pgbouncer:1.22.1-p2` image (e.g. `docker run --rm
--entrypoint sh edoburu/pgbouncer:1.22.1-p2 -c 'which psql pg_isready'`).
      If neither `psql` nor another SQL client is present, pick the
      lightest addition that is (a one-off Alpine package layer is
      out of scope for this change — prefer whatever ships in the image)
- [ ] 1.2 Replace `docker-compose.prod.yml`'s pgbouncer `healthcheck.test`
      with a command that connects to `127.0.0.1:5432` (pgbouncer's own
      listener, not `postgres:5432` directly — the probe must exercise the
      same path client traffic takes) and runs `SELECT 1` (or equivalent)
      against the `customreport` database using `DB_USER`/`DB_PASSWORD`
      already present in the service's environment
- [ ] 1.3 Confirm the command's exit code is non-zero on query failure
      (auth error, connection refused, timeout) and zero only when the
      query actually returns — a bare TCP-connect fallback defeats the
      purpose of this change
- [ ] 1.4 Keep the existing `interval`/`timeout`/`retries`/`start_period`
      values unless the new command's latency requires adjusting `timeout`

## 2. Reconcile Dockerfile.api's baked HEALTHCHECK with compose

- [ ] 2.1 `Dockerfile.api`: change the baked `HEALTHCHECK` `CMD` target from
      `http://localhost:3001/health/live` to
      `http://localhost:3001/health/ready`
- [ ] 2.2 `Dockerfile.api`: bump the baked `HEALTHCHECK`'s `--start-period`
      from `15s` to `60s`, matching `docker-compose.prod.yml`'s api service
      override, so a standalone container isn't marked unhealthy during its
      normal migrate+bootstrap window
- [ ] 2.3 Update the comment above the `HEALTHCHECK` line and the comment
      above the compose-level `api.healthcheck` block so both explain the
      reconciled endpoint and that the compose override now exists for its
      tuned intervals, not because the endpoints differ
- [ ] 2.4 Leave `docker-compose.prod.yml`'s `api.healthcheck` block in
      place; do not remove the override

## 3. Verification

- [ ] 3.1 `docker compose -f docker-compose.prod.yml config` — confirms the
      compose file still parses after the healthcheck edit
- [ ] 3.2 Build the api image and run the baked `HEALTHCHECK` standalone
      (`docker inspect --format='{{json .State.Health}}'` after a `docker
run` with no linked dependencies) — expect it to report `unhealthy`
      once the start-period elapses, not `healthy`, confirming the
      liveness-only false-positive is closed
- [ ] 3.3 Bring up the full `docker-compose.prod.yml` stack in a
      non-production environment and confirm the pgbouncer service reports
      `healthy` under normal conditions, then simulate a query-path failure
      (e.g. stop the `postgres` service while `pgbouncer` keeps its TCP
      listener open) and confirm the pgbouncer healthcheck flips to
      `unhealthy` rather than staying `healthy`
- [ ] 3.4 `openspec validate deploy-deep-healthchecks --strict`
