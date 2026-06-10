# Head Toolbar Critique — Research Synthesis

**Status:** research memo backing `unify-head-toolbar-controls`.
**Date:** 2026-06-10.
**Method:** 8-agent workflow (`head-toolbar-critique`): 4 parallel code
readers (layout, publish semantics, export/icons semantics, durable-spec
constraints) → 3 independent design concepts → 1 judge/synthesizer.
Full transcript: session workflow run `wf_2e1660d6-5e3`.

## User complaints (2026-06-10, dictated over a header screenshot)

1. "By product / By lead" should match the "Edit / Slides" style; labels
   can shorten to "Product / Leads".
2. "Agent review" should be de-emphasized / moved aside.
3. Unclear what the presentation and PDF icon buttons add over
   Edit/Slides.
4. "Publish to export PDF" + "Publish & Lock" together read as nonsense.

## Ground truth (verified in code by the readers)

- Row 1 is composed by `head-report-shell.tsx:114-146` (head|admin-gated
  route); Row 2 by `weekly-report-page.tsx:292-347` (shared with the
  read-only `/reports/[id]` route; action buttons behind
  `canMutatePeriod`).
- **"Publish to export PDF" and "Export PDF" are ONE component**
  (`export-pdf-button.tsx`): disabled with that compound label while
  `periodStatus === 'open'`; enabled as "Export PDF" after publish;
  triggers the async BullMQ PDF job and polls until the artifact opens.
- **"Publish & Lock"** (`publish-lock-button.tsx`) → confirmation dialog →
  `trpc.period.publish` → one transaction sets
  status/periodStatus/periodState to `published` + saves the
  `publishedSnapshot`. Afterwards the slot renders "Reopen Period".
- **FileDown icon** opens `/print/[reportId]` — a browser-print A4
  template in a new tab. No publish gate, no BullMQ job. A different
  surface from the async PDF export.
- **Presentation icon** navigates to `/head/report/[id]/present` —
  fullscreen keyboard-navigated (arrows/J/K/F) view of the text report.
  The "Slides" segment is `?mode=slides` on the same route — an in-page
  card deck (`HeadSlidesClient`). Different formats, both legitimate.
- **Agent review** (`agent-review-coming-soon.tsx`) is fully inert:
  aria-disabled, no onClick, ComingSoonBadge tooltip,
  `TODO(AGENT-REVIEW-01)`. A `compact` prop already exists.
- Styling divergence: `ScopeToggle` = `--color-primary` active fill,
  `text-xs`, wrapped radiogroup with neutral `rgba(0,0,0,0.15)` border;
  `ViewModeToggle` = `--color-starbucks-accent` fill+border, `text-sm`,
  two adjacent `<Link>`s, `min-w-[96px]`.

## Concepts and judge scores (complaints / consistency / cost / risk → total)

| Concept           | Idea                                                     | Score                     |
| ----------------- | -------------------------------------------------------- | ------------------------- |
| ia-first          | minimal relabel/regroup; "Print PDF" label               | 9/8/9/8 → 34              |
| consistency-first | same, but honest "Print" label, tightest diff            | 9/9/9/9 → **36 (winner)** |
| flow-first        | single lifecycle CTA, remove FileDown, restructure Row 2 | 8/6/3/4 → 21              |

flow-first rejected: best conceptual answer to complaint 4, but it
restructures `WeeklyReportPage` (shared with the all-roles viewer route),
lifts dialog state, and removes the only publish-gate-free print fallback
— a real refactor in a regression-heavy area for a problem cheap
relabeling already solves. ia-first's "Print PDF" label rejected as
misleading (`/print` is not a file download).

## Synthesis (what the change implements)

Seven edits — see `proposal.md` and `tasks.md`. Grafted from flow-first:
Agent review moves to the trailing edge; ScopeToggle keeps its neutral
wrapper border after the recolor so the two pill groups stay separable.

```
Row 1: [ Product │ Leads ]  [ Edit │ Slides ]   [⊞ Present] [▼ Print] [Agent review·]
Row 2: Status Report [Live · N/N Submitted]     [Export PDF] [Archive] [Publish & Lock]
```

## Recorded decisions (sign-off)

- **ScopeToggle recolor** (`--color-primary` → `--color-starbucks-accent`
  active fill, existing token, no new hue): options + recommendation
  presented in-session; **user approved 2026-06-10** ("Да, перекрасить").
  Satisfies the `ui-control-density` research-gate requirement.
- **Compact Agent review below the 44px cluster height**: flagged
  explicitly with the recommendation; user approved the recommendation
  wholesale 2026-06-10. Recorded as a spec-level exception via the
  `ui-control-density` delta in this change.
- **Breakpoint check** (labels widen Row 1; verify wrap at narrow
  viewports) → acceptance evidence in tasks, not a design decision.
