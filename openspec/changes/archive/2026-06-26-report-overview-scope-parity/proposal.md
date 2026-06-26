## Why

Live page feedback on `/head/report/...?scope=lead`: when the head switches the
report to **by lead** scope, the report BODY regroups product cards under
per-lead sections, but the **Report overview** band on top stays by-product, and
clicking an overview card scrolls to a product accordion. The summary and the
body disagree — the overview promises "products" while the body shows "leads",
and a click lands on a product even though the reader is thinking in leads. The
feedback also asks that the viewer inherit the same behaviour automatically.

## What Changes

- **The Report overview follows the active scope.** In `by product` scope it is
  unchanged (one card per product, click jumps to the product accordion). In
  `by lead` scope it renders **one card per lead that has content** — the lead's
  name, their worst product status, and their summed current/next/risk counts —
  and clicking a card jumps to that lead's section.
- **Lead sections gain a stable scroll anchor** (`report-lead-<id>`) so an
  overview card can navigate to a lead group, the by-lead analogue of the
  existing `report-product-<id>` anchors.
- **Emptiness is judged consistently.** A lead overview card counts a lead as
  having content using the SAME predicate the body uses to drop empty lead
  groups (any item / risk / decision / priority / Needs-Attention), not the
  narrower current+next+risk count the product cards use for their muted state.
- **The viewer inherits automatically** — the viewer report surface renders the
  same overview component under the same scope, so no viewer-specific work is
  needed beyond confirming parity.
- The overview heading/subtitle adapt to the scope unit (products vs leads).

This is a presentation-parity change: no new server data is required — the
per-lead groups (name, sliced product statuses, record counts) are already
computed in `by lead` scope.

## Capabilities

- `report-card-clarity` — extends the by-lead scope contract from the report
  body to the report overview band (new requirement; the existing by-lead
  card-slicing requirement is unchanged).

## Impact

- Web: `apps/web/src/components/weekly-report/portfolio-overview-table.tsx`
  (scope-aware input + per-lead card rendering + scope-adaptive heading),
  `apps/web/src/components/weekly-report/weekly-report-page.tsx` (pass the
  lead-grouped overview data + `report-lead-<id>` anchors on lead sections).
- A small per-lead overview view-model derived from the existing `leadGroups`
  (name, worst status, summed counts) — pure mapping, no new tRPC procedure.
- Viewer: inherits via the shared component; covered by a parity check only.
- No schema, no API, no migration.
