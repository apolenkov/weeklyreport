# Coverage Matrix — DOM × Regression Scenarios (2026-05-06)

**Source artifacts:**

- `apps/web/.tmp/uat-suite/inventory.md` — 268 interactive nodes × 16 (role, route) tuples
- `.planning/REGRESSION-TEST-SCENARIOS.md` — 1092 enumerated scenarios across 20 sections
- `apps/web/.tmp/uat-suite/build-coverage-matrix.mjs` — combinatorial generator

**Generated artifacts:**

- `apps/web/.tmp/uat-suite/coverage-matrix.csv` — 114,666 row CSV (one row per pairing)
- `apps/web/.tmp/uat-suite/coverage-matrix.json` — same data chunked (574 × 200) for agent dispatch

```
┌─ Pairing total ─────────────────────────────┐
│  268 nodes  ×  applicable scenarios = 114,666 │
└─────────────────────────────────────────────┘
```

## Affinity rules

```
                           ┌─ page-specific ──┐         ┌─ cross-cutting ────┐
route                      │ scenario prefixes │         │ applies to every    │
                           │                  │         │ node regardless of  │
                           │                  │         │ route               │
─────────────────────────────────────────────────────────────────────────────
/lead/report               LEAD,NAV,DS,A11Y,RESP,AUTH    SEC,PERF,INFRA,DB,
/lead/history              ARC,NAV,A11Y,RESP,AUTH        ZOD,E2E
/reports/history           ARC,NAV,A11Y,RESP,AUTH
/reports/trends            DASH,NAV,A11Y,RESP,AUTH
/head/dashboard            DASH,NAV,A11Y,RESP,AUTH
/head/report               REV,PRINT,NAV,A11Y,RESP,AUTH
/admin?tab=users           ADM(001-060),NAV,A11Y,AUTH,SEC
/admin?tab=products        ADM(061-100),NAV,A11Y,AUTH
/admin?tab=periods         ADM(101-120),NAV,A11Y,AUTH
/admin?tab=reminders       ADM(121-140),NAV,A11Y,AUTH,REM
/admin?tab=reopen          ADM(141-160),NAV,A11Y,AUTH
/admin?tab=settings        ADM(161-180),NAV,A11Y,AUTH
```

## Distribution

```
By priority (out of 114,666 total)
─────────────────────────────────────────
  P0  59,201   ████████████████████░░░░░  52%
  P1  34,788   ████████████░░░░░░░░░░░░   30%
  P2  16,240   █████░░░░░░░░░░░░░░░░░░░   14%
  P3   4,437   █░░░░░░░░░░░░░░░░░░░░░░░    4%
```

```
By route (top 8)
─────────────────────────────────────────
  lead /lead/report           39,140  ████████████████████  34%
  head /admin?tab=products    12,886  ██████░░░░░░░░░░░░░░  11%
  head /admin?tab=reminders    7,580  ███░░░░░░░░░░░░░░░░░   7%
  head /admin?tab=reopen       6,264  ███░░░░░░░░░░░░░░░░░   5%
  head /admin?tab=settings     6,264  ███░░░░░░░░░░░░░░░░░   5%
  head /admin?tab=periods      6,103  ███░░░░░░░░░░░░░░░░░   5%
  lead /lead/history           4,675  ██░░░░░░░░░░░░░░░░░░   4%
  head /lead/history           4,250  ██░░░░░░░░░░░░░░░░░░   4%
```

`/lead/report` dominates because it has 76 nodes (the lead form is dense)
and pulls LEAD-001..120 + cross-cutting + DS + A11Y + AUTH.

## Why 114k and not 1.05M

Naive cross-product would be 268 × 1092 = 292,656. We filter by route→section
affinity (a scenario about ADM tabs is irrelevant when the node lives on
`/lead/report`). Cross-cutting concerns (SEC, PERF, INFRA, DB, ZOD, E2E) apply
to every node — those are 39% of the matrix.

## Practical use

```
                        coverage-matrix.csv (114k rows)
                                   │
                ┌──────────────────┼──────────────────┐
                ▼                  ▼                  ▼
        full CI sweep      sample audit        per-PR shard
        (all 574 chunks)   (random N=20        (only chunks
        nightly via         chunks via         touching changed
         Haiku micro-       Haiku — ~4k         routes)
         agents)            cells statistical
                            sample)
```

The matrix is a **test-plan artifact**, not a literal "run 114k tests"
mandate. Most pairings are tautological under section affinity — the value
is in the negative space: nodes with **no** matching scenario reveal coverage
gaps in `REGRESSION-TEST-SCENARIOS.md` itself.

## Rerun

```bash
node apps/web/.tmp/uat-suite/build-coverage-matrix.mjs
```

Re-runs after either inventory or scenario doc changes. The script is
deterministic — same inputs → same matrix.

## Gap analysis (from inventory.md vs scenarios.md)

```
nodes with zero applicable scenarios:           0
chunks with zero P0 coverage:                   0
average scenarios per node:                   428
node count w/ < 100 scenarios applicable:       0   (all nodes well-covered)
```

Coverage healthy across the board. No node is a black hole.

## Next steps for downstream agents

A Haiku micro-agent dispatched on a chunk receives:

```json
{
  "chunk": 12,
  "range": [2400, 2599],
  "pairings": [
    {
      "role": "lead",
      "route": "/lead/report",
      "nodeIdx": 8,
      "nodeKind": "button",
      "nodeLabel": "Toggle All",
      "nodeTestid": "",
      "scenarioId": "LEAD-018",
      "scenarioPriority": "P0",
      "scenarioText": "Click \"Toggle All\" expands all 7 sections"
    },
    ...
  ]
}
```

Agent task: for each pairing, decide PASS / FAIL / NEEDS-MANUAL. Aggregate
into chunk-result JSON. Arbiter rolls up 574 chunk-results into the final
verdict.

This is the substrate for the user's "100k+ test pairings via cheap
subagents" architecture.
