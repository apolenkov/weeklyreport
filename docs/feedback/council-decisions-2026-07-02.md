# Council recommendations — 7 open questions (2026-07-02)

A multi-lens council was asked to recommend answers to the 7 open questions blocking the
feedback backlog. **Caveat: the council DEGRADED to one member** — the `mvp-pragmatist` and
`integrity-purist` lenses both stalled mid-stream (API error), so this is one strong opinion
(product-parity-UX) + a synthesizer, cross-checked by an `advisor` pass. The "dissent" in the
raw synthesis was synthesizer-inferred, not a validated second lens. Treat as RECOMMENDATIONS,
not decisions — especially the nod-gated ones.

This file RECORDS the recommendations; it does NOT rewrite the Codex-hardened spec bodies.

## Proceed (council: no human nod needed — additive / parity, high confidence)

- **Q3 — Activity can own a Decision.** Full Item/Risk/Decision XOR parity. Widen the
  `decisionsToSave` filter (report-sections.service.ts) to persist when productId OR activityId
  is set; add a round-trip regression test. → resolved; ready for the activity epic.
- **Q4 — Activity-only lead (0 products) is supported + seeded.** Relaxing
  `projectStatuses.min(1)` is NOT enough: `validateSubmitInput` must require every attached
  activity to carry a non-null status at submit. Seed one activity-only lead. → resolved; ready.
  (Assumption: a lead can own zero products; easy to reverse if owner rejects.)
- **Q5 — Carry-over triggers per-lead at `ensureLeadSection`,** NOT eagerly at
  `createPeriodManual` (which mints only the Report — no target section yet, would throw).
  Keep a subtle "carried over" marker on copied rows (banner is removed). Idempotency rides the
  `[reportSectionId, stableId]` lineage skip. → resolved; ready (adds a new trigger + integration
  coverage — real surface, not started tonight).
- **Q6 — Acknowledge: split placement, do NOT hide.** Relocate into the Publish & Lock cluster
  for publish-capable roles (head/admin); keep the per-group Acknowledge for viewers/lead-
  reviewers (else they drop off the "Seen by" roster — the bar is not `canReview`-gated today).
  One shared component, two role-appropriate locations. → resolved; ready.

## Pending Саша (nod-gated — reverse documented 2026-06-30 locks or the shipped slide)

- **Q1 — Activity signal on the head dashboard.** Council: KEEP isolation from product HEALTH
  (worstStatus / product Blocked-&-At-Risk table / KPI dedup) — implement + test that now — but
  ADD a compact, separate activity lane/count on the dashboard rather than total invisibility.
  Medium confidence, reverses the spec's Phase-1 "isolated" default. **Needs your nod.**
- **Q2 — Item status derive-only (Option A), PHASED.** Ship display re-sourcing (blocked from
  covering risks; at-risk display-only) + extend the head-report item badge to render derived
  amber NOW; gate the `ItemWorkflowStatus.blocked` enum removal (hard migration) behind your nod.
  Couples with Q1: the blocked-from-risks path in `buildEscalationsFromReadSections` MUST skip
  activity-parented (null-projectId) risks or Q1 isolation leaks back. Reverses two 2026-06-30
  locks. High confidence on direction, but **needs your nod** (reversal).
- **Q7 — Slide priority tier.** Council: extract ranked priorities to a top cross-product tier
  (render each priority once, not also in its product group). Medium confidence, 1-member.
  This REVERSES the within-group float shipped + live-verified today (2e5fb45e). **Needs your
  nod** — I deliberately did NOT implement it (would preempt your call + re-reverse my own commit).

## Held regardless: the schema epic

`activity-first-class-reporting-unit` (Q3/Q4 resolved) still requires a `prisma migrate reset`
on the SHARED dev DB — destructive and disruptive to the live parallel sessions. NOT run
unattended. Implement in a focused session when the tree is yours: reshape schema → migrate
reset → backfill → backend (XOR guards, submit validation) → cross-surface UI → integration gate.
