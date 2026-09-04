## Why

Five legacy product-feedback records (`cmtmm0l3f00002tw0sd3n1ucb`,
`cmtmm14cx00022tw052fzuxr2`, `cmtmm1j3m00042tw09303vns5`,
`cmtmm2r7z00062tw0alpj99wk`, and `cmtmm38gd00082tw0sa3qhmh4`) evaluate the
new lead Overview as a primary authoring surface. The saved screenshots show
unequal matrix columns, low-value neutral status badges, unstable item metadata
placement, and a mismatch between the actions available in Overview and Edit.

## What Changes

- Reuse the canonical lead header actions, period controls, visibility controls,
  view toggle, dialogs, draft, autosave, and submit paths in Overview.
- Keep Overview as the default route while retaining Edit for detailed report
  fields and Slides for presentation.
- Give the four desktop matrix columns equal width and a shared row geometry.
- Show unit health only when it requires attention (`At risk` or `Blocked`),
  while preserving canonical status derivation and accessibility.
- Keep continuity and edit affordances in a stable trailing item-action rail.
- Transition the five reviewed legacy records to the terminal `resolved`
  status without deleting their evidence.

### Non-goals

- No new write endpoint, draft store, status value, or report lifecycle path.
- No removal of the detailed Edit mode or Slides.
- No feedback-tool migration, schema migration, or external publication in
  this Overview refinement. Agentation migration is specified separately in
  `replace-siteping-with-agentation`.

## Capabilities

### Modified Capabilities

- `lead-status-overview`: make Overview and Edit share one authoring chrome and
  make the temporal matrix visually stable and attention-focused.

## Impact

The change is limited to the lead Overview composition, shared lead toolbar
composition, status matrix presentation, focused tests, and OpenSpec evidence.
