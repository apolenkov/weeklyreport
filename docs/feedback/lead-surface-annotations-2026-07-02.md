# Lead-surface live annotations — 2026-07-02 (capture + triage)

Captured from a live agentation walkthrough of `/lead/report/[id]` (form + `?mode=slides`).
The agentation server was down, so items arrived inline; this file is the durable record.
Frontend-design lens applied. Grouped into clusters; data-model items flagged.

## Cluster A — Slides: grouping, hierarchy, overflow (frontend redesign, CORE)

Source: `lead-unified-slide.tsx`, `status-slide-deck.tsx`, `lead-slides-client.tsx`.

- **A1 — Group by product; kill duplicate product pills.** In the Summary quadrants
  (Current/Next/Risks/Decisions) every row repeats a "Маркетинговый портал" pill. Group
  rows under a product instead of tagging each row. (F7)
- **A2 — Hierarchy: lead → priorities → product.** Show WHO wrote the slide (lead identity).
  Within a lead, surface priority records first, then records grouped by product. (F8, F9)
- **A3 — Activities belong on the slide too, grouped by status.** Not only products — show
  the lead's activities by traffic-light status. (F12) Ties to Cluster D / F6.
- **A4 — Overflow handling.** Too much content per quadrant/slide → paginate: a carousel of
  slides + scroll, or enlarge; do not silently "+N more". Rethink grouping so it fits. (F10, F11)

## Cluster B — Item card polish (frontend)

Source: `item-card.tsx:57`, `accordion-section.tsx:72`.

- **B1 — Uniform card height.** All item cards the same height; the empty-state card is the
  height reference. (F4, F5)
- **B2 — Ellipsis + tooltip.** When content is short/overflows, pad/truncate with "…" so
  heights match; show the full text in a tooltip on hover. (F4)

## Cluster C — Toolbar / +Add button (frontend, small)

Source: `quick-add-button.tsx:43`.

- **C1 — Reposition "+ Add" between Save and Submit** in the document-action row. (F1)
- **C2 — Keep "+ Add" visible in slides mode** (currently disappears). (F13)

## Cluster D — Data model & entry (backend + schema — NEEDS DESIGN, not one-shot)

- **D1 — Item dialog: select an activity, not only a product; same entry UX for risks &
  blockers.** "Обязательно." Source: `item-edit-dialog.tsx:98`. (F2)
- **D2 — Status is derived from risks/blockers, not free.** If an item has a risk/blocker,
  its at-risk/blocked status cannot be cleared manually — show a message: remove the
  risk/blocker first. The pill colors are the risk/blocker roll-up. Source: item-card status
  pill. (F3) Ties to spec `status-color-semantics`, memory escalation-types-and-flagged-red-rollup.
- **D3 — Activity ↔ product is M:N (0..N products per activity).** SCHEMA CHANGE: today
  `ProjectActivity.projectId String?` links an activity to at most ONE product (1:N,
  "label-only"). M:N needs a join table + backend + UI. Show the product(s) on each activity
  row. Source: `activity-status-section.tsx:32`. (F6)

## Sequencing (proposed)

1. Cluster C (tiny) + Cluster B (polish) — safe frontend, quick.
2. Cluster A — slide redesign, apply frontend-design; A3 depends on D3 for product grouping of activities.
3. Cluster D — one OpenSpec change with schema design (D3 migration), behavioral rules (D2),
   dialog entry (D1). Verify against `status-color-semantics` + risk/escalation specs first.
