# UI annotations triage — 2026-06-30

27 pending in-app annotations from `agentation` (the user's live UI feedback), all
to be captured (user directive: nothing lost). Grouped by disposition. They spawn
two new clusters — **C6** (lead-form stage-access integrity) and **C7** (head-surface
parity & declutter) — alongside C1/C2/C5 they enrich.

## C6 — Lead-form stage-access integrity + default "mine only" (NEW, substantial)

From the long annotation `mqgbdc4c` (the most important one). Themes:

- **Default HIDE** other leads' stages/items on co-owned products; a "show all"
  button (next to archive) reveals others — i.e. default the existing `Record
visibility` to **Mine only**, with an explicit Show-all.
- **Access correspondence (the real integrity ask):** when adding an item/risk/
  decision, only the lead's OWN stages/products are selectable. Picking a product
  re-scopes the stage options to the stages the lead OWNS on that product. A lead
  **cannot** write a risk/item into a stage they don't own (e.g. DevOps when they
  only have Testing); if they own DevOps on another product, it appears there.
- **Single owned stage → pre-selected and locked** (can't deselect); two → must pick;
  never "write an item into stage-void".
- Relates to existing specs: `risk-stage-integrity`, stage-assignment rules,
  `Record visibility` (CONTEXT.md). Partly built (the lock icon shows access today),
  but the add-dialog product→my-stages re-scoping + default-mine-only need a grill +
  spec. **Queued for grill homework (workflow-2).**

## C7 — Head-surface parity & declutter (NEW)

Head slides / dashboard / report toolbar should mirror the lead layout and shed
non-signal chrome. Annotations:

- **Slides:** `mqqe3llq` switching to slides shouldn't reflow layout (parity w/ lead);
  `mqqe419t` "Group Status Slides" header line is a duplicate, remove; `mqqe49yj`
  buttons belong at top like leads; `mqqe4jt6` ReadinessStrip unclear — clarify/cut;
  `mqqe4t4t` Agent-review button belongs in the period-nav row; `mqqe4e57` carousel
  placement is good (positive signal — keep).
- **Dashboard:** `mqqdv9dh` LeadSummaryTable style/scroll off; `mqqdw4fe` ProductKpiCard
  maybe remove; `mqqdx377` Activity24hCard low value; `mqqdwfd5` BlockedAtRiskTable
  state correctness — verify.
- **Report toolbar (parity):** `mqfc4acc`/`mqfc4mgp`/`mqfc4wnx`/`mqga1m2y` place
  publish / request-all-reopen / Agent-review / Edit like the lead's status row,
  top-left; `mqfc5iob` remove "Present" (slides mode supersedes); `mqfc5a2b`/`mqga26jv`
  style ScopeToggle (Product/Leads) like the 4-button Toggle-All, consistent lead+head.
- Relates to: `report-toolbar-parity`, `head-toolbar-semantics`, `head-slide-density`,
  `head-dashboard-clarity`, `toolbar-polish`, `escalation`/at_risk roll-up. Much may
  be live-feedback refining existing specs. **Queued for grill homework (workflow-2).**

## Enriches existing clusters

- **C1 (review):** `mqt5fzgl` ("а это …? у ревьюера?" on the viewer's "Back to Archive"
  / Agent review) → what controls a reviewer surface shows; `mqqdxtuh` seed a dataset
  where one lead has reported so the send-back flow is demoable.
- **C5 (responsive):** `mqk0p9q0` sticky toolbar on scroll (a compact/affordance call).

## Already-decided / trivial (capture, no grill)

- **"Submit" not "Submit Section"** (`mqwelca2`, `mqqzfa4p`, `mqqdqi74`, +1 dup) —
  already the decided vocabulary (CONTEXT.md "Document action"); UI not yet updated.
  → a small UI-copy fix.
- **ComingSoon two styles** (`mqllq03b` "one style", `mqllq5aj` "different here!") —
  known: one shared `ComingSoonBadge` primitive ([[coming-soon-one-style-lesson]]).
  → a small consistency fix.
- **Remind tested?** (`mqqdxyrx`) — QA verification question, not a spec change.

## Disposition summary

| Disposition                      | Annotations                                                                                                                                                                 |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C6 (new — access integrity)      | mqgbdc4c                                                                                                                                                                    |
| C7 (new — head parity/declutter) | mqqe3llq, mqqe419t, mqqe49yj, mqqe4jt6, mqqe4t4t, mqqe4e57(+), mqqdv9dh, mqqdw4fe, mqqdx377, mqqdwfd5, mqfc4acc, mqfc4mgp, mqfc4wnx, mqfc5a2b, mqfc5iob, mqga26jv, mqga1m2y |
| C1 enrich                        | mqt5fzgl, mqqdxtuh                                                                                                                                                          |
| C5 enrich                        | mqk0p9q0                                                                                                                                                                    |
| Trivial/decided                  | Submit-copy ×4, ComingSoon ×2, Remind-tested                                                                                                                                |

> Annotations remain pending in `agentation` (not resolved) until their change ships —
> they are the live acceptance reference.
