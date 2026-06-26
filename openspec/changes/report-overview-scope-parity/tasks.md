# Tasks — report-overview-scope-parity

## 1. Per-lead overview view-model (→ "The report overview follows the active scope")

- [x] 1.1 Add a pure mapper (next to `mapWeeklyReportLeadGroups` or in the
      weekly-report mapper module) that turns `leadGroups` into overview rows:
      `{ id, name, worstStatus, currentCount, nextCount, riskCount }`. Worst
      status = precedence blocked > at-risk > on-track over the lead's sliced
      product `trafficLight`s. Counts = sums over the lead's sliced products.
- [x] 1.2 Reuse the EXISTING body content predicate (the one
      `mapWeeklyReportLeadGroups` applies / `hasReportContent`) for membership —
      a lead with only decisions / priorities / Needs-Attention still produces a
      row. Do not introduce a second "empty" definition.
- [x] 1.3 Sort the rows deterministically: worst status first (blocked, at-risk,
      on-track), ties broken by lead name — the same status-first order the
      product overview uses.
- [x] 1.4 Unit-test the mapper: decisions-ONLY, priorities-ONLY, and
      Needs-Attention-ONLY leads each included; worst-of status; summed counts;
      empty lead excluded; deterministic order across two shuffled inputs.

## 2. Scope-aware overview component (→ same requirement)

- [x] 2.1 In `portfolio-overview-table.tsx`, accept a `scope` ("product" |
      "lead") plus the matching rows (product rows as today, or lead rows from
      task 1). Render product cards in product scope (unchanged) and lead cards
      in lead scope (name + worst status + summed current/next/risk counts).
- [x] 2.2 Lead-card click: scroll to `report-lead-<id>` and move focus to that
      section; do NOT force-expand a product accordion. Product-card click is
      unchanged (`report-product-<id>` + existing expand behaviour).
- [x] 2.3 Make the heading + subtitle scope-adaptive (name products vs leads),
      English strings per repo rule.

## 3. Lead-section anchors (→ "clicking a lead card jumps to that lead's section")

- [x] 3.1 In `weekly-report-page.tsx`, give each by-lead `<section>` a stable
      `id="report-lead-<group.id>"` and `tabIndex={-1}` for focus.
- [x] 3.2 Pass the lead overview rows (task 1) into `PortfolioOverviewTable`
      with `scope="lead"`; pass product rows with `scope="product"` as today.

## 4. Viewer parity (→ "the viewer inherits the same overview")

- [x] 4.1 Confirm the viewer report surface renders the same overview component
      under scope and inherits by-lead grouping with no viewer-specific code.
- [x] 4.2 Add/extend a test asserting the viewer overview groups by lead in
      by-lead scope (parity with head).

## 5. Tests + gates

- [x] 5.1 Component test: by-lead scope renders lead cards (not product cards);
      lead-card click scrolls/focuses `report-lead-<id>`; by-product scope
      unchanged; decisions-only / priorities-only / Needs-Attention-only leads
      each get an active card; lead cards render in the deterministic order.
- [x] 5.2 `pnpm typecheck`, `pnpm lint`, `pnpm test` green; no new console
      errors on the report page.
