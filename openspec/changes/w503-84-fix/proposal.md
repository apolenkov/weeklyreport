# Proposal

## Why

C4719 (TASK-503.84, rev-waves-1 FAIL): the Settings → Periods "unified activity
view" toggle calls `updateDraft({ ...draft, unifiedActivityView: checked })`,
spreading the `draft` captured by the render closure. Other Periods fields use
the functional updater (`setDraft((current) => ...)`). If two draft mutations
are applied from the same committed render, the second spread overwrites the
first. Discrete UI events are flushed between each other in React 19, so this
was not reproduced through the UI: the regression test passed on the unchanged
source. The change is a consistency hardening, like its neighbours.

Backlog: TASK-503.84 (wave TASK-503.112). Finding evidence:
`~/work/handoffs/wr-513/s26/waves/rchunk-2-RESULT.md` (C4719).

## What Changes

- The unified activity view toggle updates the Periods draft through the
  functional updater, so it always merges into the latest draft state.
- No change to the save payload, validity gating, or the Periods field set.

## Scope

- `apps/web/src/features/period/ui/settings-periods-sub-tab.tsx` (toggle handler).
- `apps/web/src/features/period/ui/settings-periods-sub-tab.test.tsx` (regression test).
- Requirement delta in `specs/admin-settings-ui/spec.md`.
