# Tasks

## 1. Web dialog

- [x] 1.1 Extend the existing dialog tests for canonical padded/non-BMP boundaries, retained over-limit input with correction, and padded server rejection; verify RED against unchanged dialog source.
- [x] 1.2 Remove the raw cap and classify canonical over-limit failures without changing draft state; verify both dialog test owners pass with one Vitest worker.

## 2. Planning and focused verification

- [x] 2.1 Validate this OpenSpec change with `openspec validate request-changes-trimmed-input-policy --strict` and keep native evidence explicitly separate.
- [ ] 2.2 Run changed-file `pnpm exec prettier --check` in batches of at most three files (Waiting: final check cancelled after more than 20 minutes queued on the shared semaphore). Changed-source `pnpm exec eslint --max-warnings 0 --concurrency off`, `pnpm --filter @weeklyreport/web typecheck`, and `git diff --check` passed; exact commands and exits are in the external RESULT handoff.

## Workflow follow-up

- Parent performs independent review and full integration gates before publication; worker push is forbidden.
- Native typing/paste with attempted-content versus field-readback, AT and real server/database rejection remain Waiting under TASK-503.72; do not close the whole card on jsdom evidence.
- Parent synchronizes the durable spec and archives only this change after acceptance; no overlap with lead-fast-entry.
