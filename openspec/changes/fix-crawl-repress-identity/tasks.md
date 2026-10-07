## 1. Repeated control identity

- [x] 1.1 Reproduce replacement, empty-name and availability failures in named agent-browser; pre-fix browser suite exits 1.
- [x] 1.2 Require complete identity and availability at the event boundary; 8 real-browser regressions and 8 adjacent tests exit 0. Focused ESLint exits 0.
- [x] 1.3 Run pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build and pnpm spec:check; every exit 0. CRAWL_BROWSER_TESTS=1 enables actual browser tests in pnpm test. Build uses API_URL=http://127.0.0.1:50123. Logs: ~/work/handoffs/287-crawl/repress/.

## Workflow follow-up

- Sync the ui-crawl contract and open the group MR. Merge requires the owner.
