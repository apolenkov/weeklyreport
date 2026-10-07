## 1. Workspace dependencies and tools

- [x] 1.1 Inventory stable published versions and upstream migration guidance.
- [x] 1.2 Update compatible patch/minor dependencies and verify the workspace.
- [x] 1.3 Verify axe-core 4.14.0 on the real app; retain 4.13.0 after its new rule fails, with evidence and a scoped Renovate ignore.
- [x] 1.4 Upgrade Vitest and coverage together, verifying complete unit suites.
- [ ] 1.5 Upgrade the lint plugin major with the full lint gate.
- [ ] 1.6 Verify transitive overrides and encode proven compatibility restrictions.
- [ ] 1.7 Upgrade pnpm separately with frozen install and workspace gates.

## 2. API and Web SDKs

- [x] 2.1 Upgrade dotenv with environment/bootstrap checks.
- [ ] 2.2 Upgrade NestJS core/platform/testing and verify API behavior.
- [ ] 2.3 Upgrade nestjs-cls and verify context propagation consumers.
- [ ] 2.4 Upgrade the coordinated OpenTelemetry ecosystem.
- [ ] 2.5 Upgrade Sentry SDKs and public integration imports.

## 3. Runtime, CI, and delivery

- [ ] 3.1 Verify current runtime/container releases and update compatible images.
- [ ] 3.2 Verify PostgreSQL and Redis major upgrades or record failed checks.
- [ ] 3.3 Run pnpm format:check, pnpm lint, pnpm typecheck, pnpm spec:check,
      pnpm test, and pnpm build against the final commit.
- [ ] 3.4 Run guarded reset and explicit seed, API integration, scoped coverage,
      and pnpm test:e2e with Redis DB 15.
- [ ] 3.5 Review, push, open one GitLab MR, deliver handoff and backlog notes,
      and remove task-owned runtime/worktree state.
