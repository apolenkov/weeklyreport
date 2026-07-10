## 1. Web characterization

- [ ] 1.1 Add `use-lead-form-data.test.tsx` (renderHook + mocked tRPC/router/
      query client) covering query enablement: byPeriod issues no request while
      the target report id is unresolved, the session is loading, or the role
      is head-like; targetReportId prefers the pinned route id over the active
      id.
- [ ] 1.2 Add focused tests for full-content gating: crossAuthorContent fires
      only when a report is known, visibility is hydrated, Everyone is
      selected, and the deck is the user's own.
- [ ] 1.3 Add focused tests for the purge guard: leaving Everyone removes the
      cached full-content query; any user-id or role change removes it
      unconditionally.
- [ ] 1.4 Add focused tests for redirects: bare route replaces to the canonical
      addressed URL (preserving slides mode) once the active id resolves;
      head-like sessions are replaced away to their own surface.

## 2. Web implementation

- [ ] 2.1 Add `use-lead-form-data.ts` under
      `apps/web/src/features/report-sections/ui/`: the six queries, enablement
      chains, record-visibility state and gating, both cache-purge effects
      (verbatim dependency arrays), both redirect effects, and the three query
      error handlers, returning a flat object matching the current local names.
      Fullscreen refs and `useFullscreen` stay in `LeadForm`.
- [ ] 2.2 Rewire `lead-form.tsx` to call the hook first and consume its return;
      keep the skeleton guard, loaded view-model call, render-phase ref
      assignments, hook order, and JSX unchanged.
- [ ] 2.3 Move the six SVG icon components to `lead-form-icons.tsx` and
      `RecordVisibilityToggle` to `record-visibility-toggle.tsx`, both
      unchanged; update imports.
- [ ] 2.4 Keep all new files under the 250-line max-lines standard (split the
      purge effects into a helper hook if needed) and do not add or expand any
      ESLint exemption.

## 3. Planning and verification

- [ ] 3.1 Update `openspec/specs/architecture-refactor-backlog/spec.md` and the
      matching change delta with actual post-slice `lead-form.tsx` LOC evidence.
- [ ] 3.2 Run focused tests:
      `cd apps/web && pnpm exec vitest run src/features/report-sections/ui/use-lead-form-data.test.tsx src/features/report-sections/ui/lead-form.test.tsx src/features/report-sections/ui/lead-form-visibility.test.tsx src/features/report-sections/ui/lead-form-addressable.test.tsx src/features/report-sections/ui/lead-form-viewmode.snapshot.test.tsx`.
- [ ] 3.3 Run scoped lint on changed web files with `--max-warnings 0`.
- [ ] 3.4 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format:check`,
      `git diff --check`, `openspec validate refactor-lead-form-data-loading
  --strict`, and `openspec validate --all --strict`.
