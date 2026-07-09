## 1. Web characterization

- [ ] 1.1 Confirm the existing `LeadForm` tests cover autosave-version bump to
      submit, refetch-only version bump to the next write, conflict refetch/toast,
      read-only autosave disablement, and stableId draft payload round-trip.
- [ ] 1.2 Add any missing characterization test before moving code; the test
      must fail against a stale-version or draft-reseed regression, not only render
      the component.

## 2. Web implementation

- [ ] 2.1 Add `use-lead-form-draft-orchestration.ts` under
      `apps/web/src/features/report-sections/ui/`, owning draft mirror reseed,
      stable draft payload, initial autosave baseline, submitted state,
      optimistic-lock version state/ref, and stale-version conflict handling.
- [ ] 2.2 Rewire `lead-form.tsx` to consume the hook while leaving route/query
      setup, foreign-content visibility, record merge handlers, submit/revoke/
      reopen/fill-from mutations, and rendering behavior unchanged.
- [ ] 2.3 Keep submit and fill-from reading the hook-owned synchronous
      `versionRef.current`, and keep autosave using the hook-owned
      `setVersionSafe`/conflict handler.
- [ ] 2.4 Add focused hook or component tests that prove the new boundary
      satisfies the `lead-form-draft-orchestration` scenarios.

## 3. Planning and verification

- [ ] 3.1 Update `openspec/specs/architecture-refactor-backlog/spec.md` during
      archive so the second lead-form slice and post-slice LOC evidence are durable.
- [ ] 3.2 Run focused tests:
      `cd apps/web && pnpm exec vitest run src/features/report-sections/ui/lead-form.test.tsx src/features/report-sections/ui/lead-form-visibility.test.tsx src/hooks/use-lead-form-autosave.test.tsx`.
- [ ] 3.3 Run scoped lint:
      `pnpm exec eslint apps/web/src/features/report-sections/ui/lead-form.tsx apps/web/src/features/report-sections/ui/use-lead-form-draft-orchestration.ts --max-warnings 0`.
- [ ] 3.4 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and
      `openspec validate refactor-lead-form-draft-orchestration --strict`.
