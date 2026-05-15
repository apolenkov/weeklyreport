# Phase 63 Plan - Closure: Git Audit And Metrics Repair

## Goal

Make Git truth and GSD planning metrics agree.

## Scope

- Branch/upstream/worktree audit.
- Commit delta against `main`.
- Dirty tree classification.
- PR #5 and GitHub Actions classification.
- Evidence-based updates to `STATE.md`, `ROADMAP.md`, v8.1 roadmap and
  requirements.

## Tasks

1. Update `.planning/audits/v8.1-GIT-AUDIT-2026-05-14.md`.
2. Recompute phase and plan counts from filesystem and `gsd-sdk`.
3. Update planning counters without invented numbers.
4. Preserve old handoff/history layers.
5. Keep pre-existing regression evidence JSON unstaged.

## Verify

- `git status --short --branch` shows only intentional audit/planning edits
  plus known pre-existing evidence JSON.
- `pnpm lint:md` passes.

## Exit

Phase exits when `.planning/STATE.md` and milestone docs no longer contradict
the measured repo state.
