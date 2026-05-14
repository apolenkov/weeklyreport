# Technology Stack

**Analysis Date:** 2026-04-24

## Languages

**Primary:**

- TypeScript ^5.8.3 (strict mode) - Used across all workspaces (frontend, backend, shared packages)

**Secondary:**

- SQL (PostgreSQL) - Prisma schema + raw queries in health checks

## Runtime

**Environment:**

- Node.js 20.x LTS (Docker images use `node:20-alpine`; `engines` field requires `>=20.19.0`)
- Local dev machine runs Node v25.9.0; production containers pin to 20.x

**Package Manager:**

- pnpm 10.11.0 (pinned via `"packageManager": "pnpm@10.11.0"` in root `package.json`)
- Lockfile: gitignored (`pnpm-lock.yaml` is not committed). `Dockerfile.web` uses `--no-frozen-lockfile`; `Dockerfile.api` uses `--frozen-lockfile` (relies on lockfile generated inside the Docker build context)
- Workspace config: `pnpm-workspace.yaml` defines `apps/*` and `packages/*`
- `onlyBuiltDependencies` whitelist in both `package.json` and `pnpm-workspace.yaml`: prisma, @prisma/client, @nestjs/core, playwright, esbuild, msw, sharp

## Monorepo

**Orchestrator:**

- Turborepo ^2.5.6
- Config: `turbo.json` at root
- Tasks: `build`, `dev`, `lint`, `typecheck`, `test`
- Build outputs: `.next/**`, `dist/**`, `coverage/**`
- Dev tasks are `persistent: true`, `cache: false`

**Workspaces:**

- `apps/web` (`@customreport/web`) - Next.js frontend
- `apps/api` (`@customreport/api`) - NestJS backend
- `packages/shared` (`@customreport/shared`) - Zod schemas + shared types
- `packages/ui` (`@customreport/ui`) - shadcn/ui component library

## Frameworks

**Core:**

- Next.js ^16.2.3 - React framework with App Router, standalone output, React Compiler enabled (`reactCompiler: true`)
- NestJS ^11.1.0 - Backend HTTP framework with dependency injection, decorator-based modules
- React ^19.2.5 - UI library (concurrent features, React Compiler stable)
- Express ^5.2.1 - HTTP platform under NestJS (`@nestjs/platform-express`)

**API:**

- tRPC ^11.16.0 - Type-safe RPC between frontend and backend
  - Server: `@trpc/server` (backend)
  - Client: `@trpc/client` + `@trpc/react-query` (frontend)
  - Transformer: superjson ^2.2.6 (both sides)
  - Mounted as Express middleware at `/trpc` in `apps/api/src/main.ts`
- TanStack React Query ^5.97.0 - Server state management (via tRPC integration)

**ORM:**

- Prisma ^7.0.0 (client + CLI)
  - Uses TypeScript-based engine (Rust-free via `@prisma/adapter-pg` + `pg` pool)
  - Schema: `prisma/schema.prisma`
  - Config: `prisma.config.ts` (Prisma 7-style config with `defineConfig`)
  - Seed: `prisma/seed.ts` (runs via `npx tsx prisma/seed.ts`)
  - Adapter: `@prisma/adapter-pg` ^7.7.0 with `pg` ^8.20.0 (native PostgreSQL driver, connection pooling via `pg.Pool`)

**Validation:**

- Zod ^4.1.0 - Runtime schema validation, shared between frontend and backend via `@customreport/shared`

**Testing:**

- Vitest ^4.1.4 - Unit tests (root devDependency, used by all workspaces)
- Playwright ^1.59.1 (API, for PDF gen) + @playwright/test ^1.55.0 (web, for E2E)
- @testing-library/react ^16.3.0 - React component testing
- @testing-library/jest-dom ^6.6.3 - DOM assertion matchers
- @testing-library/user-event ^14.6.1 - User interaction simulation
- @axe-core/playwright ^4.11.1 - Accessibility testing
- msw ^2.13.0 - API mocking for frontend tests
- jsdom ^26.1.0 - DOM environment for Vitest (web workspace)

**Build/Dev:**

- Turbopack (Next.js default in v16) with `turbopack.root` set to monorepo root in `next.config.ts`
- SWC via `@swc-node/register` ^1.11.1 + `@swc/core` ^1.15.24 - API dev-time transpilation (`node --import @swc-node/register/esm-register`)
- `tsc` - API production build (`tsc -p tsconfig.json` outputs to `dist/`)
- PostCSS ^8.5.9 with `@tailwindcss/postcss` ^4.2.2 - CSS processing for web

## UI Libraries

**Component System:**

- shadcn/ui via `@customreport/ui` package (Radix UI primitives)
  - radix-ui ^1.4.3 (unified package)
  - class-variance-authority ^0.7.1 (variant management)
  - clsx ^2.1.1 + tailwind-merge ^3.5.0 (className utilities)
  - tw-animate-css ^1.4.0 (animation utilities)

**Styling:**

- Tailwind CSS ^4.2.2 (v4, CSS-first config via `@theme` directive)
- PostCSS config: `apps/web/postcss.config.mjs` with `@tailwindcss/postcss` plugin
- Styles: `packages/ui/src/styles/globals.css`, `packages/ui/src/styles/traffic-lights.css`

**Icons:**

- lucide-react ^0.500.0 (both web and ui packages)

**Font:**

- geist ^1.7.0 (Vercel's Geist font family)

**Theming:**

- next-themes ^0.4.6 (dark/light mode support)

**Notifications:**

- sonner ^2.0.7 (toast notifications)

## Key Dependencies

**Critical (Backend):**

- `@nestjs/bullmq` ^11.0.4 - Job queue integration with NestJS DI
- `bullmq` ^5.73.4 - Redis-backed job queue (PDF export + email reminders)
- `ioredis` ^5.10.1 - Redis client (used by health checks)
- `nodemailer` ^8.0.5 - SMTP email sending
- `playwright` ^1.59.1 - PDF generation (Chromium headless)
- `helmet` ^8.0.0 - Security headers (CORS, CSP, HSTS)
- `cookie-parser` ^1.4.7 - Cookie parsing middleware
- `@nestjs/terminus` ^11.1.1 - Health check framework
- `prom-client` ^15.1.3 - Prometheus metrics
- `reflect-metadata` ^0.2.2 - Required for NestJS decorators
- `rxjs` ^7.8.1 - Required by NestJS core

**Critical (Auth):**

- `@node-saml/passport-saml` ^5.1.0 - SAML 2.0 strategy for Keycloak SSO
- `passport` ^0.7.0 - Authentication middleware
- `passport-jwt` ^4.0.1 - JWT extraction/validation strategy
- `jsonwebtoken` ^9.0.2 - JWT signing and verification (HS256, 1h expiry)
- `cookie` ^1.0.2 - Cookie serialization

**Critical (Frontend):**

- `@tanstack/react-query` ^5.97.0 - Server state management
- `superjson` ^2.2.6 - Date/BigInt serialization for tRPC transport

**Monitoring UI:**

- `@bull-board/api` ^6.21.0 + `@bull-board/express` ^6.21.0 - BullMQ dashboard at `/admin/queues`

## TypeScript Configuration

**Base config** (`tsconfig.base.json`):

- Target: ES2022
- Module: ESNext, moduleResolution: Bundler
- Strict mode: `true` (with `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`)
- `verbatimModuleSyntax: true`, `isolatedModules: true`
- Path aliases: `@customreport/shared` -> `packages/shared/src`, `@customreport/ui` -> `packages/ui/src`

**API config** (`apps/api/tsconfig.json`):

- Extends base, adds `experimentalDecorators: true`, `emitDecoratorMetadata: true` (for NestJS)
- Outputs to `dist/`
- ESM modules (`"type": "module"` in package.json)

**Web config** (`apps/web/tsconfig.json`):

- Extends base, adds `jsx: "preserve"`, `incremental: true`
- Next.js plugin enabled
- Additional alias: `@customreport/api/*` -> `apps/api/src/*` (for importing tRPC router types)

## Linting & Formatting

**ESLint:**

- ESLint ^10.2.0 with flat config (`eslint.config.ts`)
- `typescript-eslint` ^8.58.1 strict ruleset
- `eslint-plugin-react-hooks` ^5.2.0
- `eslint-plugin-react-compiler` 19.1.0-rc.2
- Key rules: `no-explicit-any: error`, `no-floating-promises: error`, `react-compiler/react-compiler: error`

**Prettier:**

- Referenced in CLAUDE.md but no `.prettierrc` config file detected in repo root

## Docker

**API image** (`Dockerfile.api`):

- Multi-stage build (5 stages): base -> pruner -> installer -> builder -> runner
- Base: `node:20-alpine` for build stages
- Runner: `mcr.microsoft.com/playwright:v1.59.0-noble` (~1.4GB, includes Chromium for PDF generation)
- Uses `turbo prune @customreport/api --docker` for monorepo pruning
- Generates Prisma client during build
- Prunes devDeps with `pnpm prune --prod`
- Exposes port 3001
- Creates `/app/data/pdfs` directory for PDF storage

**Web image** (`Dockerfile.web`):

- Multi-stage build (5 stages): base -> pruner -> installer -> builder -> runner
- Runner: `node:20-alpine` (~150MB)
- Uses Next.js standalone output (`output: 'standalone'` in `next.config.ts`)
- Copies `.next/standalone`, `.next/static`, and `public`
- Exposes port 3000

## Scripts

**Root (`package.json`):**

- `dev` - `turbo run dev --parallel` (starts both web + api)
- `build` - `turbo run build`
- `lint` - `turbo run lint`
- `typecheck` - `turbo run typecheck`
- `test` - `turbo run test`
- `test:e2e` - `playwright test --config=apps/web/playwright.config.ts`

**API (`apps/api/package.json`):**

- `dev` - `node --env-file=../../.env --import @swc-node/register/esm-register --watch src/main.ts`
- `build` - `tsc -p tsconfig.json`
- `test` - `vitest run --exclude '**/*.integration.test.ts'`
- `test:integration` - `vitest run` with explicit integration test file list

**Web (`apps/web/package.json`):**

- `dev` - `next dev`
- `build` - `next build`
- `test` - `vitest run`
- `test:e2e` - `playwright test`

## Platform Requirements

**Development:**

- Node.js >= 20.19.0
- pnpm 10.11.0 (via corepack)
- PostgreSQL 15+ (local or Docker)
- Redis 7.x (local or Docker)
- `.env` file at monorepo root (loaded via `--env-file` flag and `dotenv/config`)

**Production:**

- Docker containers (API + Web)
- PostgreSQL 15+ database
- Redis 7.x instance
- Keycloak IdP with SAML 2.0 realm configured
- SMTP server (optional, falls back to jsonTransport in dev)

---

_Stack analysis: 2026-04-24_
