# CustomReport

Веб-приложение для еженедельных статус-отчётов отдела CoreDev.

Лиды (`lead`) заполняют свои секции отчёта независимо друг от друга. Глава отдела
(`head`) просматривает, публикует и экспортирует единый сводный отчёт. Есть ещё
роли `admin` (администрирование) и `viewer` (только чтение).

> Проект находится в pre-production MVP. Локальная, dev, test и UAT базы данных
> одноразовые: их сброс и пересборка с нуля ожидаемы и безопасны. Production
> Compose-конфигурация предназначена для будущего развёртывания и не отменяет
> это правило для непроизводственных окружений. Подробности — в
> [`CLAUDE.md`](./CLAUDE.md), раздел «MVP Phase».

## Стек

- **Фронтенд** — Next.js 16 / React 19 (`apps/web`).
- **Бэкенд** — NestJS 11 + tRPC + Prisma (`apps/api`).
- **БД** — PostgreSQL; общие схемы и контракты — `packages/shared`.
- **Наблюдаемость** — трейсы/логи/метрики в Grafana (otel-lgtm: Tempo/Loki/
  Prometheus), ошибки — в Bugsink.
- **Монорепо** — pnpm workspaces + Turborepo.

## Структура

```text
customreport
├── apps/web         # Next.js фронтенд
├── apps/api         # NestJS / tRPC / Prisma бэкенд
├── packages/shared  # Zod-схемы, типы, общие контракты
├── packages/ui      # shadcn/ui + токены Tailwind
├── prisma           # схема, миграции, сиды, защитные guard-ы
├── openspec         # активный бэклог (changes/) + контракты (specs/)
└── docs             # ADR-ы и гайды (см. docs/onboarding.md)
```

## Требования

- Node.js **>= 24**
- pnpm **10.11** (`corepack enable` подтянет нужную версию)
- Docker (для Postgres, Redis, почты и наблюдаемости)

## Локальный запуск

```bash
# 1. Включить package manager из package.json и установить зависимости
corepack enable
pnpm install

# 2. Окружение API и web
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local

# 3. Поднять зависимости и дождаться их готовности
docker compose up -d --wait postgres redis mailhog

# 4. Применить миграции и залить демо-данные
pnpm db:fresh:simple      # минимальный middle-tier seed
# pnpm db:fresh:advanced  # объёмный canonical seed

# 5. Запустить web + api из исходников
pnpm dev
```

`apps/web/.env.local` нужен отдельно: Next.js читает environment files из
`apps/web`, а API читает корневой `.env`. Локальный web template включает
dev-login picker и role switcher; эти значения не предназначены для production.

После старта:

- Веб — http://localhost:3000
- API — http://localhost:3002
- Почта (Mailpit) — http://localhost:8025

Наблюдаемость запускается отдельно и не должна выполняться одновременно с
`pnpm dev`, потому что полный observability Compose-layer также поднимает Docker
версии `api` и `web`:

```bash
pnpm observability:up
```

После этого Grafana доступна на http://localhost:3003, а Bugsink — на
http://localhost:8000. Для остановки используй `pnpm observability:down`.

Если запускаешь приложение полностью в Docker, используй Compose-layer напрямую
вместо `pnpm dev`:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
```

В этом режиме seed-команды всё равно запускаются с хоста после готовности
Postgres и Redis.

## Production Docker deployment

Production requires an encryption key and an explicit provider-origin allowlist;
the active provider credential and model choices are stored by an administrator
in Settings → AI → Provider. Create an untracked
`.env.prod` и заполни обязательные значения из `.env.example`:

```env
DB_PASSWORD=<strong-database-password>
FRONTEND_URL=https://reports.example.com
APP_BASE_URL=https://reports.example.com
NEXT_PUBLIC_API_URL=https://reports.example.com
AUTH_JWT_SECRET=<at-least-32-characters>
PDF_EXPORT_JWT_SECRET=<at-least-32-characters>
PDF_BASE_URL=https://reports.example.com
HEAP_HEALTH_THRESHOLD_BYTES=1610612736

KEYCLOAK_SAML_CALLBACK_URL=https://reports.example.com/auth/saml/callback
KEYCLOAK_SAML_ENTRY_POINT=<keycloak-saml-entry-point>
KEYCLOAK_SAML_ISSUER=<keycloak-issuer>
KEYCLOAK_SAML_CERT=<keycloak-certificate>

SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_FROM=noreply@example.com

AI_PROVIDER_CONFIG_ENCRYPTION_KEY=<base64-or-hex-32-byte-key>
AI_PROVIDER_CONFIG_KEY_VERSION=1
AI_PROVIDER_ALLOWED_ORIGINS=https://api.mistral.ai,https://openrouter.ai,https://api.groq.com,https://api.jina.ai,https://api.openai.com
REPORT_ASSISTANT_INPUT_VERSION=1
REPORT_ASSISTANT_SIMILARITY_THRESHOLD=0.55
REPORT_ASSISTANT_CANDIDATE_LIMIT=500
REPORT_ASSISTANT_READ_THROUGH_LIMIT=16
REPORT_ASSISTANT_EXHAUSTIVE_LIMIT=200
REPORT_ASSISTANT_CONTEXT_TOKEN_BUDGET=8000
REPORT_ASSISTANT_PROVIDER_TIMEOUT_MS=30000
REPORT_ASSISTANT_PLANNER_MAX_TOKENS=1500
REPORT_ASSISTANT_ANSWER_MAX_TOKENS=2000
REPORT_ASSISTANT_EMBEDDING_BATCH_SIZE=32
REPORT_ASSISTANT_EMBEDDING_TOKEN_BUDGET=8000

CADDY_SITE_ADDRESS=reports.example.com
CADDY_ACME_EMAIL=ops@example.com
CADDY_CSP_REPORT_URI=<csp-report-collector-url>
```

Проверь конфигурацию и запусти production stack:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml config --quiet
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

After deployment, an administrator opens **Settings → AI → Provider**, enters
the provider credential and the three model IDs, runs the synthetic provider
capability test, and activates the tested revision. Under **Settings → AI →
Features**, prompt revisions are structurally validated and activated
independently; prompt lifecycle never calls a provider or requires a
provider/prompt compatibility result. The provider credential, model IDs, and
measured embedding dimensions do not belong in `.env.prod`; prompt bodies are
database-backed runtime data and are never environment fallbacks.

После успешного запуска проверь `https://reports.example.com/health/live`.
Production database не сбрасывается и не пересеивается: миграции применяются
init-контейнером `migrate`, а seed выполняется только для явно подготовленной
непродакшеновой базы. Подробности reverse proxy — в
[`deploy/caddy/README.md`](./deploy/caddy/README.md).

### Вход без реального SSO (dev)

Локально аутентификация идёт через dev-режим: `AUTH_DEV_MODE=true` и эндпоинт
`/auth/dev-login`. Переключатель ролей в UI включается флагом
`NEXT_PUBLIC_DEV_ROLE_SWITCHER=true`. В продакшене эти флаги запрещены — там
только Keycloak SAML.

## Основные команды

```bash
pnpm dev            # web + api в dev-режиме (turbo --parallel)
pnpm typecheck      # проверка типов во всех пакетах
pnpm lint           # ESLint + stylelint + проверка типов Prisma
pnpm test           # unit-тесты (Vitest)
pnpm build          # production-сборка
pnpm format         # Prettier по всему дереву
```

Перед коммитом эти четыре гейта должны быть зелёными:
`pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

Полезное при отладке:

```bash
pnpm logs           # хвост лога API (apps/api/.logs/app.log)
pnpm logs:errors    # только error/warn из лога API
pnpm db:fresh:simple # пересобрать базу с нуля и залить демо-данные
```

## Куда смотреть дальше

- **[`docs/onboarding.md`](./docs/onboarding.md)** — подробный гайд для новых
  разработчиков: архитектура, поток данных, роли, окружение, наблюдаемость,
  гейты, отладка, рабочий процесс.
- **[`CONTEXT.md`](./CONTEXT.md)** — словарь терминов проекта (отчётный период,
  submission, сценарии и т.д.). Читать до того, как спорить о названиях.
- **[`docs/adr/`](./docs/adr/)** — архитектурные решения (почему так, а не иначе).
- **`openspec/`** — текущий бэклог и контракты. Список активных изменений:
  `openspec list`.
- **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** — правила контрибьюции.
