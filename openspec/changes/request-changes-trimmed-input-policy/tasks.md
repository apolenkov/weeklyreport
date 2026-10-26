# Tasks

## 1. Web dialog

- [x] 1.1 Extend the existing dialog tests for canonical padded/non-BMP boundaries, retained over-limit input with correction, and padded server rejection; verify RED against unchanged dialog source.
- [x] 1.2 Remove the raw cap and classify canonical over-limit failures without changing draft state; verify both dialog test owners pass with one Vitest worker.

## 2. Planning and focused verification

- [x] 2.1 Validate this OpenSpec change with `openspec validate request-changes-trimmed-input-policy --strict` and keep native evidence explicitly separate.
- [x] 2.2 Run changed-file `pnpm exec prettier --check` in batches of at most three files. Changed-source `pnpm exec eslint --max-warnings 0 --concurrency off`, `pnpm --filter @weeklyreport/web typecheck`, and `git diff --check` passed; exact commands and exits are in the external RESULT handoff.
