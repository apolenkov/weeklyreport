# Phase 64 Plan - Closure: Regression Coverage Gaps

## Goal

Close actionable regression gaps from `COVERAGE-GAP-2026-05-14.md` without
duplicating already-covered work.

## Scope

- `D-12`: item dialog status reset on reopen.
- `UFB-011`: head/lead top spacing bounding-box regression.
- `UFB-014`: reconcile stale coverage gap against current stageIds code.
- PR #5 CI state remains a Git/infra gate, not a code implementation item.

## Do Not Reopen

- `E-04`
- `E-08`
- `UFB-024`

## Verify

- Targeted component tests pass.
- Targeted Playwright regression passes.
- `pnpm turbo test` passes or any failure is classified.

## Exit

Phase exits when coverage report contains no stale actionable regression rows
for these items.
