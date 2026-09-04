# Research: current feedback batch

Verification date: 2026-09-04.

## Decision boundary

This change reconciles the five retained legacy feedback records that describe
the lead Overview. It does not select or migrate the feedback tool. The
primary-source evaluation and the decision to use Agentation are recorded in
the sibling `replace-siteping-with-agentation` change and in
`docs/research/agentation-v3-weeklyreport-implementation-2026-09-04.md`.

## Exact denominator

The reviewed denominator is exactly five records and their five annotations:

- `cmtmm0l3f00002tw0sd3n1ucb`: equal Overview columns and row geometry;
- `cmtmm14cx00022tw052fzuxr2`: omit neutral health badges;
- `cmtmm1j3m00042tw09303vns5`: stabilize item text and action placement;
- `cmtmm2r7z00062tw0alpj99wk`: keep Overview as the default surface;
- `cmtmm38gd00082tw0sa3qhmh4`: share the canonical Overview/Edit actions.

Each record was inspected with its saved target, viewport, screenshot, and
diagnostics. A sixth Faster Fixes record is outside this denominator.

## Code reconciliation

- `STATUS_OVERVIEW_DESKTOP_GRID` uses four equal flexible desktop tracks.
- Unit health renders only for `at-risk` and `blocked`; `empty` and `on-track`
  remain valid model values.
- Item text owns the flexible region while continuity and Edit share a stable
  trailing rail.
- The no-query lead route resolves to Overview.
- Overview reuses the canonical header actions, context controls, dialogs,
  draft, autosave, and submit paths.

Focused tests cover the shared chrome, default routing, status suppression,
equal tracks, and item-action layout. The separate browser acceptance task
remains explicit in `tasks.md` until its complete viewport evidence is attached.

## Lifecycle closure

All five records were transitioned through the authenticated feedback API from
`wont_fix` to terminal `resolved`; each PATCH returned HTTP 200 and a subsequent
GET returned `resolved`. The records, annotations, screenshots, and diagnostics
remain stored for auditability. The separate Faster Fixes record was not
changed.
