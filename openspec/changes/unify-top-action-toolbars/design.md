# Design — Unify Top Action Toolbars

Reference-driven: this is a CONSISTENCY PORT of the existing lead toolbar idiom,
NOT a new aesthetic. No new tokens, no theme/dark-mode work (repo rule). The
frontend-design discipline applied here is hierarchy, intentional grouping, and
exact spacing — not "bold/distinctive". Reuse existing components/tokens.

## Reference component (the canonical idiom)

`report-shell/report-toolbar.tsx` → `ReportToolbar`. Its container class IS the
"unified pill bar":

```
rounded-[var(--radius)] border border-[rgba(0,0,0,0.08)]
bg-[var(--color-surface-hover)]/70 px-2 py-1.5
flex items-center justify-between gap-2
```

Slots: left = period navigator + archive toggle (gap-1.5); center =
`ReportToolbarCenterLabel` (dept · detail); right = `trailingExtras` (gap-1.5).

## Problem recap (verified in source)

- **Head** (`head/head-report-shell.tsx:145`): action controls float in a bare
  `flex justify-end gap-x-5` row ABOVE the page; only period/archive/dept sit in
  the pill. The user wants the actions IN the strip too, grouped like lead.
- **Viewer** (`app/(app)/reports/[reportId]/page.tsx`): renders its OWN `<h1>` +
  a bare action row, then `WeeklyReportPage` renders its OWN header → title
  DOUBLED. Bug (task 2.0).

## Decisions

### D1. One unified "actions pill", same idiom, but WRAP not CLIP

Frame the action controls in a pill that reuses the ReportToolbar container
tokens (border / `bg-surface-hover/70` / `rounded-[var(--radius)]` / `px-2
py-1.5`), arranged `flex flex-wrap items-center justify-between gap-2`.

- **Use `flex-wrap`, NOT `flex-nowrap overflow-x-clip`.** The reference toolbar
  clips on narrow widths; the actions pill carries more controls and MUST NOT
  hide any — it wraps to a second line instead. (This is the one intentional
  deviation from the reference, for correctness.)
- Group by intent with a visible gap between groups:
  left group `[scope toggle · view-mode toggle]`, right group
  `[Present · Print · Agent review]`. Within a group gap-1.5; between groups the
  `justify-between` split (mirrors the lead "grouped by intent" arrangement).

### D2. Present / Print stay labeled

Present and Print remain LABELED text+icon pills (primary actions; Print is the
green accent). Do NOT collapse primaries to icon-only. Utility/inert controls
(Agent review) stay compact as today.

### D3. Head — two tiers, both in the idiom

1. Actions pill (D1) replaces the bare floating row, in BOTH form and slides
   mode.
2. The existing `ReportToolbar` (period + archive + dept) stays as the second
   tier via `WeeklyReportPage`'s `toolbar` slot — unchanged. Result: two clean
   pill tiers, no floating controls.

### D4. Viewer — fix the doubled title via the head pattern

1. Delete the wrapper's own `<h1>Status Report</h1>` + Report-ID block (the
   `WeeklyReportPage` header is the single source of the title).
2. Move the viewer actions (Back to Archive · Presentation · Print · Agent
   review) into the same actions pill (D1) and feed it through
   `WeeklyReportPage`'s `toolbar` slot, exactly as the head shell does, so the
   inner context bar is suppressed and the title shows ONCE.
3. Keep all hrefs/aria/behavior (Back to Archive → `/reports?tab=published`,
   etc.).

### D5. Audit (report surfaces only)

Inventory + align: lead form header, head dashboard/review, viewer. Record a
match/diverge table in the change. Do NOT touch non-report app top bars.

#### Audit result (2026-06-14, implemented)

| Report surface                                   | Before                                                               | After / outcome                                                                                                                                                            |
| ------------------------------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lead report header (`lead-form.tsx`)             | Reference idiom — actions in page header, `ReportToolbar` pill below | Unchanged — this IS the canonical idiom the others mirror                                                                                                                  |
| Head report form (`head-report-shell.tsx`)       | Bare floating `flex justify-end` action row                          | Aligned — controls now in the shared `ReportActionsPill`                                                                                                                   |
| Head report slides (`head-report-shell.tsx`)     | Same bare row above the deck                                         | Aligned — same `ReportActionsPill` (agent-review form-only)                                                                                                                |
| Published viewer (`reports/[reportId]/page.tsx`) | Bug: own `<h1>` + bare action row → DOUBLED title                    | Fixed — dup `<h1>` dropped, actions in `ReportActionsPill` via the `toolbar` slot. Verified live as the VIEWER role: one title, pill present, empty page-header right side |
| Head dashboard (`dashboard/dashboard-page.tsx`)  | Analytics page header (`<h1>Dashboard</h1>` + optional "Revoke All") | Intentionally distinct — no report-style action toolbar to unify (no scope/view-mode/present/print/period); left untouched, in scope only to record N/A                    |
| Head presentation (`head-present-client.tsx`)    | Fullscreen deck, no top action row                                   | Intentionally distinct — presentation mode has no toolbar; out of scope                                                                                                    |

Live-verified side effect (intentional per D4): routing the viewer actions
through the `toolbar` slot REPLACES `WeeklyReportPage`'s default period
`ReportToolbar`, so the viewer no longer shows the period navigator or the
"Live portfolio review" department label. D4 accepts this — the dropped
context bar was arguably wrong on an archived/published report anyway.

Intentional, design-sanctioned distinction recorded: the lead folds its few
actions into the page-header row; head/viewer use a DEDICATED actions-pill tier
above the period toolbar (D3) because they carry more read-only utility
controls. Both consume the same `REPORT_TOOLBAR_FRAME_CLASS`, so the framing is
identical even though the placement differs by surface.

Shared frame source: `REPORT_TOOLBAR_FRAME_CLASS` in
`report-shell/report-toolbar.tsx`, consumed by both `ReportToolbar` and the new
`ReportActionsPill` — no forked literal class string.

## Verification

- Render tests: each surface's action controls present, grouped, aria/hrefs
  preserved; snapshots updated honestly.
- Live (Playwright MCP) at TWO widths — 1728px (the user's viewport) AND ~1280px
  — to confirm the actions pill WRAPS and never clips a control. Before/after
  screenshots for head (form + slides) and viewer to `/tmp/finish-backlog-shots/`.
- Viewer: assert exactly ONE "Status Report" title on screen.
