## 1. Web characterization

- [x] 1.1 Add or confirm tests for item merge semantics: product-parented item
      edits preserve product/stage fields, activity-parented item edits preserve
      `activityId` and clear product/stage fields, priority rank survives, and
      paused reason clears when status leaves paused.
  - Added `lead-form-draft-merge-helpers.test.ts`: item merge covers
    product-parented and activity-parented rows, priority rank, paused reason
    clearing, and own-only filtering.
- [x] 1.2 Add or confirm tests for risk and decision merge semantics:
      activity-parented rows keep `activityId`, product-parented rows keep
      product/stage fields, existing rows preserve fields not surfaced in the
      presentation model, and `foreign: true` rows are stripped.
  - Added helper coverage for risk/decision activity-parent XOR preservation,
    existing `stableId`/`resolvedAt` preservation, deadline conversion, and
    foreign-row stripping.
- [x] 1.3 Add or confirm tests for product/activity draft updates and item move
      actions: product traffic derives from owned stage statuses, activity
      status updates by activity id, and move/complete/pause commands patch the
      existing row identity.
  - Added helper coverage for product traffic aggregation, activity status
    update by id, and id-based item patch preserving published-lineage identity.
- [x] 1.4 Add or confirm quick-add coverage: blocker quick-add opens a blocked
      risk prefill, activity alarm raise routes to activity-parented risk
      prefill, and quick-add item save merges into the selected week then
      closes the host.
  - Added `use-lead-form-draft-merges.test.tsx`: quick-add blocker and activity
    raises use risk-prefill state, risk/decision quick-adds bump existing
    section signals, and quick-add item save merges into the selected week then
    closes the host.

## 2. Web implementation

- [x] 2.1 Add feature-local pure merge helpers for products, activity status,
      items, risks, decisions, and item patches without introducing new API,
      schema, route, or UI-string behavior.
  - Added `lead-form-draft-merge-helpers.ts` with pure draft merge helpers for
    product, activity, item, risk, decision, and item patch semantics.
- [x] 2.2 Add `use-lead-form-draft-merges.ts` under
      `apps/web/src/features/report-sections/ui/`, owning the draft edit
      handlers, add signals, risk prefill, quick-add item state, and a lazy
      loaded-context ref callback.
  - Added `useLeadFormDraftMerges` with draft edit handlers, add signals,
    `riskPrefill`, quick-add item state, and lazy loaded context reads.
- [x] 2.3 Rewire `lead-form.tsx` to consume the draft-merge boundary while
      keeping route/query/session/visibility setup, draft orchestration,
      write-action orchestration, and rendering behavior unchanged.
  - Rewired `LeadForm` to use `useLeadFormDraftMerges` handlers/signals via a
    lazy loaded-context ref; route/query/session/visibility setup, draft
    orchestration, write-action orchestration, and JSX behavior stay in
    `LeadForm`.
- [x] 2.4 Keep all new files under the 250-line max-lines standard and do not
      add or expand any ESLint exemption.
  - Verified new file line counts: draft merge helpers 243, hook 190, helper
    tests 234, hook tests 162, fixture 115. No ESLint exemption was added or
    expanded.

## 3. Planning and verification

- [x] 3.1 Update `openspec/specs/architecture-refactor-backlog/spec.md` and the
      matching change delta with actual post-slice `lead-form.tsx` LOC evidence.
  - Updated durable backlog and change delta with post-slice evidence:
    `lead-form.tsx` landed at 1485 LOC after starting this slice at 1858 LOC.
- [x] 3.2 Run focused tests:
      `cd apps/web && pnpm exec vitest run src/features/report-sections/ui/lead-form.test.tsx src/features/report-sections/ui/lead-form-visibility.test.tsx src/hooks/use-lead-form-autosave.test.tsx`.
  - Ran focused Vitest coverage including the three required existing files plus
    the new draft-merge helper/hook tests: 5 files, 78 tests passed.
- [x] 3.3 Run scoped lint on changed web files with `--max-warnings 0`.
  - Ran `eslint --max-warnings 0` on `lead-form.tsx`, the new draft-merge
    helper/hook files, their tests, and the fixture; clean.
- [x] 3.4 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`,
      `git diff --check`, `openspec validate
refactor-lead-form-draft-merges --strict`, and `openspec validate --all
--strict`.
  - Full gate green: `pnpm typecheck`, `pnpm lint`, `pnpm test`,
    `pnpm format:check`, `git diff --check`, `openspec validate
refactor-lead-form-draft-merges --strict`, and `openspec validate --all
--strict`.
