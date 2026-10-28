# Tasks

## 1. Tests (RED)

- [x] 1.1 Add failing unit tests in `apps/web/src/features/review/ui/submission-filter.test.tsx` verifying `DraftHiddenSignal` renders with `role="status"`, `aria-live="polite"`, and `Show all` button has `aria-label="Show all sections including drafts"`. Verify tests fail (RED).

## 2. Implementation (GREEN)

- [x] 2.1 Update `DraftHiddenSignal` in `apps/web/src/features/review/ui/submission-filter.tsx` with `role="status"`, `aria-live="polite"`, and `aria-label="Show all sections including drafts"` on the "Show all" button. Verify unit tests pass (GREEN).

## 3. Verification & Quality Gates

- [x] 3.1 Run repository quality gates: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm spec:check`.
