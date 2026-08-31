# Head and viewer default to submitted-only on the live current period

**Status:** accepted and implemented.

## Decision

The head and viewer see only submitted sections of the live current period by
default. An explicit Show all control reveals all authorized sections, including
drafts.
The toggle changes presentation only; it does not change authorization or the
published snapshot, which renders as stored.

When all sections are drafts, the interface explains that content is hidden and
offers the toggle instead of showing a misleading empty state. Search remains
scoped to published content.

Current contracts: `openspec/specs/report-routing/spec.md` and
`openspec/specs/head-report-visibility/spec.md`.
