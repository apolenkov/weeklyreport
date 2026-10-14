# Proposal

## Why

The Head can lose sight of saved activity records after a Lead is detached, and a Lead can overwrite newer weekly activity fields while an older local edit remains open. Request-changes validation can also expose a serialized technical issue array rather than useful error copy.

## What Changes

- Preserve unmatched activity-backed records in the consolidated ActivityStatusStrip with an explicit unavailable-details group; no invented activity metadata or status.
- Retain the original weekly-fields base while dirty, preserve local text, warn when authoritative fields change, and block Save until the existing Cancel/reopen recovery.
- Reuse the existing mutation error helper on the demonstrated request-changes consumer, preserving useful domain errors and typed input.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `weekly-activity-presentation`: saved records with unavailable activity details remain visible; dirty weekly-field edits cannot overwrite a newer authoritative pair without recovery.
- `review-verdict-integrity`: a request-changes validation failure presents actionable copy while retaining the reason, rather than serialized issue data.

## Impact

Affected owners: ActivityStatusStrip, StatusOverviewActivityEditor/useActivityFieldsDraft, RequestChangesDialog. Backlog TASK-503.12, C4962/C5075/C5106; approved design and public-producer inventory: `/home/user/work/handoffs/task-503/fix-503.12/DESIGN-PROBE.md`.

## Non-goals

- No API/schema/migration or detach-policy change.
- No invented activity name/status, forced overwrite, three-way merge, or new version owner.
- No raw server logging or blanket credential-leak claim.
- No unrelated dependencies, palette, Markdown grammar, or registry edits.
