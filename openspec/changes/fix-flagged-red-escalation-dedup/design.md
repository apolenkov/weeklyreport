# Design: fix-flagged-red-escalation-dedup

## Decision 1 — Dedupe in the builder, not the dashboard mapper

The duplicate flagged-red rows could be collapsed in two places: the shared
builder `buildEscalationsFromReadSections`
(`apps/api/src/modules/published-report-snapshot.ts`) or the head dashboard
mapper `escalationToBlockedItem` / its caller (`apps/web/src/lib/mappers/
dashboard.ts`).

**Chosen: the builder.** Reasons:

- The builder is the single shared source for BOTH the live dashboard and the
  published-report snapshot (`weekly-report.prisma-repository.ts` calls it on
  both the live and snapshot paths). Its docstring guarantees "byte-identical
  stage/product output across the two surfaces". Deduping in the builder fixes
  both surfaces and PRESERVES that parity.
- The published report is also affected by the bug — a head reviewing the
  published snapshot sees the same N identical rows. Mapper-only dedup would
  leave the published report duplicated. The constraint "do not change
  published-report correctness" means do not break item/risk escalations or the
  stage/product parity — it does NOT mean leave the duplicates in place.
- "Emitted once per red product" is an emission concern, which is the builder's
  job.

## Decision 2 — Dedupe key = `projectId`, not `productName`

The builder loops `section.projects`, where each project carries a stable
`project.projectId`. The mapper, by contrast, only sees the `Escalation` DTO,
which carries `productName` (a display string) but NOT `projectId`. Keying on
`projectId` is exact and collision-free; keying on `productName` would be
fragile (two products could share a display name). This also reinforces
Decision 1: the mapper structurally cannot do the correct keyed dedupe.

## Decision 3 — Dedupe is cross-section (builder-wide), not per-section

Each report section belongs to one lead, and a co-owned red product appears once
in EACH co-owner's section. A naive per-section dedupe would do nothing, because
each section already emits the product at most once. The dedupe MUST track seen
products across the whole section loop — a single `Set<projectId>` accumulated
over all sections, gating the flagged-red push.

## Decision 4 — Which `leadName` survives the collapse

`leadName` is the only field that differs across the duplicate rows.
`escalationSchema` defines `leadName: z.string().min(1)` — it is non-nullable
and non-empty, so the surviving escalation cannot drop it to null. The first
contributing lead's `leadName` (loop order) is retained deterministically.

This keeps the published-report content correct: the row text is
"Project <X> is flagged red.", which is product-scoped and does not depend on
which owner is shown. The retained `leadName` is incidental metadata on a
product-level signal; collapsing the duplicates does not change which products
are flagged or the displayed alert text.

## Scope guard

In this builder, `type: "at_risk"` is used EXCLUSIVELY for the project-level
flagged-red push. The dedupe set therefore gates only that push. The
per-item `blocked` escalations and per-risk `unresolved_risk` escalations are
emitted in separate loops and are NOT touched. The spec describes the deduped
escalation as the "project-level flagged-red escalation" so a future, distinct
`at_risk` emission would not be silently swept into the same dedupe.
