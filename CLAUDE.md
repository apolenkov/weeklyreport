<!-- GSD:project-start source:PROJECT.md -->

## Project

**CustomReport**

Веб-приложение для автоматизации сбора еженедельных статус-отчётов от тимлидов департамента CoreDev. Каждый из 6 лидов заполняет свою секцию через структурированную форму (светофоры проектов, текущая/следующая неделя, риски, решения для руководства). Система собирает всё в единый красивый отчёт с экспортом в PDF. Руководитель (head) ревьюит и публикует финальный отчёт для директора и других подразделений.

**Core Value:** Лиды заполняют свои секции независимо через удобную форму, система автоматически собирает единый отчёт — без конфликтов редактирования, с историей и аналитикой.

### Constraints

- **Tech stack**: Next.js + NestJS + TypeScript + PostgreSQL + Redis + BullMQ + Turborepo monorepo + pnpm
- **UI**: shadcn/ui + Tailwind CSS
- **API**: tRPC (type-safe, shared types между фронтом и бэком)
- **ORM**: Prisma
- **PDF**: Puppeteer/Playwright (рендер HTML в PDF)
- **Auth**: SAML via `@node-saml/passport-saml` + Keycloak IdP
- **Email**: SMTP корпоративный сервер
- **Validation**: Zod (shared schemas в пакете `packages/shared`)
- **Deploy**: Docker Compose (production), Kubernetes — позже
- **Quality gates**: TypeScript strict, ESLint + Prettier, Husky + lint-staged, Vitest (unit), Playwright (E2E)
- **Standards**: best practices April 2026, максимальная безопасность
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Executive Summary

- **Type safety end-to-end** (tRPC + Zod + TypeScript strict mode)
- **Performance at scale** (Turborepo caching, PgBouncer pooling, BullMQ async jobs)
- **Developer ergonomics** (AI-friendly shadcn/ui, tRPC type inference, NestJS decorators)
- **Enterprise requirements** (SAML SSO via Keycloak, PDF generation, async email jobs)

## Recommended Stack

### Frontend

| Technology       | Version                                       | Purpose               | Why                                                                                              |
| ---------------- | --------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| **Next.js**      | 16.x (16.2.3 installed)                       | React framework + SSR | Turbopack default, React Compiler stable, 'use cache' directive, proxy.ts replaces middleware.ts |
| **React**        | 19.x (19.2.5 installed)                       | UI library            | React Compiler stable, concurrent features stable, required by Next.js 16                        |
| **TypeScript**   | 5.8+ (5.9.3 installed, strict mode MANDATORY) | Language              | Strict mode enforced, TC39 decorators stable                                                     |
| **shadcn/ui**    | 4.x                                           | Component library     | Monorepo-aware CLI (v4), Tailwind v4 native, composable, AI-friendly, no prop-drilling hell      |
| **Tailwind CSS** | 4.x                                           | Styling               | @theme directive, CSS variables, faster compilation, RTL support                                 |
| **tRPC**         | 11.x                                          | Type-safe API client  | Zero-overhead abstraction, shared types with backend, automatic request validation via Zod       |

### Backend

| Technology     | Version                                       | Purpose              | Why                                                                                            |
| -------------- | --------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| **NestJS**     | 11.x                                          | HTTP + API framework | TC39 decorator support, @nestjs/bullmq native, dependency injection, JWT + SAML guards         |
| **Node.js**    | 20.x LTS (minimum) or 22.x LTS                | Runtime              | Production-stable, required by NestJS 11, long-term support                                    |
| **TypeScript** | 5.8+ (5.9.3 installed, strict mode MANDATORY) | Language             | [See Frontend]                                                                                 |
| **Prisma**     | 7.x (TypeScript-based, Rust-free)             | ORM                  | 3x faster queries vs Prisma 6, 90% smaller bundle (1.6MB vs 14MB), zero serialization overhead |
| **PostgreSQL** | 15+ (Ubuntu 22.04 LTS ships 14, use 15+)      | Database             | JSONB native, proven for 10K+ concurrent, pg_stat_statements for query analysis                |
| **PgBouncer**  | 1.22+                                         | Connection pooling   | Handles thousands of app connections with <100 real DB connections, transaction mode for OLTP  |
| **Redis**      | 7.x+                                          | Cache + job queue    | In-memory caching, BullMQ queue backend, session store                                         |
| **BullMQ**     | 5.x                                           | Job queue            | NestJS @nestjs/bullmq native, Redis-backed, supports retries/DLQ/priority                      |

### Shared Packages

| Technology      | Version             | Purpose            | Why                                                                                     |
| --------------- | ------------------- | ------------------ | --------------------------------------------------------------------------------------- |
| **Zod**         | 4.x+ (JIT compiler) | Runtime validation | Single source of truth for schemas, shared between frontend and backend, 100% type-safe |
| **Zod OpenAPI** | 0.15.x              | API documentation  | Auto-generate OpenAPI from Zod + tRPC (optional, for external consumers)                |

### Quality & Testing

| Technology                 | Version               | Purpose                 | Why                                                                                                      |
| -------------------------- | --------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| **Vitest**                 | 4.x (4.1.4 installed) | Unit tests              | Native TypeScript (via esbuild), monorepo projects support, zero Vite config overhead                    |
| **Playwright**             | 1.50+                 | E2E tests               | Headless browser testing, PDF/screenshot validation for reports, cross-browser (Chromium/Firefox/WebKit) |
| **@testing-library/react** | 16.x                  | React component testing | Recommended by shadcn/ui, accessibility-first queries                                                    |
| **@testing-library/dom**   | 10.x                  | DOM utilities           | Core testing utilities                                                                                   |

### PDF Generation

| Technology     | Version | Purpose        | Why                                                                          |
| -------------- | ------- | -------------- | ---------------------------------------------------------------------------- |
| **Playwright** | 1.50+   | PDF generation | 59–125KB files (smaller than Puppeteer), browser automation, works in NestJS |

- Smaller file sizes (59–125KB vs 197KB PDFs)
- Cross-browser abstraction (future-proof if rules change)
- Built-in E2E test integration (same library for tests and PDF generation)
- Active maintenance and TypeScript-first design

### Authentication

| Technology                   | Version                | Purpose                   | Why                                                                     |
| ---------------------------- | ---------------------- | ------------------------- | ----------------------------------------------------------------------- |
| **@node-saml/passport-saml** | 4.x+                   | SAML strategy             | Single Sign-On via Keycloak, enterprise requirement                     |
| **Keycloak**                 | 26.x (Apr 2026 stable) | Identity provider         | OpenID Connect + SAML 2.0, already in organization, manages users/roles |
| **Passport.js**              | 0.7.x                  | Authentication middleware | de facto standard in Node.js, integrates with NestJS guards             |
| **JWT**                      | (via Passport)         | Session tokens            | Stateless, scalable across multiple backend instances                   |

### Monorepo

| Technology                | Version                  | Purpose            | Why                                                                                                        |
| ------------------------- | ------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Turborepo**             | 2.x (latest)             | Build orchestrator | Content-aware caching, parallelization, affected-only builds, free Vercel remote caching                   |
| **pnpm**                  | 10.x (10.11.0 installed) | Package manager    | Faster installs (reuses packages), strict peer deps detection, smaller node_modules, onlyBuiltDependencies |
| **TypeScript references** | 5.8+ config              | Monorepo linking   | Instead of path aliases — allows proper incremental builds                                                 |

### Infrastructure & DevOps

| Technology         | Version         | Purpose                       | Why                                                                            |
| ------------------ | --------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| **Docker**         | 27.x+           | Containerization              | Compose for local dev, image for Docker Compose deploy                         |
| **Docker Compose** | 2.x             | Multi-container orchestration | Development and early production, stateless services scale to Kubernetes later |
| **PostgreSQL**     | 15+ (in Docker) | Database container            | Alpine-based image (~150MB), proven volume handling                            |
| **Redis**          | 7.x (in Docker) | Cache/queue container         | Official image, small footprint                                                |

### Code Quality

| Technology      | Version                 | Purpose              | Why                                                                                                          |
| --------------- | ----------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------ |
| **ESLint**      | 10.x (10.2.0 installed) | Linting              | Flat config (eslint.config.ts), @typescript-eslint/strict, react-hooks, react-compiler, no-floating-promises |
| **Prettier**    | 4.x                     | Formatting           | One-way (no debates), 80-char line length, trailing commas                                                   |
| **Husky**       | 9.x                     | Git hooks            | Pre-commit: prettier + ESLint, pre-push: full test suite                                                     |
| **lint-staged** | 15.x                    | Partial file linting | Lint only staged files, faster feedback loop                                                                 |

## Installation & Versions

### Create Monorepo

# Create Turborepo with pnpm

# Navigate to monorepo root

# Install dependencies (pnpm handles workspaces automatically)

# Verify monorepo structure

# apps/web (Next.js), apps/api (NestJS)

# packages/shared (Zod + types), packages/ui (shadcn/ui), packages/config (ESLint/TS/Prettier)

### Core Dependencies (NPM/pnpm)

# From monorepo root, in each package:

# apps/web (Next.js frontend)

# apps/api (NestJS backend)

# packages/shared

# Dev dependencies (all packages)

### Post-Install Setup

# Initialize ESLint + Prettier from shared config

# Initialize Husky

# Initialize Prisma

# Edit .env with PostgreSQL connection string

# pnpm exec prisma migrate dev --name init

# Initialize shadcn/ui in web app

# Build all packages in dependency order

# Run dev servers (Next.js + NestJS in parallel)

## Architecture Decisions & Rationale

### Why tRPC Over REST/GraphQL

| Decision             | Rationale                                                                  | Trade-off                                                         |
| -------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **tRPC**             | Type-safe RPC, zero codegen, routes are just functions, shared Zod schemas | No OpenAPI auto-gen (use zod-openapi if needed for external APIs) |
| Alternative: REST    | Familiar, easy to document                                                 | Manual validation, type gaps between frontend/backend             |
| Alternative: GraphQL | Flexible queries, strong ecosystem                                         | Learning curve, N+1 queries, complexity for CRUD apps             |

### Why Prisma Over TypeORM or Drizzle

| Decision             | Rationale                                                                                     | Trade-off                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Prisma 7**         | 3x faster queries (TypeScript-based), 90% smaller bundle, type-safe, migrations battle-tested | Generated Prisma Client code (4K-6K lines, regenerated on schema changes) |
| Alternative: TypeORM | Decorators native to NestJS, active ORM                                                       | Slower (Rust-based), larger bundle, more boilerplate                      |
| Alternative: Drizzle | Lightweight, explicit SQL-like syntax                                                         | Smaller ecosystem, fewer best practices documented                        |

### Why BullMQ Over Bull or Native Redis

| Decision                  | Rationale                                                                                 | Trade-off                                     |
| ------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------- |
| **BullMQ**                | Native NestJS support (@nestjs/bullmq), FIFO/priority queues, retries, DLQ, Bull Board UI | Redis-only backend (you need Redis anyway)    |
| Alternative: Bull         | Similar but unmaintained, BullMQ is the successor                                         | [None]                                        |
| Alternative: Native Redis | Minimal overhead                                                                          | No built-in retry logic, monitoring is manual |

### Why Playwright Over Puppeteer for PDF

| Decision                     | Rationale                                                                      | Trade-off                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| **Playwright**               | 59–125KB PDFs (smaller), cross-browser abstraction, same library for E2E tests | Chromium-only for PDF (same as Puppeteer)                                      |
| Alternative: Puppeteer       | Simpler API, 197KB files                                                       | Larger files, Chrome-only abstraction, unmaintained since Playwright took over |
| Alternative: Sharp + libvips | Fastest, smallest files                                                        | Complex for HTML-to-PDF, requires system dependencies                          |

### Why Keycloak SAML Over Auth0/Azure AD

| Decision                 | Rationale                                                                                   | Trade-off                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Keycloak + SAML**      | Already in organization, open-source, SAML 2.0 standard, @node-saml/passport-saml is stable | Requires IdP infrastructure (already there)                      |
| Alternative: Auth0       | Managed, MFA built-in                                                                       | Costs per active user, vendor lock-in, overkill for internal app |
| Alternative: NextAuth.js | Easier OAuth setup                                                                          | SAML support weak, designed for external users                   |

## Alternatives Considered

| Category    | Recommended     | Alternative             | Why Not                                                                      |
| ----------- | --------------- | ----------------------- | ---------------------------------------------------------------------------- |
| Frontend    | Next.js 16      | Remix, Astro            | Next.js has Turbopack default + React Compiler + largest ecosystem           |
| Framework   | NestJS 11       | FastAPI (Python), Go    | NestJS + TypeScript matches frontend ecosystem, tRPC native support          |
| ORM         | Prisma 7        | SQLAlchemy, Hibernate   | Prisma is TypeScript-first, zero setup in monorepo, type safety unmatched    |
| Validation  | Zod 4           | Yup, io-ts              | Zod has JIT compiler (2026), best monorepo story, tRPC default               |
| Queue       | BullMQ 5        | Resque, Sidekiq         | BullMQ is Node.js native, NestJS native, Redis-backed (already have it)      |
| PDF         | Playwright 1.50 | wkhtmltopdf, WeasyPrint | Playwright is programmatic, integrates with tests, smaller files             |
| Monorepo    | Turborepo 2     | Nx, Lerna               | Turborepo is simpler, faster, free caching, fits JavaScript ecosystem        |
| Database    | PostgreSQL 15   | MySQL, SQLite           | PostgreSQL has JSONB, full-text search, JSON operators, proven at scale      |
| Package Mgr | pnpm 10         | npm, yarn               | pnpm has strict peer deps, faster, smaller node_modules, Turborepo optimized |

## Performance Targets

### Build Performance

| Metric           | Target | How                                                 |
| ---------------- | ------ | --------------------------------------------------- |
| Cold build       | <30s   | Turborepo with TypeScript references, pnpm fastness |
| Cached build     | <1s    | Turborepo content-hashing, local cache hit          |
| Hot reload       | <200ms | Next.js Turbopack, Vitest watch mode                |
| Production build | <60s   | pnpm install + turbo build + Docker build           |

### Runtime Performance

| Metric               | Target              | How                                                     |
| -------------------- | ------------------- | ------------------------------------------------------- |
| API response (p50)   | <50ms               | NestJS + Prisma, PgBouncer pooling, Redis caching       |
| PDF generation       | <5s per page        | Playwright, async BullMQ job, parallel workers          |
| Database query (p99) | <100ms              | Prisma query optimization, PgBouncer, proper indexes    |
| Frontend LCP         | <1.5s               | Next.js automatic code-splitting, shadcn/ui lightweight |
| Memory (NestJS)      | <200MB per instance | Node.js 20, no global state, BullMQ job isolation       |

### Database Scaling

| Concern              | At 100 reports        | At 10K reports                         | At 1M reports                     |
| -------------------- | --------------------- | -------------------------------------- | --------------------------------- |
| Connection pool      | 20–30 (via PgBouncer) | 30–50                                  | 50–100 (add read replicas)        |
| Query index strategy | basic (PK, FK)        | compound indexes on (reportId, userId) | add pg_stat_statements monitoring |
| Report assembly      | sequential jobs       | BullMQ workers (10)                    | BullMQ priority queue + DLQ       |
| Cache (Redis)        | simple INCR counters  | report summaries + user sessions       | cache warming with cron           |

## Confidence Assessment

| Area            | Confidence      | Reason                                                                                                |
| --------------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| Next.js 16      | **HIGH**        | Official stable release, Vercel backing, React Compiler stable, Turbopack default, proxy.ts           |
| NestJS 11       | **HIGH**        | LTS with decorator support, @nestjs/bullmq official, strong TypeScript story                          |
| Prisma 7        | **HIGH**        | Published Jan 2026, 3x faster, Rust removal completed, production deployments confirm stability       |
| tRPC 11         | **HIGH**        | Stable API, monorepo default, thousands of production apps                                            |
| Zod 4           | **HIGH**        | JIT compiler production-ready, industry standard, no breaking changes expected                        |
| Playwright 1.50 | **HIGH**        | Microsoft-backed, stable API, cross-browser, PDF generation proven                                    |
| BullMQ 5        | **HIGH**        | De facto queue standard in Node.js, NestJS native, Redis-backed proven                                |
| Keycloak SAML   | **MEDIUM-HIGH** | Organization already uses it, @node-saml/passport-saml stable but lower-velocity than OAuth libraries |
| Turborepo 2     | **HIGH**        | Vercel backing, content-hashing battle-tested, no viable alternative in JavaScript                    |
| PostgreSQL 15   | **HIGH**        | Enterprise-proven, JSONB native, pg_stat_statements for analysis, 3+ years of stability               |
| PgBouncer 1.22  | **HIGH**        | Battle-tested for 10K+ connections, de facto standard, light-weight C implementation                  |

## Critical Dependencies & Versions

# Keep these synced across all packages

## Breaking Changes from Previous Versions

### Next.js 15 → 16

- **middleware.ts renamed to proxy.ts** — file must be renamed, Proxy API replaces middleware
- **Turbopack default** — no longer needs explicit opt-in, SWC migration automatic
- **React Compiler stable** — automatic memoization, babel-plugin-react-compiler required
- **Caching opt-in via 'use cache'** — no default caching, explicit cache directives
- **turbopack.root for monorepo** — explicit workspace root detection for Turborepo setups

### Prisma 6 → 7

- **Rust removed** — TypeScript implementation, no breaking schema changes
- **Bundle size** — 14MB → 1.6MB (90% reduction)
- **Query speed** — up to 3.4x faster
- No schema.prisma changes needed, just upgrade and regenerate Prisma Client

### TypeScript 5.8 → 5.9

- **Strict mode enforced** — project uses strict: true in tsconfig.base.json
- **Decorators TC39 Stage 3** — NestJS decorators work natively
- **No breaking changes** — patch upgrade, fully compatible

## Security Defaults

| Area          | Setting                                   | Why                                                             |
| ------------- | ----------------------------------------- | --------------------------------------------------------------- |
| TypeScript    | `strict: true`                            | Catches null/undefined bugs at compile time                     |
| ESLint        | `@typescript-eslint/strict` ruleset       | Prevents common pitfalls (floating promises, unsafe assignment) |
| Prisma        | `@prisma/client` validation               | SQL injection prevention, input sanitization                    |
| Zod           | Shared schemas                            | Frontend + backend use same validation rules                    |
| NestJS Guards | RBAC on every endpoint                    | @UseGuards(JwtGuard, RolesGuard) required                       |
| Helmet        | CORS, CSP, HSTS headers                   | `@nestjs/helmet` on app initialization                          |
| JWT           | Signed tokens, 1h expiry                  | Stateless sessions, rotate on refresh token                     |
| SAML          | Certificate pinning, assertion validation | @node-saml validates IdP response signature                     |
| PostgreSQL    | `host_based_authentication`, firewall     | No public IP, only Docker network access                        |
| Redis         | No AUTH required (internal only)          | Docker Compose network isolation, not exposed                   |

## Development Environment

### Local Setup (for team)

# Clone monorepo

# Install all dependencies

# Copy .env.example to .env (for local dev)

# .env should have:

# DATABASE_URL=postgresql://user:pass@localhost:5432/customreport_dev

# REDIS_URL=redis://localhost:6379

# Start Docker Compose (PostgreSQL + Redis)

# Run migrations (Prisma)

# Start dev servers (Next.js + NestJS in parallel, HMR enabled)

# Access:

# - Frontend: http://localhost:3000

# - API: http://localhost:3001

## Sources

- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading)
- [Next.js 16 Release Notes](https://nextjs.org/blog/next-16)
- [NestJS Documentation](https://docs.nestjs.com/first-steps)
- [Prisma 7 Performance Blog](https://www.prisma.io/blog/announcing-prisma-orm-7-0-0)
- [shadcn/ui Monorepo Support](https://ui.shadcn.com/docs/monorepo)
- [Tailwind CSS v4](https://ui.shadcn.com/docs/tailwind-v4)
- [tRPC + NestJS Integration Patterns](https://github.com/nawodyaishan/nestjs-nextjs-trpc-monorepo)
- [BullMQ Production Guide](https://docs.bullmq.io/guide/going-to-production)
- [BullMQ + NestJS Guide](https://docs.bullmq.io/guide/nestjs)
- [Zod Documentation](https://zod.dev/)
- [Playwright vs Puppeteer 2026 Benchmark](https://pdf4.dev/blog/html-to-pdf-benchmark-2026)
- [Playwright PDF Generation](https://www.firecrawl.dev/blog/playwright-vs-puppeteer)
- [Vitest Monorepo Setup](https://vitest.dev/guide/projects)
- [Turborepo Guide](https://turborepo.dev/docs/guides)
- [PgBouncer Connection Pooling 2026](https://www.tamiltech.in/article/scaling-postgresql-connections-with-pgbouncer-the-complete-guide-for-2026)
- [Keycloak + NestJS Integration](https://www.loginradius.com/enterprise-sso/keycloak/nestjs)
- [SAML + Keycloak + Next.js](https://medium.com/@david_haylock/integrating-keycloak-authentication-into-a-next-js-application-46dd5de0d550)
- [Monorepo Tools Comparison 2026](https://www.pkgpulse.com/blog/best-monorepo-tools-2026)
- [Turborepo + pnpm Best Practices](https://www.tinybird.co/blog/frontend-ci-monorepo-turborepo-pnpm)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

### TODO discipline — обязательное правило (2026-05-11)

Когда пользователь говорит «не делаем пока», «заложись и оставь», «mock без real config», «потом активируем» — устной договорённости **недостаточно**. В коде должны быть физические следы решения, иначе через неделю никто не вспомнит почему функция возвращает заглушку.

**Каждое такое решение требует трёх артефактов в коде:**

1. **`TODO(<ref>)` комментарий рядом с местом активации.**
   `<ref>` — это Phase номер или UFB-XXX, например `TODO(Phase-54-activation)` или `TODO(UFB-055)`.
   Содержание комментария: что активирует фичу и при каком условии.

   ```ts
   // TODO(Phase-54-activation): swap MockAiAdapter for real provider when
   // AI_PROVIDER env is set to "anthropic" | "yandex" | "llama". See
   // .planning/phases/54-ai-rag/54-PHASE-SUMMARY.md "Open questions".
   ```

2. **Заглушка-функция с `throw new Error('Not implemented — see TODO(<ref>)')`.**
   Молчаливый `return null` или `return undefined` запрещён — случайный вызов должен падать громко.

   ```ts
   if (env.AI_PROVIDER === 'mock') return mockAdapter.generate(...);
   throw new Error('Not implemented — see TODO(Phase-54-activation)');
   ```

3. **Метрика объявлена сразу, даже если никто не emit-ит.**
   `Counter` / `Histogram` с финальным именем должны существовать в коде с самого начала. Observability должен видеть «как фича должна работать» до активации, чтобы UAT мог проверить семантику метрик.

   ```ts
   // metric exists from day 1 even though real-path never fires
   export const aiSummaryGenerated = new Counter({
     name: "customreport_ai_summary_generated_total",
     help: 'Total AI summaries generated; mock-path counts under provider="mock".',
     labelNames: ["provider", "status"],
   });
   ```

**Что это даёт:**

- При `grep -r "TODO(Phase-54" apps/` за 5 секунд видны все точки активации
- Случайный вызов незаконченной функции падает с понятным сообщением + ссылкой на план
- Метрики не «появляются из воздуха» при активации — UAT и Grafana уже знают семантику

**Анти-паттерны (запрещено):**

- TODO только в SUMMARY.md без следа в коде
- `return null` / `return {}` вместо `throw new Error('Not implemented — see TODO(...)')`
- Метрика добавляется «когда дойдём» — нет, добавляется вместе с заглушкой
- Комментарий без `<ref>` (`// later we'll do AI` — бесполезен, не найти grep'ом)

### Применимость

Это правило **обязательно** для всех deferred / seeds-only фаз. Phase 54 (AI/RAG) и Phase 55 (Telegram) ночи 2026-05-11 были выпущены в seeds-режиме — проверь, что в их коде есть TODO-комментарии + заглушки + метрики по этому правилу. Если чего-то не хватает — допиши при первой же правке этих файлов.

### UI strings — English only до i18n (2026-05-11)

Все статические UI-строки в коде — на **английском**. Никаких русских литералов в JSX / `aria-label` / `toast` / `placeholder` / button text / empty state.

**Можно по-русски (это не литералы, а данные):**

- содержимое из БД, рендерится через `{variable}` — `organization.fullName`, `report.section.text`, `project.name`, `user.name`, audit log entries
- Тестовые fixtures (`*.test.*`, `*.spec.*`, seed files) — симулируют реальный ввод

**Запрещено (литералы в production коде):**

- `<p>Нет данных</p>` → `<p>No data</p>`
- `toast.success("Сохранено")` → `toast.success("Saved")`
- `aria-label="Закрыть"` → `aria-label="Close"`
- `placeholder="Поиск..."` → `placeholder="Search..."`
- Любые русские строки в `apps/web/src/**/*.tsx` вне комментариев / JSDoc / fixtures

**Reason:** проект ещё не на i18n. Когда i18n внедрим (отдельная фаза, TODO в `landing/tagline-cycler.tsx`), все UI-строки переедут в locale dictionary (`messages/<lang>/...json`), и тогда русский станет одним из выборов. До тех пор — английский = единственный источник правды для UI-копи. Это сохраняет код deployable для любого tenant'а (вспомни UFB-060: «PEO» fallback тоже не должен жить в коде — та же логика).

**How to apply:**

- любой PR / коммит c новым русским литералом в `apps/web/src/**/*.tsx` (не в тестах) — defect, переписать на английский
- если строка нужна русскоговорящему пользователю — данные кладутся в БД (seed) и UI рендерит `{data}`, не литерал
- pre-send self-check: `grep -nE '[а-яА-Я]' <changed file>` — каждое совпадение должно быть в комментарии / JSDoc / fixture, иначе переписать

**TODO(i18n-future):** массовый migration UI-копии в locale dictionary + locale switcher + `customreport_landing_locale_total{locale}` metric — отдельная фаза.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.

<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.

<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.

<!-- GSD:profile-end -->

<!-- rtk-instructions v2 -->

# RTK (Rust Token Killer) - Token-Optimized Commands

## Golden Rule

**Always prefix commands with `rtk`**. If RTK has a dedicated filter, it uses it. If not, it passes through unchanged. This means RTK is always safe to use.

**Important**: Even in command chains with `&&`, use `rtk`:

```bash
# ❌ Wrong
git add . && git commit -m "msg" && git push

# ✅ Correct
rtk git add . && rtk git commit -m "msg" && rtk git push
```

## RTK Commands by Workflow

### Build & Compile (80-90% savings)

```bash
rtk cargo build         # Cargo build output
rtk cargo check         # Cargo check output
rtk cargo clippy        # Clippy warnings grouped by file (80%)
rtk tsc                 # TypeScript errors grouped by file/code (83%)
rtk lint                # ESLint/Biome violations grouped (84%)
rtk prettier --check    # Files needing format only (70%)
rtk next build          # Next.js build with route metrics (87%)
```

### Test (90-99% savings)

```bash
rtk cargo test          # Cargo test failures only (90%)
rtk vitest run          # Vitest failures only (99.5%)
rtk playwright test     # Playwright failures only (94%)
rtk test <cmd>          # Generic test wrapper - failures only
```

### Git (59-80% savings)

```bash
rtk git status          # Compact status
rtk git log             # Compact log (works with all git flags)
rtk git diff            # Compact diff (80%)
rtk git show            # Compact show (80%)
rtk git add             # Ultra-compact confirmations (59%)
rtk git commit          # Ultra-compact confirmations (59%)
rtk git push            # Ultra-compact confirmations
rtk git pull            # Ultra-compact confirmations
rtk git branch          # Compact branch list
rtk git fetch           # Compact fetch
rtk git stash           # Compact stash
rtk git worktree        # Compact worktree
```

Note: Git passthrough works for ALL subcommands, even those not explicitly listed.

### GitHub (26-87% savings)

```bash
rtk gh pr view <num>    # Compact PR view (87%)
rtk gh pr checks        # Compact PR checks (79%)
rtk gh run list         # Compact workflow runs (82%)
rtk gh issue list       # Compact issue list (80%)
rtk gh api              # Compact API responses (26%)
```

### JavaScript/TypeScript Tooling (70-90% savings)

```bash
rtk pnpm list           # Compact dependency tree (70%)
rtk pnpm outdated       # Compact outdated packages (80%)
rtk pnpm install        # Compact install output (90%)
rtk npm run <script>    # Compact npm script output
rtk npx <cmd>           # Compact npx command output
rtk prisma              # Prisma without ASCII art (88%)
```

### Files & Search (60-75% savings)

```bash
rtk ls <path>           # Tree format, compact (65%)
rtk read <file>         # Code reading with filtering (60%)
rtk grep <pattern>      # Search grouped by file (75%)
rtk find <pattern>      # Find grouped by directory (70%)
```

### Analysis & Debug (70-90% savings)

```bash
rtk err <cmd>           # Filter errors only from any command
rtk log <file>          # Deduplicated logs with counts
rtk json <file>         # JSON structure without values
rtk deps                # Dependency overview
rtk env                 # Environment variables compact
rtk summary <cmd>       # Smart summary of command output
rtk diff                # Ultra-compact diffs
```

### Infrastructure (85% savings)

```bash
rtk docker ps           # Compact container list
rtk docker images       # Compact image list
rtk docker logs <c>     # Deduplicated logs
rtk kubectl get         # Compact resource list
rtk kubectl logs        # Deduplicated pod logs
```

### Network (65-70% savings)

```bash
rtk curl <url>          # Compact HTTP responses (70%)
rtk wget <url>          # Compact download output (65%)
```

### Meta Commands

```bash
rtk gain                # View token savings statistics
rtk gain --history      # View command history with savings
rtk discover            # Analyze Claude Code sessions for missed RTK usage
rtk proxy <cmd>         # Run command without filtering (for debugging)
rtk init                # Add RTK instructions to CLAUDE.md
rtk init --global       # Add RTK to ~/.claude/CLAUDE.md
```

## Token Savings Overview

| Category         | Commands                       | Typical Savings |
| ---------------- | ------------------------------ | --------------- |
| Tests            | vitest, playwright, cargo test | 90-99%          |
| Build            | next, tsc, lint, prettier      | 70-87%          |
| Git              | status, log, diff, add, commit | 59-80%          |
| GitHub           | gh pr, gh run, gh issue        | 26-87%          |
| Package Managers | pnpm, npm, npx                 | 70-90%          |
| Files            | ls, read, grep, find           | 60-75%          |
| Infrastructure   | docker, kubectl                | 85%             |
| Network          | curl, wget                     | 65-70%          |

Overall average: **60-90% token reduction** on common development operations.

<!-- /rtk-instructions -->

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:

- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
