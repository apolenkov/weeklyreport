# Architecture Refactor Backlog (deferred deepening candidates)

## Why

An architecture-deepening review during the period-transition work surfaced 7
candidates. Card #1 became `refactor-period-transition-writer` (archived). Cards
#2–#5 were left as "worth revisiting later" and have, until now, lived only in a
`/tmp` handoff — at risk of being lost. This change **records them in OpenSpec as
a backlog** so they are durable and discoverable. It does **not** implement them:
each card must be grilled and designed into its own change before any code moves.

Two further ideas from that review (collapse the 7 middleware builders;
auto-parse middleware) were **deliberately dropped** because they violate decided
invariants (`role-coverage-gate`) — they are intentionally NOT recorded here.

## What Changes

Records four deferred architectural targets as a backlog capability. Each is
grounded against the current tree (2026-06-01):

1. **lead-form god component.** `apps/web/src/components/lead/lead-form.tsx` is
   **1938 LOC** (was 1862 when first flagged — it is growing), far over the
   declared `max-lines` 300 standard (`declare-lint-max-strictness`). Target:
   decompose by responsibility.
2. **Client permission model.** Permission/authorization logic on the web client
   is scattered rather than centralized. Target: a single client-side permission
   source instead of ad-hoc per-component checks.
3. **Traffic-light / risk enum single-source-of-truth.** The traffic-light
   (green/amber/red) value is re-typed across **~33 files** instead of one shared
   enum. `packages/shared` schemas (`report-primitives.schema`, `section.schema`)
   are the natural home. Relates to `schema-conventions`.
4. **Repository Prisma-type leak.** API repositories leak raw Prisma types across
   the domain boundary instead of mapping to shared contracts. Relates to the
   existing `repository-scope-guard` spec. Target: repositories return
   domain/shared types, not Prisma row types.

## Impact

- **ADDs** capability `architecture-refactor-backlog` (a recorded set of deferred
  targets, NOT yet designed).
- Each card, when picked up, becomes its own grilled `refactor-*` change; the
  task here is promotion, not implementation.
- Relationships: card #1 links to the `max-lines` rule in
  `declare-lint-max-strictness`; card #3 to `schema-conventions`; card #4 to
  `repository-scope-guard`. None is blocked by, or blocks, the lint phases.
- Risk: none — recording only.

## Acceptance

- `openspec validate backlog-architecture-refactors --strict` is green.
- Each of the 4 cards is a requirement with ≥1 scenario describing its target
  end-state, grounded in a current-tree fact.
