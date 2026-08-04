<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/hero-dark.svg">
  <img src="assets/readme/hero.svg" alt="CustomReport — еженедельный статус-отчёт отдела Development: лиды заполняют секции, глава сводит их в один документ недели" width="100%">
</picture>

Лиды (`lead`) заполняют свои секции отчёта независимо друг от друга. Глава отдела
(`head`) просматривает, публикует и экспортирует единый сводный отчёт. Есть ещё
роли `admin` (администрирование) и `viewer` (только чтение).

> Это MVP. Продакшена пока нет — локальная, dev, test и UAT базы данных
> одноразовые: их сброс и пересборка с нуля ожидаемы и безопасны. Подробности —
> в [`CLAUDE.md`](./CLAUDE.md), раздел «MVP Phase: Database Is Disposable».

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/lifecycle-dark.svg">
  <img src="assets/readme/lifecycle.svg" alt="Жизненный цикл отчёта: лид заполняет секцию (draft → submitted), глава проверяет и сводит секции (approved / changes), публикует период и экспортирует его в PDF (published → pdf)" width="100%">
</picture>

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

- Node.js **>= 26**
- pnpm **11.17.0** (`npm install -g pnpm@11.17.0`; Node 26 не поставляет Corepack)
- Docker (для Postgres, Redis, почты и наблюдаемости)

## Быстрый старт

```bash
# 1. Зависимости
pnpm install

# 2. Окружение: скопировать пример и при необходимости поправить
cp .env.example .env

# 3. Поднять инфраструктуру в Docker (Postgres, Redis, Mailpit, Grafana, Bugsink)
pnpm observability:up

# 4. Залить схему и демо-данные в базу
pnpm db:seed:profile minimal # быстрый минимальный сид
# demo | full | stress       # возрастающие возможности и объём

# 5. Запустить web + api локально (в одном процессе, параллельно)
pnpm dev
```

После старта:

- Веб — http://localhost:3000
- API — http://localhost:3002
- Почта (Mailpit) — http://localhost:8025
- Grafana (трейсы/логи/метрики) — http://localhost:3003 (`admin` / `admin`)
- Bugsink (ошибки) — http://localhost:8000

### Вход без реального SSO (dev)

Локально аутентификация идёт через dev-режим: `AUTH_DEV_MODE=true` и эндпоинт
`/auth/dev-login`. Переключатель ролей в UI включается флагом
`NEXT_PUBLIC_DEV_ROLE_SWITCHER=true`. В продакшене эти флаги запрещены — там
только Keycloak SAML.

## Основные команды

```bash
pnpm dev            # web + api в dev-режиме (turbo --parallel)
pnpm typecheck      # проверка типов во всех пакетах
pnpm lint           # все 35 проверок качества, отчёт по каждой
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
pnpm db:seed:profile demo # пересобрать базу и залить демонстрационный профиль
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
