## 1. Workspace dependencies and tools

- [x] 1.1 Inventory stable published versions and upstream migration guidance.
- [x] 1.2 Update compatible patch/minor dependencies and verify the workspace.
- [x] 1.3 Upgrade axe-core 4.14.0, repair NavBrand label-in-name, add regression coverage, and verify the real app without a Renovate exception.
- [x] 1.4 Upgrade Vitest and coverage together, verifying complete unit suites.
- [x] 1.5 Upgrade the lint plugin major with the full lint gate.
- [x] 1.6 Verify transitive overrides and encode proven compatibility restrictions.
- [x] 1.7 Upgrade pnpm separately with frozen install and workspace gates.
- [ ] 1.8 Verify stable React Hooks compiler diagnostics and remove the RC-only plugin.
- [ ] 1.9 Upgrade Radix to 1.7.0 using native dialog IDs; prove ARIA IDREF and focus regressions.

## 2. API and Web SDKs

- [x] 2.1 Upgrade dotenv with environment/bootstrap checks.
- [x] 2.2 Upgrade NestJS core/platform/testing and verify API behavior.
- [x] 2.3 Upgrade nestjs-cls and verify context propagation consumers.
- [x] 2.4 Upgrade the coordinated OpenTelemetry ecosystem.
- [x] 2.5 Upgrade Sentry SDKs and public integration imports.

## 3. Runtime, CI, and delivery

- [ ] 3.1 Refresh runtime/container releases and verify the current upgraded images.
- [ ] 3.2 Verify PostgreSQL and Redis major upgrades or record current failed checks.
- [ ] 3.3 Run pnpm format:check, pnpm lint, pnpm typecheck, pnpm spec:check,
      pnpm test, and pnpm build against the final commit.
- [ ] 3.4 Run guarded reset and explicit seed, API integration, scoped coverage,
      and pnpm test:e2e with Redis DB 15.
- [ ] 3.5 Review, push, open one GitLab MR, deliver handoff and backlog notes,
      and remove task-owned runtime/worktree state.
