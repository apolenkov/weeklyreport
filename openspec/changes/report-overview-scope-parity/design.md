# Design — report-overview-scope-parity

## Context

Terms follow `CONTEXT.md`: **Scope** (the head report grouping axis, by-product
vs by-lead) and **Report overview** (the scope-adaptive summary band). The body
already honours scope: `weekly-report-page.tsx` computes `leadGroups` via
`mapWeeklyReportLeadGroups(reportData)` in `by lead` scope and renders product
accordions under per-lead `<section>`s. Only the overview band
(`PortfolioOverviewTable`) and its click target were left product-only. This is
the resolution of "the overview should follow scope, and click should go to a
lead, not a product."

## Decisions (resolved during the grill, sharpened by the Codex consult)

### 1. Cardinality — one card per lead WITH content

The overview lists leads that have content, matching `mapWeeklyReportLeadGroups`,
which already drops empty leads from the body. This keeps overview and body in
1:1 agreement. The header's submitted/total lead counters are a separate concern
(they count all leads) and are NOT changed.

### 2. Emptiness predicate — all record types, not the product-card 3-count

The product overview card's `isEmpty` counts only current+next+risk. A lead can
have only decisions / priorities / a Needs-Attention and still be a real
contributor. The lead overview MUST use the body's content predicate (the same
one `mapWeeklyReportLeadGroups` / `hasReportContent` apply), so a
decisions-only lead is not falsely shown as empty. Reuse the existing predicate;
do not invent a second definition of "empty".

### 3. Status — worst-of over the lead's OWN-contribution slices

A lead card's status is the worst traffic light among that lead's sliced product
cards (their own contribution), NOT the portfolio-wide product aggregate. By-lead
is about the lead's own contribution, so the card reflects what THEY are
accountable for. Reuse each sliced product's `trafficLight`; precedence
blocked > at-risk > on-track, matching the existing product-card sort.

### 3b. Ordering — deterministic, worst-status-first

Lead cards sort by worst status (blocked > at-risk > on-track), ties broken by
lead name, mirroring the product overview's existing status-first sort. Without
an explicit rule the cards could reshuffle across renders (Codex review finding);
the name tiebreak makes the order total and stable.

### 4. Navigation — scroll + focus to the lead section, no forced expand

A lead card scrolls to `report-lead-<id>` and moves focus to that section
(a11y parity with how the product path behaves). It does NOT force-expand any
product accordion — the lead's product cards keep their own default state.
Rationale: a lead owns multiple products; choosing which to expand would be
arbitrary, and the section heading is the honest landing target.

### 5. Anchors — add `report-lead-<id>` to lead sections

The body currently renders `<section aria-label={group.name}>` with no id. Add a
stable `id="report-lead-<id>"` (and `tabIndex={-1}` for focus) so the overview
card has a scroll/focus target, mirroring `report-product-<id>`.

### 6. Copy — scope-adaptive heading/subtitle

The overview heading ("Portfolio Overview") and subtitle name products today. In
by-lead scope they MUST name leads. Keep the strings English per repo rule.

### 7. Viewer — inherits, no separate work

The viewer report surface renders the same `WeeklyReportPage` / overview
component under the same scope, so making the component scope-aware applies to
the viewer automatically. The only viewer task is a parity assertion, not new
code.

## View-model

A small pure mapper derives the per-lead overview rows from the already-computed
`leadGroups`: `{ id, name, worstStatus, currentCount, nextCount, riskCount }`.
No new tRPC procedure, no schema, no server change — the lead-sliced product
data is already on the client in by-lead scope.

## Out of scope

- The header submitted/total lead counters (unchanged).
- Any change to `by product` scope behaviour.
- Decision/priority/Needs-Attention COUNTS on the card face — the card shows the
  same three counts (current/next/risk) as the product card for visual parity;
  the all-record-types predicate governs only whether the lead appears, not what
  numbers print. (If per-lead decision/priority counts are wanted on the face,
  that is a follow-up.)
