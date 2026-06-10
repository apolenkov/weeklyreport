# Design — Fix Lead Surface (Snapshot Triggers, Archive, Fill From, Summary)

## Context

All root causes were established by the `lead-surface-audit` workflow on
2026-06-10 and live in `memos/lead-surface-audit-verdict.md` with
file:line evidence — this document only fixes the decisions; read the
memo before implementing. The user approved capture-only on the same day
(implementation deferred) and signed off all three design calls.

## Goals / Non-Goals

**Goals:** make the lead report controls honest — clicks do what they
say, no-op controls disappear, popovers render where they open, the
summary counts one population, incompleteness is visible on the product
card.

**Non-Goals:** API/schema changes (`reports.myHistory` intentionally
returns drafts and archived sections — aggregation is a client concern);
head/viewer surfaces; new color tokens; Fill From redesign beyond the
listed fixes.

## Decisions

### D1 — Effect-dependency fix over signal redesign

Remove `readOnly` from the two add-signal effect dep arrays (the in-body
guard already handles read-only) AND reset both counters to 0 when
`viewedSnapshotVersion` becomes non-null. The reset is belt-and-braces:
the bug class (stale monotonic signal + transition-reactive dep) should
not survive a future refactor that re-adds the dep. Alternative — a
{count, nonce} signal object — rejected as over-engineering.

### D2 — Hide the no-op toggle instead of disabling it

`hasArchivedPeriods === false` → the ArchiveToggle slot is not rendered.
A disabled toggle would still demand an explanation; absence is honest.
With archived periods present, the approved enhancement applies: count
badge ("N archived") on the toggle and an "Archived" marker on combo
options; prev/next arrows already walk `visiblePeriods`, which the
toggle expands — no extra arrow work.

### D3 — Submitted-only aggregates, client-side

`lead-history-sidebar.tsx` computes `submittedEntries` once and bases
totalRisks / avgItems / traffic-light totals on it; Submissions stays
`submitted/total`. A muted one-liner notes the excluded draft. No API
change. When "Show archived" is on, the card recomputes over the visible
set — the user's "highlight when archive is shown" ask is satisfied by
the count badge (D2) plus the aggregates following the visible list.

### D4 — Portal the Fill From dropdown

Mirror the confirmation-modal portal already in the same file
(`fill-from-button.tsx:206-246`) and the `stage-chip.tsx` rect
positioning pattern: render the panel into `document.body`, position
from the trigger's `getBoundingClientRect()`, reposition on
scroll/resize. Defensive: `report-toolbar.tsx:17` `overflow-x-auto` →
`overflow-x-clip`. Class-based first-row highlight, search input hidden
when the list is empty, search icon as an inline SVG on
`--color-muted-foreground`, "Previous" badge → accent fill + white text
(all sign-offs recorded in the memo).

### D5 — Dashed stripe for incomplete own-stages (user-chosen option 3)

The product-card stripe keeps the lead-set traffic-light COLOR;
`borderLeftStyle: dashed` applies while any OWN stage is unfilled
(`product.stages.some(s => s.ownership === 'mine' && s.status ===
'empty')` in `sdlc-pipeline.tsx` / `getProductCardStyle`). Color =
health, solidity = completeness — the same dashed="not yet" idiom the
slide's plans card established. Options 1 (separate counter chip) and 2
(stripe = live worst-of-own-stages) rejected: 2 ripples into dashboard
and slides which read `trafficLight` directly.

## Invariants (load-bearing check)

- **period dual-state / role-coverage / destructive-db guard** —
  untouched (no API, no DB).
- **deferred-feature pattern** — untouched.
- **status-color-semantics** — preserved: no new tokens, red untouched,
  dashed style carries the new meaning, not a hue.
- **ui-control-density** — preserved: control heights unchanged; the
  count badge rides inside the existing toggle pill.

## Risks / Trade-offs

- [Portal positioning drift] rect-based panels can lag on scroll →
  reuse the proven stage-chip listener pattern; verify in the narrow
  viewport during acceptance.
- [Aggregate semantics change] History numbers will shift for leads with
  drafts → intended; the draft note explains the delta.
- [Stripe ownership data] `ownership === 'mine'` must exist on the stage
  model in the edit view — verify the field name before wiring
  (investigator cited `sdlc-pipeline.tsx`; confirm at implementation).

## Migration Plan

Pure frontend. Implement → unit tests for: add-signal effect (snapshot
exit opens nothing), submitted-only aggregates, archive-toggle render
guard → gates → live screenshots (Fill dropdown open near viewport
edge, archive toggle with badge, dashed stripe) → user acceptance →
archive. Rollback: `git revert`.
