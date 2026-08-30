## 1. API Container Toolchain

- [x] 1.1 Replace post-install Prisma, Turbo, Playwright, and migration-runtime Pnpm wrappers in `Dockerfile.api` with their installed local binaries, scope dependency-preflight suppression to the post-install layer, and verify the API builder target.

## 2. Web Container Toolchain

- [x] 2.1 Replace the post-install Turbo wrapper in `Dockerfile.web` with its installed local binary, scope dependency-preflight suppression to the post-install layer, and verify the Web builder target.

## 3. Regression Gate

- [x] 3.1 Allowlist the builder-scoped setting in Turbo's strict environment, extend `scripts/gates/operations/prod-compose-gate.test.ts` to prove it does not leak into dev targets, require all Dockerfile and Compose direct tool invocations, reject their late Pnpm equivalents, and verify with `node --test scripts/gates/operations/prod-compose-gate.test.ts`.

## 4. Verification

- [x] 4.1 Run `pnpm exec openspec validate stabilize-pnpm11-docker-tool-invocation --strict`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and the production Docker build with exact revision-label checks; record every command as PASS before archive and final closeout.
