## 1. Web Data Boundary

- [x] 1.1 Expose the `leadForm.byPeriod` terminal error, retry-in-flight state, and existing refetch operation through the feature-local lead-form data view.
- [x] 1.2 Add focused hook tests for primary-read failure and retry state without weakening existing query enablement, redirect, purge, or error-policy behavior.

## 2. Web Recovery Surface

- [x] 2.1 Add an accessible lead-form terminal error state with clear guidance and a `Retry` action that cannot issue duplicate in-flight retries.
- [x] 2.2 Render the recovery state before draft derivation so stale editable content is absent during a primary-read error, and restore the loaded form only after a successful retry.
- [x] 2.3 Add focused component tests for failure, retry success, repeated failure, disabled retry while fetching, existing toast reporting, and absence of editable draft content in the error state.

## 3. Verification

- [x] 3.1 Run focused Vitest coverage, `pnpm --filter @customreport/web typecheck`, scoped ESLint, scoped Prettier, and `git diff --check`.
- [x] 3.2 Run `openspec validate fix-lead-form-load-recovery --strict`.
- [x] 3.3 Capture and manually review source-bound R41 browser evidence with zero unexpected console, page, or request failures.
- [x] 3.4 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm format:check` before marking the change complete.
