## 1. Shared UI Boundary

- [x] 1.1 Add typed overlay-layer, backdrop-selector, initial-focus, and
      restore-focus seams to the existing `@customreport/ui` Dialog content so
      confirmation consumers preserve their contract without adding a
      duplicate primitive or dependency.

## 2. Web Confirmation Dialogs

- [x] 2.1 Migrate `ConfirmationDialog` from the application-owned portal,
      surface, and focus hook to the existing Radix-based Dialog while
      preserving copy, slots, test ID, visual classes, actions, and pending
      guards.
- [x] 2.2 Migrate `ConfirmDeleteDialog` to the same primitive while preserving
      preview, subtitle, consequence, tone, reversible copy, least-destructive
      initial focus, trigger focus restoration, and pending guards.
- [x] 2.3 Remove only modal-lifecycle code made unreachable by these two
      migrations; keep the shared hook and legacy surfaces required by the
      remaining feature dialogs.

## 3. Characterization And Verification

- [x] 3.1 Add or update focused tests for role/name/description, focus
      containment and restoration, Escape, backdrop, normal actions, and
      pending-state suppression for both shared dialogs.
- [x] 3.2 Run the exact focused test files, targeted ESLint with
      `--max-warnings 0`, targeted Prettier, web and UI typechecks,
      `pnpm exec openspec validate adopt-radix-confirmation-dialogs --strict`,
      and `git diff --check`; record all commands and results.
- [x] 3.3 Include both shared confirmation surfaces in the final R61 visual and
      keyboard runtime evidence before closing the runtime campaign.

Evidence: `customreport-archive/2026-08-27-r61-shared-confirmations-f6c0caea-r1/` binds real lead Submit `ConfirmationDialog` and admin product Archive `ConfirmDeleteDialog` consumers to clean commit `f6c0caea7ad9c45d1352c1b57c039122b0847a51`, tree `bf30c945b193ab2858233fde7568e3aea60e00f4`. The passing Chrome run captures four full-frame Cancel/confirm focus states and records keyboard Enter-open, least-destructive initial focus, bidirectional focus wrap, Escape dismissal, and trigger restoration for both surfaces, with zero scoped axe violations and zero browser/network errors. The shared focused suite passes 28/28 and separately proves pending action/Escape/backdrop suppression. Attempt 1 is excluded as `INCOMPLETE_ORACLE`; attempt 2 passes 1/1; teardown is zero-residue. Two independent reviews returned `APPROVE` with no blocker IDs. This closes 3.3 only, not the full runtime campaign or CR-001.
