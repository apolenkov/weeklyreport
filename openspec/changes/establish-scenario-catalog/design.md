# Design — Behavioral Scenario Catalog

## The four-source derivation method

A single search angle always misses something; the catalog triangulates four
independent, mostly auto-derivable sources, and the gap critic mines the
_differences_ between them.

1. **Code entry-point surface** — the behavioral spine. NOT just the 128 tRPC
   procedures: also REST controllers (health/metrics/web-vitals), BullMQ
   processors (email-reminder, pdf-export, telegram), **cron schedulers**
   (`period-creator`, `auto-publisher`, `auto-archiver`, `reminders`), and Next
   route handlers (revalidate-org, client-logs). The schedulers drive the
   `PeriodState` lifecycle (scheduled→open→published→archived) that no procedure
   walk would reach — the single biggest blind spot of a tRPC-only spine.
2. **Prisma domain model** — 26 entities + 17 state enums, generated from
   `schema.prisma`. Each enum value × transition becomes a required scenario;
   each entity must have writer and reader entry points or it is a gap.
3. **OpenSpec specs** — 152 existing `#### Scenario:` blocks supply invariants
   and intent (e.g. `period-dual-state`), cross-checked against code.
4. **codegraph** — the live knowledge graph (`codegraph.db`) maps
   entity↔entry-point cheaply (callers/impact), so agents do not grep.

Output: `e2e/catalog/<module>.feature` (Given/When/Then) + a coverage matrix
(entity/state × entry point × role × covered-by × diff-tag).

## Two views

- **Matrix** — the "did I miss any logic" view; generated; one row per
  entity-state / entry point.
- **Catalog (.feature)** — the "how to test" view; what humans and AI execute.

## Build via Workflow (deferred; not run by the authoring step)

- _Extract_ (Sonnet, ~1 agent per router/module + entry-point sweep): read code +
  Zod + guards, pull entry points × roles × states → `.feature` scenarios with
  checkable `Then` and code links.
- _Consolidate + gap critic_ (1–2 agents): merge, dedup, cross-ref vs the 152
  specs and the Prisma model; emit the gap list.
- _Diff-tag_: mark scenarios whose linked code is in the dangerous lint waves
  (`no-unnecessary-condition`, `no-misused-promises`/`require-await`) — the
  "verify now" subset.

## Future state — AI-driven testing on a stable contract

```
change (PR/diff)
  → diff ∩ catalog code-links = affected scenarios
  → Haiku regenerates/runs the affected tests (Playwright/Vitest)
  → pass/fail report
new feature → scenario added to catalog first (SDD) → AI generates test + impl
periodically → coverage critic: new entry point/entity/state with no scenario = gap
```

Durable split that survives model churn: **humans own intent** (the `Then`);
**Sonnet/Opus** author bindings and judge ambiguous failures; **Haiku** executes
mechanics. Models are swappable; the catalog is not.

## Limits AI does not remove (recorded honestly)

- **Assertion depth** — AI defaults to shallow `Then` ("page loaded"); the real
  invariant ("both period fields written") must be human-set. Enforced by the
  machine-checkable-`Then` requirement.
- **Oracle problem** — AI tests what the scenario _says_, not whether the
  scenario is _right_. Intent stays human-owned.
- **Flake** — UI click-through amplifies non-determinism; mitigated by
  deterministic native specs + controlled fixtures, not by a better model.
- **State arrange** — click-through cannot conjure DB state; each UI scenario
  needs a seed/API arrange step before the UI act.

## Grill findings (2026-06-02)

- Last-weeks work = lint campaign; real risk = runtime regression gates miss
  (DI-import precedent). Diff radius = 344 files, so file-level diff-scoping is
  useless; the scoping axis is **rule risk** (the semantically-dangerous waves),
  not file.
- `openspec validate --all --strict` = 23/23 — the OpenSpec is structurally
  canon-valid; "valid" ≠ "specs describe all behavior" (they do not).
- Config-radius changes verified safe: `next.config.ts` (env bracket→dot,
  `async`→`Promise.resolve` — identical), `prisma.config.ts` (`type`→`interface`
  — type-only).
- Pilot `carry-over.feature` surfaced three gaps tests miss: untested negative
  authz (lead/viewer/admin rejection), apparently-dead `CarryOverStatus.failed`,
  and the `period-dual-state` ↔ carry-over write mismatch.
- Decision log: catalog is code-derived (not spec-derived); full catalog then
  diff-slice; `.feature` docs + native Playwright (no BDD runner); run + archive
  the 3 sweep changes, lint tail to backlog.
