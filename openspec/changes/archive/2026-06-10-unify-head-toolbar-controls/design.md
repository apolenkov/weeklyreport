# Design — Unify Head Toolbar Controls

## Context

Research and decision record: `memos/toolbar-critique-synthesis.md`
(8-agent critique, concept scores, recorded user sign-offs, 2026-06-10).
The head Status Report header is composed in two rows:
`head-report-shell.tsx:114-146` (toggles + utility actions, head|admin
route) and `weekly-report-page.tsx:292-347` (title + publish actions,
shared with the read-only `/reports/[id]` route behind `canMutatePeriod`).
All controls are semantically sound; the confusion is carried by styling
divergence and labels.

## Goals / Non-Goals

**Goals:**

- One segmented-control visual family (ScopeToggle ↔ ViewModeToggle).
- Every utility action self-explanatory via a visible text label.
- The word "Publish" on exactly one control.
- The deferred "Agent review" placeholder visually subordinate.

**Non-Goals:**

- No lifecycle-CTA merge, no `WeeklyReportPage` restructure, no removal
  of the `/print` path (judge-rejected flow-first concept — see memo).
- No new color tokens; no behavior/handler changes anywhere.
- Lead/viewer toolbars (`report-shell` used by other roles) — only the
  head shell composition and the shared ScopeToggle/ExportPdfButton
  styling/labels change, never their behavior or gating.

## Decisions

### D1 — Unify by adopting the ViewModeToggle family (user-signed recolor)

ScopeToggle active fill `--color-primary` → `--color-starbucks-accent`,
inactive text → accent, font `text-xs` → `text-sm font-semibold`. The
neutral `rgba(0,0,0,0.15)` wrapper border STAYS (grafted insight: the two
pill groups must remain separable). Alternative — restyling
ViewModeToggle down to ScopeToggle's look — rejected: ViewModeToggle is
the style the user pointed to as the reference. Sign-off recorded in the
memo; satisfies the `ui-control-density` research gate.

### D2 — Labels carry the disambiguation, not new structure

- Scope: "Product" / "Leads" (bare nouns; surrounding content
  disambiguates).
- Presentation icon → icon + "Present"; FileDown icon → icon + "Print".
  "Print" (not "Print PDF") because `/print` is a browser-print template,
  not a downloaded artifact — an honest label kills the icon-vs-export
  confusion without merging surfaces.
- `ExportPdfButton` disabled label: "Publish to export PDF" → "Export
  PDF"; precondition stays in `title` ("Publish the report first") and
  the existing sr-only `#disabledReason` hint. Disabled-state semantics,
  handlers, and gating unchanged.

### D3 — Agent review: compact + trailing edge

Use the existing `compact` prop (`agent-review-coming-soon.tsx:24-26`)
and move the element after Present/Print in the utility group. The
ComingSoonBadge inert-control pattern (repo rule for deferred features)
is preserved exactly; only prominence and position change. This renders
below the 44px cluster height — recorded as a spec-level exception via
the `ui-control-density` delta: the requirement's intent is hittable
interactive targets; an aria-disabled placeholder is not one.

## Invariants (load-bearing check)

- **period dual-state / role-coverage gate / destructive-db guard** —
  untouched (no API, no DB, no procedure changes).
- **deferred-feature pattern** — preserved (Agent review stays an inert
  ComingSoonBadge control; `TODO(AGENT-REVIEW-01)` untouched).
- **ui-control-density** — engaged: recolor research gate satisfied
  (memo + sign-off); cluster-height requirement modified by delta spec
  (inert-placeholder exception).
- **status-color-semantics** — not engaged: ScopeToggle is not a status
  surface; no status tokens touched; no new literals introduced.

No request paths, Prisma writes, or shared schemas change — no
before/after data-flow needed.

## Risks / Trade-offs

- [Wider Row 1] "Present"/"Print" labels widen the utility group →
  flex-wrap already handles overflow; verify wrap point at narrow
  viewports during acceptance.
- [Two PDF-ish actions remain] "Print" and "Export PDF" still coexist →
  deliberate (different surfaces); honest labels + row separation carry
  the distinction; revisit only if confusion persists in UAT.
- [Shared component restyle] ScopeToggle is used by other role shells →
  visual-only change, same DOM/ARIA; check lead/viewer screenshots in
  acceptance.
- [Test drift] `scope-toggle.test.tsx` and `weekly-report-page.test.tsx`
  assert old labels → update assertions with the labels, contract
  unchanged.

## Migration Plan

Pure frontend. Implement → `pnpm typecheck && pnpm lint && pnpm test &&
pnpm build` → live before/after screenshots (servers on :3100) at
default + narrow viewport, head role → user acceptance → archive with
spec sync. Rollback: single `git revert`.
