# Tasks

## 1. Client session state

- [x] 1.1 Add a RED test with a real QueryClient: the first auth.me fails, onlineManager goes offline before the retry, the query is pending/paused, and useSession() must report loading.
- [x] 1.2 Map `data === undefined` to `isLoading: true` in mapSessionState; keep the error branch; verify all session-provider tests.

## 2. Verification and delivery

- [ ] 2.1 Run pnpm format:check, pnpm lint, pnpm typecheck, pnpm test, pnpm build and pnpm spec:check on the reviewed tree; independent review.
- [ ] 2.2 Browser proof under a granted window (VERIFY-27 recipe): first auth.me fails (503/drop), then DevTools offline or a background tab before the 1 s retry; the page shows loading, not anonymous UI.
