# Plan 01-01 Summary

**Phase:** 01-core-report-capture  
**Plan:** 01-01  
**Status:** complete  
**Completed:** 2026-04-06

## Delivered

- Bootstrapped the monorepo workspace with root `package.json`,
  `pnpm-workspace.yaml`, `turbo.json`, and strict TypeScript base config.
- Added initial workspace packages:
  - `apps/web` — Next.js app shell
  - `apps/api` — NestJS-oriented API shell
  - `packages/shared` — shared auth/report schemas and tRPC contract layer
  - `packages/ui` — shared UI package shell
- Defined the initial Prisma 7 data model in `prisma/schema.prisma` covering:
  `User`, `Project`, `Report`, `ReportSection`, `ProjectStatus`, `Item`,
  `Risk`, `Decision`, and `Priority`, plus required enums.
- Added `prisma.config.ts` for Prisma 7 datasource configuration and a
  deterministic seed script with one head, six leads, one active report, seeded
  sections, statuses, and priorities.
- Added shared Zod schemas for:
  - roles and session payloads
  - draft save payloads
  - submit payloads
  - report-section read model
  - head submission dashboard rows
- Added a shared tRPC contract router with placeholder procedures for:
  `getActiveSection`, `saveDraft`, `submitSection`, and
  `getSubmissionDashboard`.
- Added the first auth/session foundation:
  - SAML strategy options and strategy factory
  - JWT signer/verifier and session cookie creation
  - role guard factory
  - web middleware/session helpers for protected route gating
  - dev-mode auth fallback path via `AUTH_DEV_MODE=true`

## Verification

- `DATABASE_URL="postgresql://postgres:postgres@localhost:5432/customreport_dev" npx --yes pnpm exec prisma validate --config=./prisma.config.ts` ✅
- `npx --yes pnpm --filter @customreport/shared test` ✅
- `npx --yes pnpm --filter @customreport/api test` ✅
- `npx --yes pnpm --filter @customreport/web test` ✅
- `npx --yes pnpm exec turbo run typecheck --filter=./packages/shared --filter=./apps/api --filter=./apps/web` ✅

## Important Decisions Locked In

- Prisma 7 uses `prisma.config.ts`; datasource URLs are not stored in
  `schema.prisma`.
- NestJS owns SAML callback handling and issues the app session.
- Next.js trusts only the app cookie/session shape and does not handle SAML
  directly.
- The auth foundation includes a dev-mode path so Phase 1 execution is not
  blocked by live Keycloak wiring during local development.

## Next Dependency for Phase 1

Plan `01-02` can now proceed against stable inputs from:

- `prisma/schema.prisma`
- `prisma/seed.ts`
- `packages/shared/src/schemas/auth.ts`
- `packages/shared/src/schemas/report.ts`
- `packages/shared/src/trpc/router.ts`
- `apps/api/src/modules/auth/*`
- `apps/web/src/server/auth/session.ts`

## Remaining Work Outside This Plan

- Real report-section service implementation is still pending in `01-02`.
- Real head review/dashboard implementation is still pending in `01-03`.
- Live Keycloak metadata/cert values are still environment setup, not yet
  production-wired.
