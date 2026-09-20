# Tasks

## 1. Dependency policy

- [x] 1.1 Add the smallest repository-safety assertion that rejects `patchedDependencies` and tracked third-party patch files; verify it fails against the baseline.
- [x] 1.2 Remove all four patch files and declarations, select compatible published dependency versions/ranges, regenerate `pnpm-lock.yaml`, and verify `pnpm install --frozen-lockfile` plus the repository-safety assertion pass.

## 2. API and web compatibility

- [x] 2.1 Verify the stock SAML/XML dependency graph with `pnpm --filter @customreport/api test -- src/modules/auth/saml.samlify.test.ts` and any existing XML-security contract tests discovered by the implementation inventory.
- [x] 2.2 Remove only Agentation patch-specific bundle tests while retaining public widget, authenticated feedback, persistence, and MCP contract coverage; verify the targeted web and API Agentation suites pass against stock `agentation@3.0.2`.

## 3. Planning and acceptance

- [x] 3.1 Reconcile the durable `authenticated-product-feedback` spec with the approved stock-package behavior and verify `pnpm spec:check` passes.
- [ ] 3.2 Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`; record exact results and commit only task-owned files for TASK-050.
