# Tasks

Gates after the batch: `pnpm typecheck && pnpm lint && pnpm test`.

(Single-pass: bump every package below, then run the gate ONCE. Do not gate
per-package. All 21 items are minor/patch; the 8 majors are excluded and live
in their own isolated changes.)

## Coupled groups (must move in lockstep)

- [ ] `@sentry/nestjs` 10.53.1 -> 10.55.0 (`apps/api/package.json`)
- [ ] `@sentry/node` 10.53.1 -> 10.55.0 (`apps/api/package.json`)
- [ ] `@sentry/nextjs` 10.53.1 -> 10.55.0 (`apps/web/package.json`)
- [ ] `@typescript-eslint/eslint-plugin` 8.59.4 -> 8.60.0 (root `package.json`)
- [ ] `@typescript-eslint/parser` 8.59.4 -> 8.60.0 (root `package.json`)
- [ ] `typescript-eslint` 8.59.4 -> 8.60.0 (root `package.json`)
- [ ] `@nestjs/common` 11.1.23 -> 11.1.24 (`apps/api/package.json`)
- [ ] `@nestjs/core` 11.1.23 -> 11.1.24 (`apps/api/package.json`)
- [ ] `@nestjs/platform-express` 11.1.23 -> 11.1.24 (`apps/api/package.json`)
- [ ] `@commitlint/cli` 21.0.1 -> 21.0.2 (root `package.json`)
- [ ] `@commitlint/config-conventional` 21.0.1 -> 21.0.2 (root `package.json`)

## Standalone API deps

- [ ] `bullmq` 5.77.0 -> 5.77.6 (`apps/api/package.json`)
- [ ] `nestjs-cls` 6.2.0 -> 6.2.1 (`apps/api/package.json`)
- [ ] `nodemailer` 8.0.7 -> 8.0.10 (`apps/api/package.json`)
- [ ] `helmet` 8.1.0 -> 8.2.0 (`apps/api/package.json`)
- [ ] `ioredis` 5.10.1 -> 5.11.0 (`apps/api/package.json`)
- [ ] `@swc/core` 1.15.33 -> 1.15.40 (`apps/api/package.json`)

## Standalone web deps

- [ ] `@tanstack/react-query` 5.100.11 -> 5.100.14 (`apps/web/package.json`)
- [ ] `web-vitals` 5.2.0 -> 5.3.0 (`apps/web/package.json`)

## Standalone root deps

- [ ] `turbo` 2.9.14 -> 2.9.16 (root `package.json`)

## Elevated-risk (pre-1.0, treat with care)

- [ ] `@anthropic-ai/sdk` 0.98.0 -> 0.100.1 (`apps/api/package.json`).
      Pre-1.0: a minor can break. Confirm the AI-module facade
      (`apps/api/src/modules/ai/`) compiles and its tests
      (incl. `golden-set.eval.test.ts`) stay green.

## Gates (run once, after all bumps)

- [ ] `pnpm install` to refresh `pnpm-lock.yaml`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm build`
