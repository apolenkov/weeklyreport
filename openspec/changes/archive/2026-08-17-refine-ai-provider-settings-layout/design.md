## Context

`SettingsTab` renders the desktop Settings navigation with
`overflow-x-auto`. Because the companion overflow axis is not constrained, the
tab strip can become vertically scrollable. `AiProviderCardContent` then adds a
bordered, shadowed surface inside the already bordered Admin panel; its form,
feedback, diagnostics, and retained revisions consequently read as one tall
stack even though they have different levels of importance.

The existing Provider component tree already owns the correct live fields and
mutation callbacks. The change can therefore stay in the frontend composition
layer and preserve the `admin.aiProvider` contract, draft payload, lifecycle
states, and accessible disclosure behavior.

## Goals / Non-Goals

**Goals:**

- Make AI → Provider easier to scan at the 1440×746 target viewport.
- Preserve the current conceptual flow: provider summary → configuration →
  actions → capability feedback → revision information.
- Give Generation and Embeddings clear peer sections in a 7/12 + 5/12
  composition on large screens, stacking cleanly on narrow screens; keep
  separate embedding fields conditional.
- Remove unnecessary visual weight from the nested Provider surface and use
  consistent `gap-*` spacing and semantic separators.
- Keep the capability result visible as a compact status strip while moving
  provider metadata and retained revisions behind a secondary Diagnostics
  disclosure.
- Make the outer Settings tab strip horizontal-only when it overflows.

**Non-Goals:**

- No changes to tRPC procedures, shared schemas, database data, provider
  runtime resolution, or lifecycle semantics.
- No changes to AI Features, prompt management, Integrations, Holidays, or
  other Settings tabs.
- No new dependency, design-system primitive, or navigation model.

## Decisions

### Keep the existing component and data boundaries

Update the existing Provider card, form/section, action, feedback, and
diagnostic composition rather than introducing a second configuration model.
This keeps `toAiProviderDraft`, mutation callbacks, loading states, and
`aria-expanded` behavior unchanged. Rewriting the card as a new state machine
was considered and rejected because it would add risk without improving the
requested layout.

### Reduce chrome without removing the Provider boundary

Keep a recognizable Provider section and its current `data-testid`, but remove
the extra shadow and reduce padding/spacing. Use a compact header row and light
separators for the form, feedback, diagnostics, and retained revisions. This
reduces the card-in-card effect while preserving the current disclosure model
and all controls.

### Use a responsive two-region configuration layout

Render Generation and Embeddings as peer regions with Generation occupying
seven of twelve columns and Embeddings occupying five at the large breakpoint;
stack them below that breakpoint. The conditional separate-embedding block
remains inside Embeddings, with the same fields and payload mapping. Existing
field components remain the source of truth; only their local layout classes
and section wrappers change.

### Make diagnostics secondary without losing access

Keep capability status, preparation progress, operation feedback, and errors in
the main expanded flow. Place revision metadata and retained-revision actions
inside a native accessible `details` disclosure labelled `Diagnostics`, closed
by default. This reduces the first-viewport height while preserving every
diagnostic and lifecycle action. A custom modal or route was considered and
rejected because it would add navigation and state complexity.

### Constrain only the Settings tab strip's cross-axis overflow

Add an explicit vertical overflow constraint to the `TabsList` in
`SettingsTab`, retaining horizontal scrolling for narrow widths. This is a
local fix for the reported outer tablist and does not alter the shared Tabs
primitive or the AI sub-navigation.

## Risks / Trade-offs

- [Risk] A denser layout can make labels or validation messages feel cramped
  at intermediate widths → keep the existing responsive field grids, stack
  peer sections before they become narrow, and verify at desktop and mobile
  widths.
- [Risk] Removing surface chrome could weaken the Provider section boundary →
  retain a light border/separator and the existing heading/status hierarchy.
- [Risk] Explicit vertical clipping could hide a focus ring → verify keyboard
  traversal and keep the tab strip's horizontal scrolling area reachable.

## Migration Plan

No migration or rollout flag is required. Ship the frontend-only class/markup
refinement and targeted tests together. Rollback is a revert of the affected
frontend files; no persisted data or API compatibility is involved.

## Open Questions

None. The requested scope and preserved behavior are explicit.
