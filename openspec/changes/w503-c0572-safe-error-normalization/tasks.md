# Tasks

## 1. API

- [x] 1.1 Extend existing final and intermediate SMTP failure tests with
      unstringifiable rejections; preserve the baseline RED receipt showing
      skipped lifecycle calls or a replaced rejection.
- [x] 1.2 Guard shared failure normalization with its existing fallback and
      verify the worker regression passes, preserving the original rejection
      and existing successful message conversions.

## 2. Integration checks and handoff

- [x] 2.1 Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
      `pnpm build`, and `pnpm spec:check` on the reviewed tree; retain commands,
      exit codes and SHA bindings in the external wave report.
- [x] 2.2 Commit with normal hooks and deliver the exact SHA, diff and per-ID
      evidence to the leading session for independent review and integration.
