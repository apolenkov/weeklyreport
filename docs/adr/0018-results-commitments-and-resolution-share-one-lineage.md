# Results, commitments and resolution share one lineage

**Date:** 2026-09-11

A current result and a next-period commitment belong to one tracked task, not
two editable task rows: moving the result into Next would erase what happened,
while cloning it would make progress and ownership ambiguous. Keep the current
result and optional next commitment independently on the same occurrence;
carry a commitment forward as planned, never as an assertion that work started.

Won't do is an audited resolution rather than deletion or another progress
status. Keep its reason, actor, previous state and reversal history so an
editable draft can be corrected without rewriting published history. A later
resumption creates a new occurrence on the same lineage. Resolve commands and
ordinary draft saves share authorization, versioning and write coordination;
only the server selects the authoritative historical source.

The cross-period register is distinct from next week's plan: it finds paused
and deferred work across gaps, while terminal history requires explicit
reopening. These decisions refine [ADR 0015](0015-a-pozitsiya-is-resolved-never-deleted-once-published.md)
and are specified in the [unified authoring specification](../../openspec/specs/unified-report-authoring/spec.md).
