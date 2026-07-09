## 1. Web characterization

- [x] 1.1 Confirm the existing `LeadForm` tests cover autosave-version bump to
      submit, refetch-only version bump to the next write, conflict refetch/toast,
      read-only autosave disablement, and stableId draft payload round-trip.
- [x] 1.2 Add any missing characterization test before moving code; the test
      must fail against a stale-version or draft-reseed regression, not only render
      the component.
  - Existing coverage already pinned autosave bump to submit, refetch-only
    version bump to next submit, submit/fillFrom conflict handling, read-only
    autosave disablement, and stableId payload round-trip. Added
    `same-payload refetch preserves unsaved local draft edits`; verified before
    extraction with `cd apps/web && pnpm exec vitest run
src/features/report-sections/ui/lead-form.test.tsx` (36 tests passed).

## 2. Web implementation

- [x] 2.1 Add `use-lead-form-draft-orchestration.ts` under
      `apps/web/src/features/report-sections/ui/`, owning draft mirror reseed,
      stable draft payload, initial autosave baseline, submitted state,
      optimistic-lock version state/ref, and stale-version conflict handling.
- [x] 2.2 Rewire `lead-form.tsx` to consume the hook while leaving route/query
      setup, foreign-content visibility, record merge handlers, submit/revoke/
      reopen/fill-from mutations, and rendering behavior unchanged.
- [x] 2.3 Keep submit and fill-from reading the hook-owned synchronous
      `versionRef.current`, and keep autosave using the hook-owned
      `setVersionSafe`/conflict handler.
- [x] 2.4 Add focused hook or component tests that prove the new boundary
      satisfies the `lead-form-draft-orchestration` scenarios.
  - Added `useLeadFormDraftOrchestration`, rewired `LeadForm` to consume it, and
    kept submit/fillFrom on the hook-owned `versionRef.current`. The new
    component characterization test covers same-payload refetch preservation;
    focused suite passed after extraction.

## 3. Planning and verification

- [x] 3.1 Update `openspec/specs/architecture-refactor-backlog/spec.md` during
      archive so the second lead-form slice and post-slice LOC evidence are durable.
  - Updated durable backlog and matching delta spec with post-slice `lead-form`
    evidence: 2036 LOC after extraction; 2117 LOC when the slice started.
- [x] 3.2 Run focused tests:
      `cd apps/web && pnpm exec vitest run src/features/report-sections/ui/lead-form.test.tsx src/features/report-sections/ui/lead-form-visibility.test.tsx src/hooks/use-lead-form-autosave.test.tsx`.
  - Passed: 3 files / 68 tests.
- [x] 3.3 Run scoped lint:
      `pnpm exec eslint apps/web/src/features/report-sections/ui/lead-form.tsx apps/web/src/features/report-sections/ui/use-lead-form-draft-orchestration.ts --max-warnings 0`.
  - Passed with `--max-warnings 0`.
- [x] 3.4 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and
      `openspec validate refactor-lead-form-draft-orchestration --strict`.
  - Passed `pnpm typecheck`, `pnpm lint`, `pnpm test` (158 files / 1578 tests),
    and `openspec validate refactor-lead-form-draft-orchestration --strict`.
