# Быстрый старт и основные команды

Подробная версия раздела "Быстрый старт" из [`README.md`](../README.md).
Что стоит за командами, объясняет [`onboarding.md`](./onboarding.md).

> Разрушительные операции с БД не считаются безопасными по умолчанию. Точный
> список одноразовых целей и обязательный guard описаны в
> [`AGENTS.md`](../AGENTS.md), раздел «Database safety».

## Требования

- Node.js **26.13.0 Current** (`>=26.0.0 <27.0.0`, версия `.nvmrc`)
- pnpm — версия из поля `packageManager` в `package.json` (`npm install -g pnpm@<версия>`; Node 26 не поставляет Corepack)
- OrbStack с включённым Kubernetes и `kubectl` (локальные Postgres, Redis, Mailpit и Gotenberg живут в namespace `wr-dev`)
- Текущий контекст `kubectl` должен быть `orbstack`, иначе `pnpm deps:up` и
  `pnpm deps:down` откажутся работать. Проверить: `kubectl config current-context`,
  переключить: `kubectl config use-context orbstack`.

## Запуск

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

## После старта

Все опубликованные dev-порты привязаны к `127.0.0.1` и недоступны напрямую
с других машин в сети.

- Веб — http://localhost:3000
- API — http://localhost:3002
- Метрики API — http://localhost:3002/metrics (в production endpoint закрыт
  внешним Caddy)

## Вход без реального SSO (dev)

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
`pnpm --filter @weeklyreport/api test:integration`.

## Отладка

Полезное при локальной отладке: читай структурированный лог API в
`apps/api/.logs/app.log`; в production Kubernetes API пишет в stdout
(`kubectl -n <ns> logs deployment/api -c api`, точные команды — в `docs/onboarding.md`). Готовность проверяй через `/health/ready`, а метрики —
через `/metrics`.

## Куда смотреть дальше

- **[`docs/onboarding.md`](./onboarding.md)** — подробный гайд для новых
  разработчиков: архитектура, поток данных, роли, окружение, наблюдаемость,
  гейты, отладка, рабочий процесс.
- **[`CONTEXT.md`](../CONTEXT.md)** — словарь терминов проекта (отчётный период,
  submission, сценарии и т.д.). Читать до того, как спорить о названиях.
- **[`docs/adr/`](./adr/)** — архитектурные решения (почему так, а не иначе).
- **`openspec/specs/`** — источник истины для актуальных контрактов поведения;
  проверяется командой `pnpm spec:check`.
- **[`docs/coming-soon.md`](./coming-soon.md)** — единый реестр отложенных
  продуктовых идей; ни одна из них не реализуется без прямой команды владельца.
- **[`CONTRIBUTING.md`](../CONTRIBUTING.md)** — правила контрибьюции.
