## 1. Web characterization

- [x] 1.1 Add focused tests for cross-author loaded display gating: Everyone
      hydrated on an own deck includes foreign read-only item/risk/decision
      rows, while Mine, pre-hydration, and foreign-deck contexts exclude them.
- [x] 1.2 Add focused tests for own-only derivations: own item/risk/decision
      arrays stay free of foreign rows, own priority ranks exclude foreign
      records, and submit/write inputs can read the own arrays unchanged.
- [x] 1.3 Add focused tests for published-lineage and period affordances:
      item/decision lock sets derive from raw stable IDs, fill-from locks when
      published item or decision lineage exists, selected archived periods stay
      visible, and read-only derives from mapped read-only or submitted state.
- [x] 1.4 Add focused tests for unified activity and activity alarm derivations:
      activity alarm floors derive from live own risks, own unified entries use
      raw workflow fields, and foreign unified entries use presentation status.

## 2. Web implementation

- [x] 2.1 Add a feature-local pure loaded-view-model boundary under
      `apps/web/src/features/report-sections/ui/` that accepts already-loaded
      draft/query/display inputs and returns the derived display model without
      owning React state, effects, routes, or queries.
- [x] 2.2 Rewire `lead-form.tsx` to consume the loaded view model while keeping
      route/query/session/visibility setup, draft orchestration, write-action
      orchestration, draft-merge orchestration, and rendering behavior
      unchanged.
- [x] 2.3 Keep all new files under the 250-line max-lines standard and do not
      add or expand any ESLint exemption.

## 3. Planning and verification

- [x] 3.1 Update `openspec/specs/architecture-refactor-backlog/spec.md` and the
      matching change delta with actual post-slice `lead-form.tsx` LOC evidence.
- [x] 3.2 Run focused tests:
      `cd apps/web && pnpm exec vitest run src/features/report-sections/ui/lead-form.test.tsx src/features/report-sections/ui/lead-form-visibility.test.tsx src/hooks/use-lead-form-autosave.test.tsx`.
- [x] 3.3 Run scoped lint on changed web files with `--max-warnings 0`.
- [x] 3.4 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`,
      `git diff --check`, `openspec validate
refactor-lead-form-loaded-view-model --strict`, and `openspec validate --all
--strict`.
