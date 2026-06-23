# Fix duplicated flagged-red escalations (dedupe per product)

## Problem

The shared Blocked-&-At-Risk builder `buildEscalationsFromReadSections`
(`apps/api/src/modules/published-report-snapshot.ts`, ~lines 224-274) emits the
product-level "flagged red" escalation INSIDE its per-section loop. Each report
section is authored by one lead, so for a product co-owned by N leads that
resolves red, the function pushes N identical escalations:
`{ type: "at_risk", productName, stageName: null, leadName: <each owner>,
description: "Project <X> is flagged red." }`. The rows differ only by
`leadName` and add no information.

The head dashboard "Blocked & At Risk" list renders these as duplicate rows
(observed live: "Маркетинговый портал · No stage set · is flagged red" appears
once per co-owner). The same builder also feeds the published-report snapshot
via `weekly-report.prisma-repository.ts` (~lines 190 and 222), so the published
report carries the same duplicates.

The project-level "flagged red" signal is PRODUCT-SCOPED: it is derived from the
product's effective status, not from any one lead's contribution. Emitting it
per contributing lead is the bug.

## Solution

Dedupe the project-level "flagged red" escalation by product inside the builder
so it is emitted exactly once per red product, regardless of how many leads
co-own that product.

1. **Dedupe in the builder, keyed by `projectId`.** The builder is the single
   shared source for both the live dashboard and the published snapshot (its
   docstring guarantees byte-identical output across the two surfaces). Deduping
   here fixes both surfaces at once and preserves that parity; deduping only in
   the dashboard mapper would fix the dashboard while leaving the published
   report duplicated, and the mapper sees only the `Escalation` DTO, which
   carries `productName` but not `projectId`.
2. **Cross-section, not within-section.** A red product recurs in EACH
   co-owner's section, so the dedupe MUST track seen products across the whole
   section loop (a builder-wide set of `projectId`), not per section.
3. **Keep a deterministic owner's `leadName`.** The first contributing lead's
   `leadName` is retained on the single surviving escalation. `leadName` cannot
   be dropped: `escalationSchema` requires `leadName: z.string().min(1)`. The
   row's rendered content ("Project <X> is flagged red.") does not depend on
   which owner is retained, so the published report stays correct.
4. **Scope strictly to the project-level flagged-red escalation.** The
   per-item `blocked` escalations and the per-risk `unresolved_risk`
   escalations are genuinely per-record and MUST stay unchanged. Only the
   product-level "flagged red" push is deduped.

A regression test on the builder proves: (a) a multi-co-owner red product yields
exactly one flagged-red escalation; (b) item `blocked` and per-risk
`unresolved_risk` escalations are unchanged.

## Non-goals

- Changing the published-report snapshot's content or correctness beyond
  collapsing the duplicate project-level red flags — item and risk escalations
  are untouched.
- Changing the dashboard mapper (`dashboard.ts`) — the fix lives upstream in the
  builder, so the mapper keeps mapping whatever the builder emits.
- Changing the effective-status computation (`effectiveProjectStatus`) that
  decides WHICH products are red — only the emission cardinality changes.
- Adding a new escalation type or altering the `Escalation` schema.

## Source

Live demo feedback, 2026-06-23 (head surfaces), item D3 — diagnosis confirmed
live. See `docs/demo-feedback-2026-06-23-head-surfaces.md`, "Change 3 —
fix-flagged-red-escalation-dedup". Builds on the same `flagged red` block last
touched by the archived `fix-published-empty-stage-risk-floor` change.
