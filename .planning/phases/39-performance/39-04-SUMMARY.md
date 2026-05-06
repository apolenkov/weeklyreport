# Phase 39, Plan 04 — SUMMARY

**REQ-IDs:** PERF-04
**Status:** complete (script + methodology shipped; execution deferred)

## What shipped

- `tests/load/k6-baseline.js` (new) — k6 ramping-VU script:
  - `ramping-vus` executor: 0 → 50 over 30s, 2m steady, 15s ramp-down (overridable via `VUS` and `DURATION` env)
  - per-VU loop: dev-login on iter 0 (cookie persists via k6 jar), then 80% read group (`reports.getActive`, `reports.myHistory`, `weeklyReport.get`) + 20% write group (`reports.saveDraft`)
  - custom Trend metrics `cr_read_latency_ms` / `cr_write_latency_ms` and Rate `cr_trpc_errors`
  - thresholds: p95 read < 300ms, p95 write < 800ms, error rate < 1% (script exit code reflects pass/fail)
  - `handleSummary` writes `.planning/LOAD-TEST-LAST-RUN.json` for cross-run diffs
- `.planning/LOAD-TEST-2026-05.md` (new) — full methodology + run recipe + deferred-CI rationale + verification checklist

## Methodology (calibrated, not generic)

The 80/20 read/write split, the 4 procedure choices, and the threshold values all derive from `.planning/PERF-AUDIT-2026-05.md` (Phase 39-03):

- `reports.getActive` 108 calls / 20ms avg / 261ms tail → in baseline as the first read each iteration
- `reports.myHistory` 113 calls → second read (sidebar history)
- `weeklyReport.get` 402 calls / 27ms avg / 214ms tail → third read (heavy-include lead form)
- `reports.saveDraft` 5 calls / 43ms avg → only mutation a lead repeats (20% probability)

VU `n` maps to `lead<(n%6)+1>@customreport.local` so all 6 seeded leads see proportional load. The think-time jitter (0.3..1.5s) approximates React-Query refetch cadence + human dwell time.

## Why execution is deferred

Same posture as 39-01 (pgbouncer verification) and 38-01 (prod migration init-container) — artefact is the methodology + reproducible script, not a one-time number on shared dev hardware:

- k6 isn't bundled in dev compose (separate ~50MB binary; pollutes prod images if added)
- 50 VUs against the dev stack on the same machine is noisy (Postgres + Redis + 2 Node processes contend for CPU)
- Real numbers require an isolated host; CI integration without consistent hardware is meaningless
- v8.1 candidate: dedicated cr-loadtest image + nightly run on a separate box with results dashboard

## Verification (when k6 is installed)

```bash
docker compose up -d
until curl -sf http://localhost:3002/health/ready >/dev/null; do sleep 1; done
brew install k6                                       # one-time
VUS=2 DURATION=30s k6 run tests/load/k6-baseline.js   # smoke (catches schema drift)
k6 run tests/load/k6-baseline.js                       # full baseline
```

Expected exit 0 with `PASS` on all three threshold lines in the summary. If the saveDraft Zod shape drifts, the smoke run will surface 400s in `cr_trpc_errors`; fix is one localised edit in the script.

## Files

- `tests/load/k6-baseline.js` (k6 script — runnable with `k6 run`)
- `.planning/LOAD-TEST-2026-05.md` (methodology + run recipe)
