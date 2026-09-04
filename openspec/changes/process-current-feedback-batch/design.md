## Context

Overview already edits and creates Current/Next items through the canonical
editor handle, but it renders a reduced page chrome. That makes the default
route look like a different workflow: period navigation, visibility, Fill
From, Save, quick add, and Submit appear only after switching to Edit. The
matrix also gives the identity column a different width, always renders neutral
health, and lets item metadata compete with the text/action layout.

## Decisions

### Recompose existing controls instead of inventing Overview actions

Overview consumes the same `LeadFormEditorHandle` as Edit. It renders the
existing header action component, completion presentation, period/visibility
toolbar primitives, and dialog host. Every mutation therefore continues to use
the canonical draft, autosave, optimistic version, authorization, and submit
flow. The Overview-only contextual item dialog remains the adapter for a
preselected Product or Activity cell.

### Make the matrix equal and attention-focused

At the accepted desktop breakpoint, identity plus three temporal columns use
four equal `minmax(0, 1fr)` tracks. Grid row sizing keeps all cells in one unit
the same height. Unit health is rendered only for `at-risk` and `blocked`;
neutral and healthy values remain in the model but do not consume visual space.

### Reserve one trailing rail per item

Continuity and Edit share an intrinsic-width trailing rail, while description
and tag own the flexible column. This keeps the affordances aligned without
truncating the report text or assigning arbitrary half widths.

## Invariants

- Overview remains the no-query default route.
- Previously planned and read-only records stay inert.
- Status derivation and canonical tokens remain unchanged.
- All writes reuse the existing lead editor and canonical dialogs.
- The five reviewed legacy feedback records remain retained for auditability;
  their lifecycle transition is recorded separately from the Overview UI.

## Feedback boundary

Feedback-tool selection, Agentation wire/API behavior, PostgreSQL persistence,
and authenticated identity are specified by the sibling
`replace-siteping-with-agentation` change and its research. This change only
records the five legacy records' non-destructive transition to `resolved`.
