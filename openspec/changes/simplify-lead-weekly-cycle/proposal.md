# Proposal

## Why

The lead report currently asks a lead to interpret overlapping Plan, Confirm, Update, Edit, and week-move actions, while automatic rollover omits unfinished Current work that has no explicit next step. The agreed TASK-038 research (`doc-003`) defines one deterministic boundary rule and a smaller action surface; TASK-047 is still changing the same files, so this change records the contract separately before implementation.

## What Changes

- Make rollover choose at most one target occurrence per `stableId`: an explicit next-period commitment wins; otherwise unfinished Current work continues once as an unconfirmed Current occurrence.
- Keep completed, resolved, paused, and postponed work out of the next active period; project uncommitted unstarted work into Paused work as automatically paused while preserving immutable source history and pause/resolution audit.
- Keep the three temporal columns and read-only prior week, but replace competing primary actions with one canonical progress/status interaction plus only context-required secondary actions.
- Treat carried planned commitments and carried in-progress continuations as unconfirmed until the lead explicitly updates them; neither counts as a new weekly result merely because rollover ran.
- Preserve existing race safety, section-versioning, stable lineage, autosave, canonical editor, and accessibility contracts.

## Non-goals

- No mobile or report-wide redesign, new persistence model, migration, dependency, endpoint, or manual carry-over control.
- No change to report lifecycle, publication, authorization, risk-derived alarms, decisions carry-over, or historical replanning.
- No concurrent edits to TASK-047-owned dirty files; apply begins only after a safe ownership handoff.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `carry-over-automation`: define deterministic commitment precedence and fallback continuation for unfinished Current work.
- `unified-report-authoring`: define the minimal lead action model and unconfirmed weekly-result semantics.
- `record-status-derivation`: distinguish carried planned commitments from carried in-progress continuations without changing the stored vocabulary.
- `lead-status-overview`: retain read-only history and three columns while reducing duplicate primary controls.

## Impact

Expected scope is the existing carry-over planner/cloner and focused tests in `apps/api`, plus the existing Overview model/actions/editor and component tests in `apps/web`. Shared schemas and Prisma remain unchanged unless code inspection proves the existing `carriedOver` marker cannot express the required unconfirmed state. No new package or service is introduced.
