# Design

## Context

See `proposal.md` for the review gap. The concurrency tests use the real
TanStack Query mutation owner inside `RemindersTab`; only transport is stubbed.
They expose an additional defect on the MR !72 baseline: `mutate`-level
callbacks belong to the latest mutation observer, so a prior overlapping row
never receives its busy-state cleanup. The owner authorized the minimal repair
in this branch on 2026-10-07.

## Goals / Non-Goals

**Goals:** Prove the reviewed regressions through their existing user-facing
owners and make every overlapping reminder mutation settle independently.

**Non-goals:** Add test-only production exports, replace dependency behaviour
with callback mocks, change report or database lifecycle, or redesign UI.

## Decisions

- Keep tests in the existing component suites. Deferred transport promises
  allow both settlement orders and both outcomes while the real query library
  owns callback delivery. Direct hook mocks would miss the confirmed defect.
- Move row cleanup to mutation-option `onSettled` callbacks, which run per
  request. Keep the editor's pending state separate. This avoids a custom
  request scheduler or manually consumed mutation promises.
- Test next-send by advancing only Date and changing the search field in a
  mounted tab. Existing next-send tests only cover initial rendering.
- Test list shrink through rerendered component inputs and the resulting
  active descendant, scroll target and addressed navigation. Keep the existing
  head-envelope tests as the primary owner of that already-covered contract.
- Verify viewport positioning from trigger geometry and rendered CSS bounds.
  jsdom does not establish visual acceptance; no visual PASS is claimed.

## Risks / Trade-offs

- Mutation observer ownership hides concurrency failures → use real mutations,
  request ordering and success/failure cases, including eventual row release.
- A regression test might fail for unrelated historical changes → restore only
  the affected production files from the parent of each reviewed commit, keep
  the new tests in place, and restore the current sources before further checks.
- Concurrent sessions own OCR branches and the shared E2E database → use this
  worktree only, local dependency installation and no database/E2E operations.

## Migration Plan

No migration, feature flag or dependency change is needed. The repair changes
the web mutation completion path only; server request fields and routes are
unchanged. Period dual-state, role-coverage and the destructive database guard
remain unchanged. Deliver as a separate MR targeting main without merging.
