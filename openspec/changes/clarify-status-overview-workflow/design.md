## Context

See `proposal.md` for motivation. The current worktree already contains an uncommitted continuation implementation: `StatusOverviewItemPreview` owns preview and row actions, `LinkedContinuationDragHandle` supplies the pointer shortcut, and `LinkedContinuationTarget` owns continuation editing, conflict recovery, promotion, and focus restoration. `StatusOverviewAdditionalUpdates` currently combines unmatched Current and Next collections beneath one label. These edits must be extended in place rather than reconstructed from `HEAD`.

## Goals / Non-Goals

**Goals:**

- Make the read-first three-period matrix understandable before interaction.
- Give each editable temporal cell one visible primary action.
- Keep pointer drag, keyboard parity, canonical editors, retained drafts, conflicts, history, and permissions intact.
- Align the content and action regions of every temporal cell at accepted desktop widths.

**Non-Goals:**

- No new write path, transition, store, API, schema, dependency, or reorder behavior.
- No automatic promotion and no change to publication or period lifecycle.
- No broader report-shell redesign.

## Decisions

1. **Keep the Current result as the row anchor.** The row continues to project one stable lineage across three periods. Previously planned is read-only; Current owns the result; Next owns the continuation. This preserves the existing model instead of cloning records into presentation-only cards.

2. **Use labelled actions as the baseline and drag as enhancement.** `Add next step` or `Edit next step` remains the keyboard and novice path. The grip remains a pointer affordance and gets explanatory context that dragging links work to Next week; it never represents ordering. This keeps the accepted drag requirement without making discovery depend on an unlabeled icon.

3. **Keep promotion manual but demote it visually.** The audited command remains unchanged and is exposed as `Start next step now`, subordinate to editing the Next step. No confirmation layer is added unless browser acceptance demonstrates accidental activation: the current operation already has canonical locking and history, while speculative modal code would add friction and scope.

4. **Give cells a shared vertical structure.** Item previews use a flex-column content region: description first, metadata and collapsed `History` next, then the action rail. Each grid cell stretches to the row height and its action rail rests at the bottom. This fixes alignment using existing CSS layout rather than measuring heights in JavaScript.

5. **Split independent collections semantically.** Unmatched Current items render as `Unplanned this week`; unmatched Next items render as `Standalone next-week plans`. The two arrays, ordering, preview budget, and editor-slot matching stay independent. No position-based pairing is introduced.

6. **Use contextual empty states.** Editable empty Next cells render `Add next step`; noneditable empty cells render `No update`. The existing dash can remain decorative. Mobile keeps the existing selected-lane behavior and labelled actions; a broader mobile navigation redesign is outside this change.

No request, shared-schema, Prisma, or API data flow changes. The existing flow remains:

`Overview action or drop → existing continuation/editor handler → canonical DraftPatch/write port → autosave/version checks → refreshed projection`.

The period dual-state invariant, role-coverage gate, and destructive-database guard are preserved and untouched. No migration, feature flag, destructive operation, or API rollout is required.

## Risks / Trade-offs

- **Dense translated labels can wrap** → use flexible wrapping and verify 1280 and 1728 desktop widths without horizontal overflow.
- **Drag remains hard to discover** → retain a visible labelled action and one concise instruction; do not rely on hover-only help.
- **Secondary promotion can still distract** → place it below or beside the Next action with lower emphasis, while retaining keyboard access.
- **Concurrent uncommitted work can be overwritten** → patch only the current worktree state, inspect each target diff, and stage only this change's paths.
- **Visual alignment can regress with long history/comments** → keep disclosures collapsed by default and browser-check long-text fixtures.

## Migration Plan

Implement as a local presentation change, run focused component tests and browser acceptance, then run repository gates applicable to the final owned diff. Rollback is the task-owned UI/spec patch only; persisted continuation history and report data remain untouched.
