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
- [ ] 3.3 Include both shared confirmation surfaces in the final R61 visual and
      keyboard runtime evidence before closing the runtime campaign.
