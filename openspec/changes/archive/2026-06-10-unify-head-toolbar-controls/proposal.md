# Unify Head Toolbar Controls

## Why

User feedback (2026-06-10, screenshot review of the head Status Report
header): the toolbar reads as a jumble — the two segmented toggles are
styled differently, two icon-only buttons sit unexplained next to
Edit/Slides, the inert "Agent review" placeholder is as large as real
actions, and "Publish to export PDF" next to "Publish & Lock" reads as two
competing publish actions. Code research (multi-agent critique,
`memos/toolbar-critique-synthesis.md`) showed nothing is semantically
broken — `ExportPdfButton` is one control with a state-dependent label —
but the labels and styles hide that.

## What Changes

Seven label/style edits, no structural refactor (the "consistency-first"
concept, judge score 36/40; synthesis memo has the full rationale):

1. `ScopeToggle` joins the `ViewModeToggle` visual family: active fill
   `--color-starbucks-accent`, `text-sm`; neutral wrapper border kept so
   the two pill groups stay separable. **Recolor signed off by the user
   2026-06-10** (recorded below; satisfies the research gate).
2. Scope labels shorten: "By product" → "Product", "By lead" → "Leads".
3. `AgentReviewComingSoon` renders compact (existing `compact` prop).
4. It moves to the trailing edge of the utility group.
5. The Presentation icon gains a visible "Present" label.
6. The FileDown icon gains a visible "Print" label (honest: `/print` is a
   browser-print template, not the async PDF artifact).
7. `ExportPdfButton`'s disabled label becomes "Export PDF" (today:
   "Publish to export PDF"); the precondition moves to the tooltip /
   sr-only hint. The word "Publish" then appears on exactly one control.

**Non-goals:** no lifecycle-CTA merge of publish/export, no removal of the
`/print` fallback, no `WeeklyReportPage` restructure (shared with the
read-only viewer route), no new color tokens, head-only surface — lead and
viewer toolbars untouched.

## Capabilities

### New Capabilities

- `head-toolbar-semantics`: durable labeling/grouping properties of the
  head report header — one segmented-control visual family, visible text
  labels on header actions, "Publish" on exactly one control, deferred
  placeholders visually subordinate.

### Modified Capabilities

- `ui-control-density`: the shared-cluster-height requirement gains an
  explicit exception — inert deferred-feature placeholders (aria-disabled
  with ComingSoonBadge) MAY render compact, below the cluster height.

## Impact

- `apps/web/src/components/head/head-report-shell.tsx`,
  `report-shell/scope-toggle.tsx` (+ test),
  `report-shell/agent-review-coming-soon.tsx`,
  `weekly-report/export-pdf-button.tsx`.
- No API/schema/token-file changes. `/head/*` is head|admin-gated; the
  `ExportPdfButton` label change also shows on `/reports/[id]` for
  head/admin only (`canMutatePeriod` guard).
