## 1. Web characterization

- [ ] 1.1 Confirm the existing `LeadForm` tests cover submit success, submit
      stale-version conflict, fill-from stale-version conflict, revoke success,
      reopen request success/error state, and current-version propagation into
      submit/fill-from.
- [ ] 1.2 Add any missing characterization test before moving code; the test
      must fail on a changed mutation payload, missed invalidation, stale
      version, missing dialog state transition, or wrong toast path.

## 2. Web implementation

- [ ] 2.1 Add `use-lead-form-write-actions.ts` under
      `apps/web/src/features/report-sections/ui/`, owning submit/revoke/reopen/
      fill-from mutations and their dialog/error state.
- [ ] 2.2 Rewire `lead-form.tsx` to consume the hook while leaving route/query
      setup, visibility gates, draft orchestration, record merge handlers,
      quick-add state, and rendering behavior unchanged.
- [ ] 2.3 Keep submit and fill-from reading the draft hook's
      `versionRef.current` at command time, and keep stale-version conflicts on
      the shared conflict handler.
- [ ] 2.4 Keep successful write invalidations behavior-compatible:
      lead-form/history for submit, lead-form/dashboard/history for revoke,
      lead-form for reopen request and fill-from.

## 3. Planning and verification

- [ ] 3.1 Update `openspec/specs/architecture-refactor-backlog/spec.md` and the
      matching change delta during implementation/archive with this third
      lead-form slice and actual post-slice LOC evidence.
- [ ] 3.2 Run focused tests:
      `cd apps/web && pnpm exec vitest run src/features/report-sections/ui/lead-form.test.tsx src/features/report-sections/ui/lead-form-visibility.test.tsx src/hooks/use-lead-form-autosave.test.tsx`.
- [ ] 3.3 Run scoped lint:
      `pnpm exec eslint apps/web/src/features/report-sections/ui/lead-form.tsx apps/web/src/features/report-sections/ui/use-lead-form-write-actions.ts --max-warnings 0`.
- [ ] 3.4 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and
      `openspec validate refactor-lead-form-write-actions --strict`.
