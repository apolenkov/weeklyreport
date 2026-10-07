## 1. Cleanup errors

- [x] 1.1 Add failing transport and filesystem regressions; focused Vitest exits 1 before production changes.
- [x] 1.2 Preserve shutdown causes and all disposal attempts; focused Vitest exits 0 (4 tests).
- [x] 1.3 Verify pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build and pnpm spec:check; all exit 0. Build uses API_URL=http://127.0.0.1:50123. Logs: ~/work/handoffs/287-crawl/cleanup/.

## Workflow follow-up

- Push the group branch and open its GitLab merge request; merging requires the owner.
