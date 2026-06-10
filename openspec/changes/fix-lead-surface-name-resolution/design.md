## Context

The lead surface composes its view from a single `ReportSectionReadModel`
(plus version/history side data) via `mapLeadFormData`
(`apps/web/src/lib/mappers/lead-form.ts:604-643`). Four mappers resolve a
card's product name through `buildProjectIndex(section)`
(`lead-form.ts:266-287`), a `Map` built solely from `section.projects`:

- `mapLeadItems` → `"Unknown"` (`lead-form.ts:433`)
- `mapLeadRisks` → `"Unknown"` (`lead-form.ts:466`)
- `mapLeadDecisions` → `"Group"` (`lead-form.ts:485-486`)
- `mapLeadPriorities` → `undefined` (`lead-form.ts:513`)

`section.projects` is assembled on the API read path from the author's
`StageAssignment` rows only (`report-sections.prisma-repository.ts:153-164`,
emitted at `:182-204` with `projectName: project.name`). Risks, decisions,
and items each carry a free `projectId` (`:217-235`) that need not match a
stage-owned project. So a row on a project the lead holds no stage on has
no name source and falls back.

**Before / after data flow (the lookup):**

- Before: `card.projectId → buildProjectIndex(section.projects).get(id)`
  → miss when `id ∉ stage-owned projects` → "Unknown" / "Group".
- After: `card.projectId → <report-wide name source>.get(id)` → hits for
  any project the report can name; placeholder only for a truly foreign id.

**Critical difference from the head-surface precedent.** The shipped head
fix (`fix-product-name-resolution`) unions every section's `projects` plus
`api.portfolioOverview`, which names every product in the report
(`archive/2026-06-10-fix-product-name-resolution/design.md`). The lead
surface has _neither_ — it sees one section and no portfolio overview. So
that exact mechanism cannot be copied; a name source must be supplied.

**Seed reproducer status (verified 2026-06-10).** The dev DB was reseeded.
The risk this prompt cited — boris on `a0000000-…-201` («Маркетинговый
портал») — no longer reproduces: boris (`LEAD_MOBILE_PM`) now owns
`STAGE_PLAN` on `PROD_CRM` (`prisma/seed-simple.ts:708-713`) and on
`PROD_CRM_SALES` (`:753-758`), so both projects appear in his
`section.projects` and resolve. The bug is currently structural-only — no
seed row exercises it. Implementation must therefore _add_ a fixture that
reproduces it (a risk/decision on a project the section author owns no
stage on) before claiming the fix; a passing screenshot against today's
seed proves nothing.

## Goals / Non-Goals

**Goals:**

- Lead-surface cards never show "Unknown"/"Group" for a project the system
  can name.
- A regression fixture reproduces the miss before the fix and resolves
  after it.

**Non-Goals:**

- No change to card layout, badge format, or the head surface
  (`report-badge-resolution` already governs it).
- No new color token, no new UI string (placeholders stay as-is for the
  genuine-miss case).
- No DB schema change.
- Not deciding `require-risk-stage` (sibling change); a stage requirement
  does not make the name resolve — these are independent.

## Decisions

### Decision 1 — name source mechanism (3 options weighed)

The lead surface lacks a report-wide name source, so one must be added.
Three options:

| Option                                        | Where the name comes from                                 | Cost                          | Coupling                       |
| --------------------------------------------- | --------------------------------------------------------- | ----------------------------- | ------------------------------ |
| A. Extend the read model                      | API includes a name for every referenced projectId        | API + schema + mappers        | server-owned, authoritative    |
| B. Add a separate name query                  | New tRPC `projects.names` map, joined client-side         | new procedure + client wiring | extra round-trip               |
| C. Widen the existing read model's `projects` | include projects referenced by rows, not just stage-owned | API repository only           | server-owned, no schema change |

**Recommendation: Option C.** Keep `section.projects` as the single name
source the mappers already read, but build it from the union of the
author's stage-owned projects _and_ every distinct `projectId` referenced
by the section's items, risks, and decisions. The repository already loads
those rows (`report-sections.prisma-repository.ts:205-235`) and can batch a
`project.findMany({ where: { id: { in: referencedIds } } })` for the names.

Why C over A: A would add a parallel name field to the schema and change
the API contract for a problem the existing `projects` array already
models. Why C over B: B adds a round-trip and a second source of truth for
names the server can resolve in one query. Both A and B are heavier for the
same outcome.

Trade-off of C: a referenced-but-not-owned project would appear in
`section.projects` with no `ownedStages`. Verify this does not leak a stray
SDLC stage grid or a product card the lead can edit
(`mapLeadProducts`, `lead-form.ts:386-407`). If it would, the union must
feed name resolution only — a separate name `Map` passed to the four
mappers — without widening the array that drives `mapLeadProducts`. This is
the open question below; resolve it during implementation by reading
`mapLeadProducts` and the product-card render.

### Decision 2 — keep the placeholders as genuine-miss fallback

`"Unknown"` (`lead-form.ts:433,466`), `"Group"` (`:486`), and `undefined`
(`:513`) stay for an id absent from the entire resolved name source — the
same posture the head fix took. A truly foreign id stays visible rather
than crashing or hiding the row.

### Decision 3 — name source precedence

When the same projectId is both stage-owned and row-referenced, the
stage-owned entry wins (it carries `ownedStages` and `trafficLight`). The
referenced-only entries contribute name-only. Mirrors the head fix, where
the server-aggregated overview won on conflict.

## Risks / Trade-offs

- [Referenced-only project leaks an editable product card or empty stage
  grid] → resolve name-only without widening the `projects` array that
  drives `mapLeadProducts`; pin with a test that the product list is
  unchanged. See Open Questions.
- [Extra `project.findMany` per section read adds a query] → batched, keyed
  by a small id set; negligible. Skip the query when no row references an
  unowned project.
- [Archived project referenced by a stale row] → the existing read path
  skips archived projects for stage-owned ones
  (`report-sections.prisma-repository.ts:154`); decide whether a
  referenced-only archived project resolves its name or stays a
  placeholder. Lean: resolve the name (the name is not secret), but pin
  the choice with a test.

## Invariants

- **period dual-state** — untouched (no period writes).
- **role-coverage gate** — untouched if Option C stays in the existing
  read path; a new tRPC procedure (Option B, rejected) would need a
  canonical middleware-chain builder.
- **destructive-db guard** — untouched (no destructive ops).
- **deferred-feature pattern** — not applicable (this ships, not defers).

## Open Questions

1. Does a referenced-but-not-stage-owned project, if added to
   `section.projects`, render a stray product card or empty SDLC grid via
   `mapLeadProducts` (`lead-form.ts:386-407`)? If yes, pass a name-only
   `Map` to the four mappers instead of widening the array. Resolve by
   reading `mapLeadProducts` and the product-card component before coding.
2. Should a referenced-only _archived_ project resolve its name or stay a
   placeholder? Lean: resolve; confirm with the user during acceptance.
