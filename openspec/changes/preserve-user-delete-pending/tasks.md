## Implementation and verification

- [x] 1. Add deferred-promise regression tests proving the users delete
      confirmation stays open and inert while pending, issues exactly one delete
      request, and closes after settlement on success and on failure.
- [x] 2. Pass `deleteUserMut.isPending` to `ConfirmDeleteDialog` and close the
      confirmation through the per-call `onSettled` mutation callback instead of
      the synchronous `setDeleteTarget(null)`.
- [x] 3. Verify: `pnpm exec vitest run src/features/admin/ui/users-tab.test.tsx`
      (34/34 pass; the two new tests failed before the fix), scoped ESLint and
      Prettier on the changed files, `git diff --check`, and
      `pnpm exec openspec validate preserve-user-delete-pending --strict`.
