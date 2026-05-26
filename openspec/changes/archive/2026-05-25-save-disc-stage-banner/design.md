# Design

## Affected files

```
apps/web/src/components/report-shell/
  save-now-button.tsx           ← rewritten (icon-only)
  save-now-button.test.tsx      ← rewritten (aria-label assertions)

apps/web/src/components/lead/
  lead-form.tsx                 ← toolbar wiring: leadingExtras removed,
                                  SaveNowButton moved to trailingExtras tail
  stage-multi-select.tsx        ← banner hoisted, enumeration collapsed
  stage-multi-select.test.tsx   ← 7 new banner-behaviour tests added
```

## Data flow — SaveNowButton

```
useLeadFormAutosave()
  └── AutosaveSnapshot { state, isInFlight, dirty, forceSave }
        │
        ▼
  SaveNowButton (props: autosave)
        │
        ├── state=idle       → DiscIcon   disabled (opacity-40)
        ├── isInFlight=true  → SpinnerIcon disabled
        ├── state=saved      → CheckIcon  disabled 1500ms, then revert
        ├── state=error      → AlertIcon  enabled (click → forceSave)
        └── state=pending    → DiscIcon   enabled (click → forceSave)
```

State machine is unchanged from the original. Only rendering changes.

## Data flow — StageMultiSelect warning

```
previewSeverity: "at-risk" | "blocked" | undefined
value: string[]           (currently selected stages)
stages: readonly string[] (all assignable stages)
        │
        ▼
bannerText = ""  (no banner when singleStage branch or empty stages)
if (isMultiChoice && previewSeverity):
  value.length === 0  → "All assigned stages will show as {Severity}."
  value.length === 1  → "Stage {value[0]} will show as {Severity}."
  value.length >= 2   → "Selected stages will show as {Severity}."
        │
        ▼
<div role="status" aria-live="polite" data-testid="stage-scope-banner">
  <AlertTriangleIcon /> {bannerText}
</div>
Positioned: after helper <p>, before checkbox flex-wrap
```

## Invariants preserved

| Invariant                  | How preserved                                                             |
| -------------------------- | ------------------------------------------------------------------------- |
| WCAG AA tap-target (44×44) | `min-h/min-w = var(--touch-target-min)` on button                         |
| Read-only guard on save    | `!isReadOnly` gate in lead-form.tsx unchanged                             |
| Role-coverage gate         | No new tRPC procedures; no middleware changes                             |
| `leadingExtras` prop       | Kept in `ReportToolbar` typed props; just unused in lead-form now         |
| Head shell unaffected      | `head-report-shell.tsx` never consumed `leadingExtras` (verified by grep) |

## Before / after — toolbar layout

```
before:
  [period nav] [archive toggle] | [FillFrom] [VersionHistoryNav] | [Save pill]
                                  ← middle leadingExtras →        ← trailing →
                                            ↑ Save lived here (middle slot)

after:
  [period nav] [archive toggle] | [FillFrom] | [VersionHistoryNav] | [Save ◼]
  ← archiveToggle →               ← trailingExtras ──────────────────────────→
                                                        ↑ Save now at far-right
```

## Commits shipped

| SHA prefix | Message                                                                     |
| ---------- | --------------------------------------------------------------------------- |
| `33d62f05` | `feat(report-shell): icon-only save button, anchored far-right in toolbar`  |
| `4d9a2332` | `style(report-shell): save-button to 32×32 round for sibling parity`        |
| `2164b5ca` | `feat(stage-multi-select): hoist scope warning to a banner above the chips` |
