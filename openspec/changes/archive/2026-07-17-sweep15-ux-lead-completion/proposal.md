## Why

On long lead reports, Save/Add/Submit disappear above the viewport and the lead reaches Submit without a clear account of unset stages, automatic promotion, or blockers. The P2 product review calls for completion guidance at the point of action.

## What Changes

- Add a compact sticky action cluster when the header action group leaves the viewport, reusing the same Save state, Add picker, Submit handler, pending/disabled states, and accessible names.
- Add an end-of-form readiness summary next to the final Submit action.
- Derive readiness from the same draft data and coupling/submit rules used by the existing submit path: list unset fields, explain which statuses become On Track automatically, and identify blockers that prevent opening confirmation.
- Keep the header action group canonical and avoid duplicate focusable controls while it is visible.

## Capabilities

### New Capabilities

- `lead-completion-guidance`: Sticky completion actions and a truthful end-of-form readiness summary.

### Modified Capabilities

- None.

## Impact

Touches the lead form shell/header actions, submit-readiness derivation, styles, and responsive/accessibility tests. Submit validation, autosave, quick-add routing, and server contracts are unchanged.

## Non-goals

- No new submission rule or mandatory-content policy.
- No sticky behavior in slides or read-only/submitted modes.
- No replacement of the existing sticky context toolbar.
