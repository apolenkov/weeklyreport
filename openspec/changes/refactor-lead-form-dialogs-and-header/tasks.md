## 1. Web implementation

- [ ] 1.1 Add `lead-form-header-actions.tsx`: the page `<header>` (title,
      submitted/autosave badge incl. the `autosaveLabel` derivation) and the
      `DocumentActionGroup` (deferred Version/PDF controls, Fill-From, Save,
      Request Reopen, Revoke, Quick-add, Submit) — markup verbatim, consuming
      `viewModel`, `merges`, and `writeActions` wholesale plus named residuals.
- [ ] 1.2 Add `lead-form-dialogs.tsx`: the submit-confirmation dialog (own-only
      record counts + unset-stage warning), the quick-add `ItemEditDialog`
      host, `RequestReopenDialog`, and `ConfirmDeleteDialog` — markup and
      mount/`open` semantics verbatim.
- [ ] 1.3 Rewire `lead-form.tsx` to render both components; keep the whole
      `writeActions` object instead of the ~18-name destructure; toolbar,
      edit/slides branch, effects, ref assignments, and hook order unchanged.
- [ ] 1.4 Keep both new files under the 250-line max-lines standard and do not
      add or expand any ESLint exemption.

## 2. Planning and verification

- [ ] 2.1 Update `openspec/specs/architecture-refactor-backlog/spec.md` and the
      matching change delta with actual post-slice `lead-form.tsx` LOC evidence.
- [ ] 2.2 Run focused tests:
      `cd apps/web && pnpm exec vitest run src/features/report-sections/ui/lead-form.test.tsx src/features/report-sections/ui/lead-form-visibility.test.tsx src/features/report-sections/ui/lead-form-addressable.test.tsx src/features/report-sections/ui/lead-form-viewmode.snapshot.test.tsx`.
- [ ] 2.3 Run scoped lint on changed web files with `--max-warnings 0`.
- [ ] 2.4 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`,
      and `git diff --check`, then validate this change with `--strict` and
      run the full strict OpenSpec validation.
