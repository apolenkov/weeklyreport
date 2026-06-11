## Why

On the lead surface (`/lead/report`), a risk, decision, item, or priority
card whose `projectId` is real but absent from the section author's own
stage-owned project list renders "Unknown" (decisions render "Group")
instead of the product name. The name exists in the `Project` table; only
the lookup is too narrow. This is the lead-surface counterpart of the
head-surface bug already shipped as `report-badge-resolution`
(`fix-product-name-resolution`, archived 2026-06-10).

The root cause is structural, not a one-off data glitch: the section read
model's `projects` array is built _only_ from the author's `StageAssignment`
rows (`report-sections.prisma-repository.ts:153-164,182-204`), while risks,
decisions, items, and priorities may reference any `projectId`. When a lead
records a row against a project they hold no stage on, the name cannot
resolve. The active `require-risk-stage` change recorded this finding as
out-of-scope (`require-risk-stage/proposal.md:39-44`) and pointed here.

## What Changes

- The lead-surface mappers (`apps/web/src/lib/mappers/lead-form.ts`)
  resolve product names from a name source covering every project the
  report can name, not only the section author's stage-owned `projects`.
- The `"Unknown"` literal (`lead-form.ts:433,466`) and the decision
  `"Group"` literal (`lead-form.ts:486`) survive only as the genuine-miss
  fallback for an id the whole report cannot name.
- A regression test pins: a risk/decision/item/priority referencing a
  project outside the author's stage-owned list still resolves the real
  name; a truly foreign id still falls back.
- Design.md weighs three mechanisms (extend the read model, reuse the
  report-wide map, query a name map separately) and recommends one.

## Capabilities

### New Capabilities

- `lead-surface-name-resolution`: product names on lead-surface cards
  (risks, decisions, items, priorities) resolve from a source covering
  every project the report can name, never showing a placeholder for a
  product the system knows about.

### Modified Capabilities

<!-- none — report-badge-resolution governs the head surface; this is a
     sibling capability for the lead surface, not a change to its
     requirements -->

## Impact

- `apps/web/src/lib/mappers/lead-form.ts` (+ its tests).
- Possibly `apps/api/src/modules/report-sections/` read-model assembly and
  `packages/shared` section schema — only if design.md picks the
  extend-the-read-model option (decided there, not here).
- No DB schema change; card text only. Risk: low to medium depending on
  the chosen mechanism (a frontend-only fix is low; a read-model change
  touches the API contract).
