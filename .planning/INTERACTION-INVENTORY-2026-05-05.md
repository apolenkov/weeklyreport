---
title: DOM Interaction Inventory + Mutation Audit
date: 2026-05-05
status: completed (first run)
---

# Interaction Inventory & Side-Effect Coverage

Surfaced after the user asked: "Можем ли мы исходить из доммодели таким
образом? 100% покрытие регресс-сценариями любого пикселя." — driven by the
reopen-request black hole (mutation existed, persisted to `console.log`, no
admin UI ever displayed it, functional tests passed because they only checked
the immediate toast).

This report is the first-run output of two complementary tools:

1. **`apps/web/.tmp/uat-suite/inventory.mjs`** — runtime DOM walker. For each
   (role × route) tuple, enumerates every visible interactive DOM node
   (button, a[href], [role=button|tab|menuitem], input, select, textarea,
   contenteditable, [aria-haspopup=true]). Outputs per-element metadata
   {kind, label, ariaLabel, testid, href}.

2. **`apps/web/.tmp/uat-suite/mutation-audit.mjs`** — static analysis pass.
   Parses `apps/api/src/infrastructure/trpc/trpc.router.ts`, lists every
   tRPC mutation, then checks for a likely consumer (a list/get/snapshot
   query in the same namespace OR a web-codebase reference).

Run anytime:
```bash
cd apps/web
node .tmp/uat-suite/inventory.mjs       # needs dev servers up
node .tmp/uat-suite/mutation-audit.mjs  # static, no server needed
```

Outputs (gitignored, regenerable): `apps/web/.tmp/uat-suite/inventory.md`,
`apps/web/.tmp/uat-suite/mutation-audit.md`, plus JSON twins.

---

## Run 1 — DOM coverage

| Role | Route | Buttons | Links | Inputs | Total |
| --- | --- | --: | --: | --: | --: |
| lead | /lead/report | 54 | 5 | 1 | 60 |
| lead | /lead/history | 1 | 7 | 0 | 8 |
| lead | /reports/history | 1 | 6 | 0 | 7 |
| head | /head/dashboard | 5 | 16 | 0 | 21 |
| head | /head/report | 31 | 8 | 1 | 40 |
| head | /lead/report | 1 | 8 | 0 | 9 |
| head | /lead/history | 1 | 8 | 0 | 9 |
| head | /reports/history | 1 | 9 | 0 | 10 |
| head | /admin?tab=users | 34 | 14 | 0 | 48 |
| head | /admin?tab=products | 38 | 14 | 0 | 52 |
| head | /admin?tab=periods | 4 | 14 | 0 | 18 |
| head | /admin?tab=reminders | 7 | 14 | 0 | 21 |
| head | /admin?tab=reopen | 5 | 14 | 0 | 19 |
| head | /admin?tab=settings | 3 | 14 | 2 | 19 |
| head | /reports/trends | 1 | 8 | 0 | 9 |
| viewer | /reports/history | 1 | 4 | 0 | 5 |

**Total interactive nodes: 355.** This is the upper bound on "things a user
can click" for our seeded state. Adding state variants (draft / submitted /
published) would multiply this; v1 scope is the seed-default state.

The full per-element table lives in `apps/web/.tmp/uat-suite/inventory.md`
(355 rows). Use it as a checklist when defining regression scenarios.

---

## Run 2 — Mutation consumer audit

| Bucket | Count | Meaning |
| --- | --: | --- |
| VERIFIED | 17 | Mutation has a list/get/snapshot query in the same namespace AND a web-codebase reference |
| PARTIAL | 8 | Mutation is invoked by web code but no list/read query in the same namespace surfaces its result (likely an inline-confirmation flow, but worth verifying) |
| BLACK HOLE | 1 | Mutation defined but neither consumed nor referenced |

### Black holes

| Procedure | Same-NS queries | Web refs |
| --- | --- | --: |
| `carryOver.execute` | — | 0 |

`carryOver.execute` is the cron-triggered mutation that copies forward
unfinished items from the previous week's report into the current week. The
audit flags it because no UI consumes its output and no UI even references it.

**Verdict:** intentional — it's a backend cron handler, not a UI affordance.
Users see the *result* (carry-over rows in next week's items) but never
trigger or query the carry-over mutation itself. The black-hole label is a
true positive at the type-system level (no UI consumer) but a false alarm
operationally.

**Better heuristic for v2:** flag a mutation as a real black hole only when
it lacks BOTH a UI consumer AND a scheduled/invoked-by-server caller. For
now we accept the false positive and document the carve-out.

### Partial coverage

These mutations are invoked from the web but the audit didn't find a
list/read query in the same namespace surfacing their result. False
positives from the heuristic mostly:

| Procedure | Why it's a false positive |
| --- | --- |
| `dev.wipeAndReseed` | dev-only widget; result is the page reload itself, no query needed |
| `period.publish` / `period.reopen` | result surfaces in `archive.list` / `reports.getActive` (different namespace) |
| `leadForm.fillFrom` | result surfaces via `leadForm.byPeriod` refetch (heuristic only matched `list/get/snapshot` prefixes) |
| `leadForm.restoreVersion` | same — `byPeriod` refetch |
| `leadForm.createSnapshot` | same — version count surfaces in `byPeriod` |
| `leadForm.requestReopen` | NOW VERIFIED via `admin.listReopenRequests` (cross-namespace consumer); the audit's same-NS heuristic missed it |
| `ai.regenerateSummary` | result returned inline + cached via `ai.summary` query |

**Better heuristic for v2:** widen the consumer match to (a) the same
namespace's `byPeriod`/`byId` queries, (b) explicit cross-namespace consumers
declared in metadata, (c) any procedure that returns the same shape.

### Verified mutations (sanity check)

17 mutations have clear consumers — including `admin.respondReopenRequest`
which now reads back via `admin.listReopenRequests` (the original gap that
prompted this whole exercise).

---

## Methodology — why this catches what tests miss

The reopen black hole had a working button, a working mutation, a working
toast, and zero observable effect. Every functional test passed. Three
coverage axes are needed to prevent the next one:

```
   ┌─────────────────────────────────────────────────────────────┐
   │  1. Functional      did clicking the button do something    │
   │                     (mutation fired, toast shown)           │
   │                                                             │
   │  2. Visual          does the page match the mockup          │
   │                     (covered by .planning/MOCKUP-AUDIT-*)   │
   │                                                             │
   │  3. Side-effect     is the mutation's *result* observable   │
   │                     ↑ the gap that hid reopen-to-/dev/null  │
   └─────────────────────────────────────────────────────────────┘
```

The DOM walker grounds axis 1 in a complete inventory rather than ad-hoc
test cases. The mutation audit grounds axis 3 in a static check that any
new write surface has a corresponding read surface. Together they make it
hard for a future "Send Request" button to vanish into a `console.log`.

---

## Next iterations (deferred)

- v2 mutation audit: cross-namespace consumer registry + per-mutation
  `metadata: { consumedBy: [...] }` annotation, eliminating the false
  positives in PARTIAL.
- State-variant DOM coverage: re-walk each route in (draft / submitted /
  published / has-data / empty) state and diff the inventories.
- Per-element regression-scenario auto-skeleton: emit a Gherkin-style
  scenario stub for each NEW row in the inventory between runs.
- Wire the audit into CI: fail the build if a new mutation lands without
  a corresponding consumer (or an explicit `// AUDIT: cron-only` opt-out).
