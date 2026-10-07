## 1. Hung recovery

- [x] 1.1 Add regressions for lost completed presses and hidden recovery failures; focused Vitest exits 1 before changes.
- [x] 1.2 Preserve recovery evidence, error identity and conservative request accounting; focused Vitest exits 0 (4 regressions and 8 adjacent tests). Focused ESLint and scripts typecheck exit 0.
- [x] 1.3 Verify pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build and pnpm spec:check; final exits 0. Prisma generation fixes fresh-worktree type resolution; build uses API_URL=http://127.0.0.1:50123. Logs: ~/work/handoffs/287-crawl/recovery/.

## Workflow follow-up

- Push the branch and open its GitLab merge request. Merge requires the owner.
