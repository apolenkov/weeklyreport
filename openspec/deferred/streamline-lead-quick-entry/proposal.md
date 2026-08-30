# Streamline lead quick entry

## Problem

The lead form currently presents product status, current work, next work,
risks, and decisions as several large independent accordions. The underlying
write paths are sound, but the page makes a lead navigate the form structure
before they can record the week. The product direction is an at-a-glance
temporal report: what was planned, what was completed, and what comes next,
with blockers visible immediately.

## Direction

When activated, reorganize the existing projections without adding parallel
records or save paths:

1. **Product Status** becomes a compact exceptions-first summary. Detailed
   stage controls remain available in the disclosure body and open directly
   when a blocker or missing status needs action.
2. **Work** becomes one derived temporal workspace. Current unfinished work,
   completed current work, and next-week work remain backed by their canonical
   item/week fields and existing draft actions.
3. **Attention** visually groups Risks and Decisions while preserving their
   separate dialogs, validation, and mutations. Achievements are the completed
   Work projection, not a new entity.
4. Phone and tablet layouts use a vertical flow with direct add actions. Wide
   layouts may present the temporal groups as aligned columns. No carousel or
   gesture-only navigation is introduced.

## Scope boundaries

- Reuse the existing autosave, draft patching, risk-to-stage sync, foreign-row
  filtering, and submit-readiness contracts.
- Preserve physical current/next week identity and canonical workflow status;
  the new workspace is a projection only.
- Keep summary signals textual as well as colored and keep every actionable
  exception reachable from the summary.
- Preserve read-only, snapshot, and slides behavior.

## Non-goals

- Add an `achievement` database field, endpoint, or independent mutation.
- Merge risk and decision payloads or persistence.
- Add horizontal mobile scrolling, a carousel, or a second local draft model.
- Implement this redesign during the current repository-excellence closeout.

## Status

Deferred by product direction on 2026-08-30 so the current pass can finish the
repository-quality, cleanup, responsive-regression, and release-evidence work.
The safe mobile toolbar, stage-grid, and accordion-header fixes remain in the
active closeout because they repair confirmed defects without changing the
information architecture.
