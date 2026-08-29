## Context

See `proposal.md` for motivation. The current repository has one flat durable-spec catalogue, plus archived changes that must remain provenance. This change is planning-only: implementation will later reconcile the named delta files and then rebuild the index from the resulting durable inventory.

## Goals / Non-Goals

**Goals:**

- Make the retirement/update disposition explicit and mechanically reviewable.
- Keep each delta at the existing capability path, with full requirement blocks for updates and reason/migration text for retirements.
- Define an index reconciliation that detects duplicate, missing, or broken links.
- Preserve archived history and avoid treating documentation-count cleanup as part of this change.

**Non-Goals:**

- No edits to `openspec/specs/`, `openspec/specs/README.md`, application code, or docs during planning.
- No archive deletion, rename, or rewrite.
- No behavior, schema, dependency, or runtime migration.

## Decisions

1. **One delta per named capability.** Create 14 delta files under the exact existing paths. Five use `REMOVED Requirements`; nine use `MODIFIED Requirements` containing the complete current requirement blocks. This preserves archive semantics and lets OpenSpec apply reconstruct the intended durable result without inventing new capabilities.

2. **Archived history is immutable provenance.** Retirement migration notes point future implementers to surviving canonical contracts and archived changes; no archive is copied into or removed from the current catalogue.

3. **Index reconciliation is a later implementation task.** The implementation will derive the final set from `openspec/specs/*/spec.md`, update the README once, and run its deterministic inventory/index/link checks. Dynamic count wording in docs is explicitly tracked as a separate follow-up task.

4. **Safety invariants remain unchanged.** This catalogue operation does not touch period dual-state writes, canonical role middleware identity, the destructive-database guard, or the deferred-feature pattern. It also requires no before/after runtime data flow because no request path or persisted data changes.

## Risks / Trade-offs

- [A retirement hides a still-live contract] → Require an owner review against current consumers and archived changes before applying each retirement; retain the explicit migration note.
- [A modified delta drops requirements] → Validate that every `MODIFIED` requirement name and complete scenario block matches its current durable source before archive.
- [The README drifts from the final inventory] → Run duplicate/unindexed/broken-link checks after the durable edits and treat any output as a failed task.
- [Historical counts remain misleading] → Keep count cleanup as a separately named docs task, with no count claims added by this change.

## Migration Plan

1. Review the 14 delta files and confirm the exact 5/9 disposition totals.
2. Apply the retirement and update deltas to the durable specs.
3. Rebuild `openspec/specs/README.md` from the final durable inventory and verify links.
4. In a separate docs task, remove stale dynamic counts after their references are checked.
5. Run strict OpenSpec validation; rollback is an ordinary revert of the durable-spec/index commit, while archives remain untouched.
