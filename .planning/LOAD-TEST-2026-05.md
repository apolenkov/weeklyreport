# Load Test Baseline — Phase 39-04 (2026-05-06)

**Methodology:** k6 ramping-VU scenario calibrated to the **real-traffic mix**
captured in `apps/api/.logs/api.log` during 2026-05-04..05 dev usage (see
`PERF-AUDIT-2026-05.md`). The 80/20 read/write split, the procedure choice
(`reports.getActive`, `reports.myHistory`, `weeklyReport.get`, `reports.saveDraft`),
and the per-iteration think-time are all derived from observed lead behaviour
— not invented.

**Status:** script + methodology shipped; **execution deferred** until k6 is
installed on the target host (not bundled in dev compose) and the prod stack
from Phase 38 is up. This is the same posture as 39-01's pgbouncer
verification (deferred to prod-up).

---

## 1. Scenario

```
ramping-vus:
  startVUs:  0
  stages:
    - duration: 30s   target: 50    (ramp up)
    - duration: 2m    target: 50    (steady)
    - duration: 15s   target:  0    (ramp down)

per-VU loop:
  iter 0:  GET /auth/dev-login?role=lead&email=lead<n>@customreport.local
           (one-time, cookie persists across iterations via k6 jar)
  iter N:  read group (always):
             reports.getActive                  → tag: trpc.reports.getActive
             reports.myHistory  { limit: 20 }   → tag: trpc.reports.myHistory
             weeklyReport.get   { reportId:null}→ tag: trpc.weeklyReport.get
           write group (20% of iters):
             reports.saveDraft  { patches: [...] } → tag: trpc.reports.saveDraft
  think-time: 0.3..1.5s between procs (uniform jitter)
```

VU `n` maps to `lead<(n%6)+1>@customreport.local` so all 6 seeded leads see
proportional load. AUTH_DEV_MODE must be `true` on the API (it is in `docker-compose.yml`).

## 2. Targets (calibrated)

| Metric                | Target      | Rationale                                                                                   |
| --------------------- | ----------- | ------------------------------------------------------------------------------------------- |
| `cr_read_latency_ms`  | p95 < 300ms | Top-of-tail for `reports.getActive` was 261ms in dev — leave headroom                       |
| `cr_write_latency_ms` | p95 < 800ms | `reports.saveDraft` averaged 43ms in dev (5 calls); 800 = 19x slack for prod CPU contention |
| `cr_trpc_errors`      | rate < 1%   | Anything above is real (401 session expiry would be the noise floor)                        |
| `http_req_failed`     | rate < 1%   | k6 default — sanity floor                                                                   |

If targets fail at 50 VUs:

- p95 read > 300ms → check pg_stat_statements for new top entries; likely a missed index from PERF-AUDIT
- p95 write > 800ms → check pgbouncer `SHOW POOLS`; bouncer queue suggests pool=20 too small
- error rate > 1% → likely 429 from rate-limiter (auth bucket = 5/min/IP) — k6 runs from one IP, login storm

## 3. Run recipe

```bash
# Local dev stack
docker compose up -d
# Wait for /health/ready
until curl -sf http://localhost:3002/health/ready >/dev/null; do sleep 1; done

# Install k6 (one-time, host-specific)
brew install k6                            # macOS
# OR sudo apt install k6                   # Debian/Ubuntu

# Default run (50 VUs, 2m steady)
k6 run tests/load/k6-baseline.js

# Custom run (e.g. against staging)
k6 run -e API_URL=https://staging-api.example.com \
       -e VUS=100 -e DURATION=5m \
       tests/load/k6-baseline.js

# Export full JSON summary for diffs over time
k6 run --summary-export=.planning/LOAD-TEST-LAST-RUN.json tests/load/k6-baseline.js
```

The script auto-emits `.planning/LOAD-TEST-LAST-RUN.json` via `handleSummary`
even without the `--summary-export` flag.

## 4. Why k6 not in CI yet

- k6 is a separate binary (~50MB); adding it to the existing `api` /
  `web` Docker images is wrong (pollutes prod artefacts). A separate
  `cr-loadtest` image would be cleaner — deferred to v8.1.
- 50 concurrent VUs against the dev stack on the same machine is noisy
  (Postgres + Redis + 2 Node processes all share CPU). Real numbers
  require an isolated test box. CI integration is meaningless without
  consistent hardware.
- The artefact for v8.0 is the **methodology + script**, not a recurring
  CI gate. v8.1 candidate: nightly run on a dedicated load-test host
  with results posted to a dashboard.

## 5. What this complements

- `PERF-AUDIT-2026-05.md` (Phase 39-03) — captures real-traffic shape and
  validates the 18 indexes added to schema.
- `pg_stat_statements` (39-03) — the live observability story; k6 stresses
  the system, pg_stat_statements answers "what's slow now".
- pgbouncer (39-01) — the connection-pooling story; k6 at 50+ VUs is the
  test that proves the pool=20 sizing is right (`SHOW POOLS` should show
  `cl_active` capping near pool size, not exploding).

## 6. Deferred / out-of-scope (v8.1 candidates)

- **k6 cloud / distributed run** — tests/load/k6-baseline.js is local-only;
  k6 cloud needs a paid plan and an account. Not v8.0.
- **Per-procedure trend metrics on /metrics** — currently we get k6 trends
  in stdout/JSON only. Wiring a metrics-emitting layer (k6 Prometheus
  remote-write) is a v8.1 polish.
- **Soak test (8h+)** — baseline is 2m steady; soak reveals leak / DLQ
  growth patterns. Needed before customer rollout, not for v8.0 ship.
- **Mixed-role scenario** — current scenario is leads-only; admins poll
  4 procedures every ~5s (PERF-AUDIT § 1) and head publishes weekly. A
  realistic prod simulation is leads + admin polling + head submit cycle.
  Defer until customer load profile is known.

## 7. Verification of script correctness (deferred — needs running stack)

```bash
# Smoke run with low VUs first to confirm schema matches Zod
VUS=2 DURATION=30s k6 run tests/load/k6-baseline.js
# Expect: 0 cr_trpc_errors. If saveDraft 400s, the patches[] shape diverged
# from the live schema — open apps/api/src/modules/reports/* and re-align.

# Then full run
VUS=50 DURATION=2m k6 run tests/load/k6-baseline.js
# Expect: PASS on all three threshold lines in the summary.
```

If schema drift breaks the saveDraft shape, the fix is one localised edit
in the k6 script — the read paths (`getActive`, `myHistory`, `weeklyReport.get`)
take only `{ reportId? }` / `{ limit? }` so they're stable across schema
revisions.
