## Context

See `proposal.md` for the discovery. `ExportPdfButton` currently renders a
native disabled `ToolbarIconButton` followed by an `sr-only` description.
Native disabled buttons do not receive keyboard focus and do not emit normal
pointer events, so neither the button's native title nor the hidden
description can provide visible prerequisite guidance.

## Goals / Non-Goals

**Goals:**

- Keep the compact icon button and current disabled semantics.
- Give the disabled state one hoverable and focusable surface that opens exact
  prerequisite guidance.
- Preserve the screen-reader description on the button itself.

**Non-Goals:**

- No change to PDF eligibility, job lifecycle, or toolbar-wide primitives.
- No permanent text label or layout expansion in the document-action row.

## Decisions

### Wrap only the disabled export control in a tooltip trigger

The unpublished/reopened branch will render the disabled button inside an
inline wrapper used as the tooltip trigger. The wrapper is keyboard-focusable,
uses the existing tooltip primitives with zero delay, and exposes no button
role of its own. The button keeps `disabled`, `aria-label="Export PDF"`, and
`aria-describedby` pointing to the exact prerequisite text.

Alternative: put the tooltip trigger directly on the disabled button.
Rejected because native disabled controls do not reliably receive hover or
focus events.

Alternative: use only a native `title` on the wrapper. Rejected because native
tooltips are not consistently keyboard-accessible, testable, or captured in
browser evidence.

### Leave the exportable branch unchanged

Published reports retain the current interactive `ToolbarIconButton` and
action-name title. The prerequisite tooltip exists only when export eligibility
is false, so no wrapper affects click behavior or the busy export state.

### Preserve load-bearing invariants

This is presentation-only. Period dual-state, role-coverage middleware,
destructive-database guards, and deferred-feature rules are unchanged. No API,
shared schema, data migration, feature flag, or backend rollout is required.

## Risks / Trade-offs

- [The wrapper enters the tab order while its button is disabled] -> This is
  intentional because the wrapper is the only keyboard path to the reason;
  it must not expose a button role or activation handler.
- [Tooltip content duplicates the screen-reader description] -> Keep one exact
  prerequisite string and bind the button to the same content identifier.
- [The wrapper changes toolbar geometry] -> Use an inline-flex wrapper with no
  padding or size of its own and verify rendered geometry.

## Migration Plan

Deploy as a web-only presentation change. Roll back the component commit if
needed; no stored state or downstream contract changes.
