<!-- markdownlint-disable MD013 -->

# Perf opportunities — log-evidence pass (2026-05-22)

Source: `apps/api/.logs/api.log` after the minimal UAT reseed
(`db:wipe:manual-uat`) + live lead-report browsing. The structured slow-query
log (GAP-02, `phase=db.query`, threshold 100 ms) is confirmed firing.

## Captured slow queries (structured)

```text
total slow (structured) : 28
max durationMs           : ~192 ms
median durationMs        : ~120 ms
by table : StageAssignment 5 · User 4 · StageStatus 3 · Risk 3
           ReportSection 3 · ProjectStatus 3 · Item 3 · Decision 3
           VersionSnapshot 1 · Report 1
```

## Evidence-backed conclusion: NO index/cache change justified now

The seed is tiny (7 leads, 6 products, 7 sections, 12 stage assignments). A
`SELECT` over a 7-row `User` table logging 114 ms is **not** a missing-index
signal — at this row count the planner does a trivial scan. The 100–250 ms
durations are dominated by cold-start / dev-mode overhead (PrismaPg adapter
init, `swc` register, first-hit query plan, no warm connection), not by query
cost. Adding indexes to ≤50-row tables would be cargo-cult and is explicitly
**not** applied.

Per the goal's "evidence-backed wins only" rule: the honest evidence does not
support any index or cache change on minimal-seed data.

## Roadmap (needs production-scale data to decide)

- ▼ **Possible N+1 on lead-report load** — the spread of separate slow queries
  across `Item / Risk / Decision / ProjectStatus / StageAssignment / StageStatus`
  in one page load hints the section/cross-author build may issue many small
  queries. On tiny data this is fast in aggregate; with realistic volume it
  could matter. Re-measure with a scale seed before batching — do NOT refactor
  query semantics blind (this area is regression-heavy per repo CLAUDE.md).
- ▼ **Index candidates** — only after capturing slow queries against a
  realistic dataset (hundreds of items/sections across many periods). The
  recurring `WHERE reportId` / `WHERE periodId` shapes would be the first
  columns to check then.

## What WAS delivered (coverage, done-condition 8b)

- Slow tRPC procedure warn (>500 ms) — `trpc.middleware.ts`.
- Structured slow-query JSON (`phase=db.query`, grep-able) — `prisma.service.ts`.
- Process `uncaughtException` / `unhandledRejection` structured logs — `main.ts`.
- HTTP 2xx/3xx now visible at `info` (health stays `debug`) — `main.ts`.

Log-extraction recipe for the next scale pass:

```bash
grep '"phase":"db.query"' apps/api/.logs/api.log \
  | grep -oE '"durationMs":[0-9.]+' | cut -d: -f2 | sort -rn | head
```
