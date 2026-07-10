## 1. Web implementation

- [ ] 1.1 Add `lead-form-item-sections.tsx`: the unified-vs-classic items
      conditional (unified Activity accordion OR Current Week + Next Week
      accordions), markup verbatim, consuming `viewModel` and `merges`
      wholesale plus named residuals.
- [ ] 1.2 Add `lead-form-edit-sections.tsx`: `LeadReviewFeedback`, the
      `LeadFormSyncBridge.Provider` block with the Product Status, Project
      Activities, `LeadFormItemSections`, and Risks accordions, and the
      Decisions accordion — markup verbatim; the item sections stay children
      inside the Provider.
- [ ] 1.3 Rewire `lead-form.tsx`'s edit branch to render
      `<LeadFormEditSections …/>`; slides branch, header, toolbar, dialogs,
      render-phase ref assignments, and hook order unchanged.
- [ ] 1.4 Keep both new files under the 250-line max-lines standard and do not
      add or expand any ESLint exemption.

## 2. Planning and verification

- [ ] 2.1 Update `openspec/specs/architecture-refactor-backlog/spec.md` and the
      matching change delta with actual post-slice `lead-form.tsx` LOC evidence.
- [ ] 2.2 Run focused tests:
      `cd apps/web && pnpm exec vitest run src/features/report-sections/ui/lead-form.test.tsx src/features/report-sections/ui/lead-form-visibility.test.tsx src/features/report-sections/ui/lead-form-addressable.test.tsx src/features/report-sections/ui/lead-form-viewmode.snapshot.test.tsx src/features/report-sections/ui/lead-form-sync-bridge.test.tsx`.
- [ ] 2.3 Run scoped lint on changed web files with `--max-warnings 0`.
- [ ] 2.4 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`,
      `git diff --check`, `openspec validate refactor-lead-form-edit-sections
--strict`, and `openspec validate --all --strict`.
