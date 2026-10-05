<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/hero-dark.svg">
  <img src="assets/readme/hero.svg" alt="WeeklyReport — еженедельный статус-отчёт отдела Development: лиды заполняют секции, глава сводит их в один документ недели" width="100%">
</picture>

Лиды (`lead`) заполняют свои секции отчёта независимо друг от друга. Глава отдела
(`head`) просматривает, публикует и экспортирует единый сводный отчёт. Есть ещё
роли `admin` (администрирование) и `viewer` (наблюдение отчёта; назначенные
review-действия доступны отдельно).

> Разрушительные операции с БД не считаются безопасными по умолчанию. Точный
> список одноразовых целей и обязательный guard описаны в
> [`AGENTS.md`](./AGENTS.md), раздел «Database safety».

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/lifecycle-dark.svg">
  <img src="assets/readme/lifecycle.svg" alt="Жизненный цикл отчёта: лид заполняет секцию (draft → submitted), глава проверяет и сводит секции (approved / changes), публикует период и экспортирует его в PDF (published → pdf)" width="100%">
</picture>

## Что умеет MVP

- **Лид** заполняет свою секцию: статусы продуктов и активностей, задачи на
  текущую и следующую недели, риски, решения и приоритеты. Черновик сохраняется
  автоматически; лид может перенести незавершённую работу, отправить секцию и
  запросить повторное открытие.
- **Глава отдела** видит сводный дашборд и секции лидов, проверяет записи,
  оставляет комментарии и вердикты, публикует или повторно открывает период,
  показывает слайды и экспортирует отчёт в PDF.
- **Наблюдатель** читает доступный текущий или опубликованный отчёт, ищет записи
  в опубликованных периодах, открывает историю, слайды и PDF. Контент отчёта
  недоступен для изменения; назначенные reviewer-действия (acknowledgements,
  comments и verdicts) остаются отдельными операциями.
- **Администратор** управляет пользователями, группами, продуктами, этапами,
  активностями, отчётными периодами, напоминаниями, настройками организации,
  AI-провайдером и версиями системных инструкций ассистента.
- **Система** поддерживает SAML-вход, автоматический перенос незавершённой
  работы, доставку напоминаний, неизменяемые опубликованные снимки,
  авторизованный поиск по отчётам, помощника для лида, наблюдаемость и
  защищённые процедуры резервного копирования и восстановления.

Актуальные контракты поведения находятся в `openspec/specs/`. Репозиторий
доказывает реализацию и сборку, но не заменяет проверку конкретного
production-развёртывания.

## Стек

- **Фронтенд** — Next.js 16 / React 19 (`apps/web`).
- **Бэкенд** — NestJS 11 + tRPC + Prisma (`apps/api`).
- **БД** — PostgreSQL; общие схемы и контракты — `packages/shared`.
- **Наблюдаемость** — структурированные логи, внутренние метрики на `/metrics`
  и ошибки в подключённом внешнем Sentry.
- **Монорепо** — pnpm workspaces + Turborepo.

## Структура

```text
weeklyreport
├── apps/web         # Next.js фронтенд
├── apps/api         # NestJS / tRPC / Prisma бэкенд
├── packages/report-persistence # серверный Prisma mapper и snapshots
├── packages/migrator-runtime # зависимости минимального migration image
├── packages/shared  # Zod-схемы, типы, общие контракты
├── packages/ui      # shadcn/ui + токены Tailwind
├── prisma           # схема, миграции, сиды, защитные guard-ы
├── openspec         # актуальные контракты продукта и разработки (specs/)
└── docs             # ADR-ы и гайды (см. docs/onboarding.md)
```

## Требования

- Node.js **26.10.0 Current** (`>=26.0.0 <27.0.0`, версия `.nvmrc`)
- pnpm **11.28.3** (`npm install -g pnpm@11.28.3`; Node 26 не поставляет Corepack)
- OrbStack с включённым Kubernetes и `kubectl` (локальные Postgres, Redis, Mailpit и Gotenberg живут в namespace `wr-dev`)

## Быстрый старт

```bash
# 1. Зависимости
pnpm install

# 2. Окружение: скопировать пример и при необходимости поправить
cp .env.example .env
# Для `pnpm dev` достаточно значений из примера и локальных зависимостей.

# 3. Поднять локальные зависимости (Postgres, Redis, Mailpit, Gotenberg в Kubernetes)
pnpm deps:up

# 4. Создать точную disposable-базу, применить миграции и залить профиль
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай' \
  pnpm db:bootstrap:local demo
# stress — тот же продуктовый набор с большим объёмом данных

# 5. Запустить web + api одной командой (параллельные процессы)
pnpm dev
```

После старта:

Все опубликованные dev-порты привязаны к `127.0.0.1` и недоступны напрямую
с других машин в сети.

- Веб — http://localhost:3000
- API — http://localhost:3002
- Метрики API — http://localhost:3002/metrics (в production endpoint закрыт
  внешним Caddy)

### Вход без реального SSO (dev)

Локально аутентификация идёт через dev-режим: `AUTH_DEV_MODE=true` и эндпоинт
`/auth/dev-login`. Переключатель ролей в UI включается флагом
`NEXT_PUBLIC_DEV_ROLE_SWITCHER=true`. В продакшене эти флаги запрещены — там
только Keycloak SAML.

## Основные команды

```bash
pnpm dev            # web + api в dev-режиме через persistent Turbo tasks
pnpm db:bootstrap:local demo    # guarded create + migrate + seed
pnpm typecheck      # проверка типов во всех пакетах
pnpm lint           # полный набор проверок качества, отчёт по каждой
pnpm test           # unit-тесты workspace + Prisma, cleanliness и operations checks
pnpm build          # production-сборка
pnpm format         # Prettier по всему дереву
pnpm spec:check     # строгая проверка всех спецификаций OpenSpec
```

Перед поставкой один и тот же tree должен пройти:
`pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` и
`pnpm spec:check`.

Корневой `pnpm test` запускает unit-тесты workspace, Prisma-тесты и проверки
repository cleanliness и operations. Интеграционные тесты API с базой данных в
него не входят: запускайте их отдельно через
`pnpm --filter @customreport/api test:integration`.

Полезное при локальной отладке: читай структурированный лог API в
`apps/api/.logs/app.log`; в production Kubernetes API пишет в stdout
(`kubectl -n <ns> logs deployment/api -c api`, точные команды — в `docs/onboarding.md`). Готовность проверяй через `/health/ready`, а метрики —
через `/metrics`.

## Куда смотреть дальше

- **[`docs/onboarding.md`](./docs/onboarding.md)** — подробный гайд для новых
  разработчиков: архитектура, поток данных, роли, окружение, наблюдаемость,
  гейты, отладка, рабочий процесс.
- **[`CONTEXT.md`](./CONTEXT.md)** — словарь терминов проекта (отчётный период,
  submission, сценарии и т.д.). Читать до того, как спорить о названиях.
- **[`docs/adr/`](./docs/adr/)** — архитектурные решения (почему так, а не иначе).
- **`openspec/specs/`** — источник истины для актуальных контрактов поведения;
  проверяется командой `pnpm spec:check`.
- **[`docs/coming-soon.md`](./docs/coming-soon.md)** — единый реестр отложенных
  продуктовых идей; ни одна из них не реализуется без прямой команды владельца.
- **[`CONTRIBUTING.md`](./CONTRIBUTING.md)** — правила контрибьюции.
