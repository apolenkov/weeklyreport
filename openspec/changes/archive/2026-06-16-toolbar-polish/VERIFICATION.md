# Verification — toolbar-polish

## Toggles → green (part 1)

`ScopeToggle` + `ViewModeToggle` reverted to the brand green family
(`--color-starbucks-accent` active fill, white active text) by restoring the
pre-`6a362c2c` files (components + green snapshots + style test). The
agent-placeholder reposition and the `head-report-shell` position test from
`6a362c2c` were KEPT (those files were not touched). See
`screenshots/head-toolbar-after.png`: Product/Leads and Edit/Slides render green.

## Export PDF → icon button (part 2)

`ExportPdfButton` now renders through the shared 32px `ToolbarIconButton`
(`aria-label`/tooltip "Export PDF"; download glyph idle, spinner while
generating). The async contract (request → poll → busy/disabled → completion
download → failure toast) is unchanged — only the presentation differs. The
unpublished precondition is conveyed by the disabled state + the existing
`aria-describedby`/sr-only hint, never by the tooltip. In the screenshot the
control sits in the period-toolbar pill's trailing group, disabled (grey) because
the displayed period is open/unpublished.

## Lead toolbar spacing (part 3)

Removed the two `<Separator>` bars from the lead toolbar's trailing group so the
icon-button row (Fill-from, Version, PDF, Save) uses the one uniform `gap-1.5`
the group already declares — no larger gap before Save. Matches the head
trailing group (which carries a single control, no separators).

## Toggle → dialog bug (part 4) — NOT REPRODUCIBLE

Reproduced live on the head report (`small` seed): clicking the scope toggle and
the view-mode toggle opened ZERO dialogs (`afterScopeDialogs: 0`,
`afterViewDialogs: 0`). This matches the structure: the head report wires no
item/risk/decision dialog into the toggles (scope = `setScope` state, view-mode =
`<Link>`); those dialogs live only on the lead form. The requirement stands as a
guard: `scope-toggle.test.tsx` → "selecting a scope opens no item/risk/decision
dialog" (clicking a segment fires `onChange` only, no `role="dialog"` appears).

## Gate

`prisma generate && typecheck && lint && test && build` — all green.
