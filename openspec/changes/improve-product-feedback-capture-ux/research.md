# Product feedback capture UX research

Date: 2026-09-03. Sources: the two feedback rows named in `proposal.md`, pinned
SitePing packages at the repository lockfile versions, official SitePing source
and documentation, Plannotator's official annotation model, current WeeklyReport
source and OpenSpec.

## Findings

- SitePing draw and right-click flows always produce a DOM anchor. Right-click
  skips rectangle drawing but still anchors to the element under the pointer.
- SitePing supports only FAB corner placement. It exposes no public toolbar or
  composer drag/collapse option. Its composer placement owns focus trapping,
  viewport flipping, submit state, and Escape handling; patching it locally
  would create an unowned private dependency.
- The official feedback payload defines `annotations` as an array with a maximum
  but no minimum. WeeklyReport's shared schema and Prisma relation also allow an
  empty array, so a page comment needs neither a fake anchor nor a migration.
- SitePing's marker implementation is intended for annotated records. An
  annotationless record must be presented and navigated by the application
  inbox, not advertised as a focusable marker.
- Plannotator's `GLOBAL_COMMENT` confirms the targetless-comment UX pattern but
  uses a different wire model and does not belong in the WeeklyReport runtime.

## Decision

Use the existing same-origin authenticated endpoint for a host-owned page
comment with normalized pathname and `annotations: []`. Identity, product,
status, ownership, diagnostics limits, and role access remain server-owned.
The inbox labels the record `Page feedback` and links to the page without a
`siteping` query parameter.

Keep the upstream widget intact and remove the host-side drawing-toolbar shim.
Use only the supported locale callback to shorten its instruction. Prefer
right-click when the user wants immediate contextual feedback without the
drawing bar.
