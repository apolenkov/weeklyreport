## 1. Web characterization

- [ ] 1.1 Add or confirm tests for item merge semantics: product-parented item
      edits preserve product/stage fields, activity-parented item edits preserve
      `activityId` and clear product/stage fields, priority rank survives, and
      paused reason clears when status leaves paused.
- [ ] 1.2 Add or confirm tests for risk and decision merge semantics:
      activity-parented rows keep `activityId`, product-parented rows keep
      product/stage fields, existing rows preserve fields not surfaced in the
      presentation model, and `foreign: true` rows are stripped.
- [ ] 1.3 Add or confirm tests for product/activity draft updates and item move
      actions: product traffic derives from owned stage statuses, activity
      status updates by activity id, and move/complete/pause commands patch the
      existing row identity.
- [ ] 1.4 Add or confirm quick-add coverage: blocker quick-add opens a blocked
      risk prefill, activity alarm raise routes to activity-parented risk
      prefill, and quick-add item save merges into the selected week then
      closes the host.

## 2. Web implementation

- [ ] 2.1 Add feature-local pure merge helpers for products, activity status,
      items, risks, decisions, and item patches without introducing new API,
      schema, route, or UI-string behavior.
- [ ] 2.2 Add `use-lead-form-draft-merges.ts` under
      `apps/web/src/features/report-sections/ui/`, owning the draft edit
      handlers, add signals, risk prefill, quick-add item state, and a lazy
      loaded-context ref callback.
- [ ] 2.3 Rewire `lead-form.tsx` to consume the draft-merge boundary while
      keeping route/query/session/visibility setup, draft orchestration,
      write-action orchestration, and rendering behavior unchanged.
- [ ] 2.4 Keep all new files under the 250-line max-lines standard and do not
      add or expand any ESLint exemption.

## 3. Planning and verification

- [ ] 3.1 Update `openspec/specs/architecture-refactor-backlog/spec.md` and the
      matching change delta with actual post-slice `lead-form.tsx` LOC evidence.
- [ ] 3.2 Run focused tests:
      `cd apps/web && pnpm exec vitest run src/features/report-sections/ui/lead-form.test.tsx src/features/report-sections/ui/lead-form-visibility.test.tsx src/hooks/use-lead-form-autosave.test.tsx`.
- [ ] 3.3 Run scoped lint on changed web files with `--max-warnings 0`.
- [ ] 3.4 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`,
      `git diff --check`, `openspec validate
refactor-lead-form-draft-merges --strict`, and `openspec validate --all
--strict`.
