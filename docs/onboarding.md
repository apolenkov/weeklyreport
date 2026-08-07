# Онбординг разработчика

Гайд для того, кто впервые открыл этот репозиторий. Цель — за один день понять,
что это за проект, как он устроен, как его запустить и где что искать.

Если коротко: сначала прочитай [`README.md`](../README.md) и запусти проект по
разделу «Локальный запуск». Этот документ объясняет то, что стоит за командами.

## 1. Что за продукт

CustomReport автоматизирует еженедельные статус-отчёты отдела Development.

Бизнес-сценарий по ролям:

1. **lead** — заполняет свою секцию отчёта за текущий отчётный период.
2. **head** — просматривает секции всех лидов, публикует и экспортирует единый
   сводный отчёт (в том числе в PDF).
3. **admin** — администрирование: продукты, настройки, фоновые задачи.
4. **viewer** — доступ только на чтение опубликованных отчётов.

Ключевые термины («отчётный период», «submission», «архивный период» и т.д.)
строго определены в [`../CONTEXT.md`](../CONTEXT.md). Это не формальность: эти
слова раньше путали, и словарь фиксирует единый язык. Прочитай его до того, как
начнёшь спорить о названиях в коде или ревью.

## 2. Архитектура

Это монорепо на pnpm workspaces + Turborepo. Главные части:

- **`apps/web`** — фронтенд на Next.js 16 / React 19. App Router.
- **`apps/api`** — бэкенд на NestJS 11. Слой API — tRPC. Доступ к БД — Prisma.
- **`packages/shared`** — Zod-схемы, типы, enum-ы. Общий контракт между web и api.
- **`packages/ui`** — компоненты shadcn/ui и токены Tailwind.
- **`prisma`** — схема БД, единственная init-миграция, сиды, защитные guard-ы.
- **`openspec`** — бэклог изменений и durable-контракты (см. раздел 8).

Граница доменов на бэкенде — это Nest-модули (`apps/api/src/modules/*`) плюс
репозитории Prisma. Бизнес-логика живёт в сервисах модулей, а не в роутере.

## 3. Как данные ходят между web и api

Поток одного запроса с фронтенда:

1. Браузер вызывает tRPC-клиент. URL запроса — относительный `/trpc`
   (`apps/web/src/lib/trpc.ts`), то есть same-origin к web-серверу.
2. Next.js по правилам из `apps/web/next.config.ts` (`rewrites`) проксирует
   `/trpc`, `/auth`, `/health`, `/api` на бэкенд (`API_URL`, по умолчанию
   `http://localhost:3002`).
3. На бэкенде tRPC примонтирован как Express-middleware на `/trpc`
   (`apps/api/src/main.ts`), роутер собирается в
   `apps/api/src/infrastructure/trpc/`.
4. Процедура вызывает сервис нужного модуля → Prisma → PostgreSQL.

Почему так, а не прямой вызов браузер→api: тот же origin упрощает куки/CORS, а
проброс через Next даёт единую точку входа. Типобезопасность сквозная — типы
роутера импортируются на фронт из `@customreport/api`.

## 4. Окружение и переменные

Файлы окружения:

- **Корневой `.env`** — основной. Его читает api (запускается с
  `--env-file=../../.env`). Образец — `.env.example`, скопируй его в `.env`.
- **`apps/web/.env` и `apps/web/.env.local`** — локальное окружение web. Next.js
  читает их из каталога приложения. Сюда кладут `NEXT_PUBLIC_*` переменные.

Для стандартного локального запуска достаточно корневого `.env`, созданного из
`.env.example`: он уже согласован с credentials и host-портом Postgres из
`docker-compose.yml`. Менять `DATABASE_URL` на `user:pass` нельзя — локальный
Compose использует пользователя `customreport` и пароль `localdev`.

Важная тонкость: переменные `NEXT_PUBLIC_*` должны быть доступны процессу web,
иначе браузер их не увидит. Например, `NEXT_PUBLIC_SENTRY_DSN` нужен в окружении
web, чтобы заработала корреляция ошибок с трейсами (см. раздел 6).

### Native Lead Chat

Для Lead Chat нужны отдельные Mistral workspaces и ключи для development/UAT и
production. Ключ хранится только в untracked `.env` или secret manager; в Git,
OpenSpec, логах и скриншотах его не бывает. Production rollout требует paid
workspace, отдельного spending limit, подтверждения режима обучения и
retention/ZDR, а также одобрения EU data region. Настройки фиксированы и не
используют `-latest`: `mistral-medium-3-5` для planner/answer,
`mistral-embed` с `1024` dimensions и `MISTRAL_API_SERVER=eu`.

Сначала выкатывают и проверяют полную конфигурацию, затем код: `GET
/v1/models` на `api.eu.mistral.ai` проверяет доступность моделей и HTTPS/443
без report content. Для PostgreSQL сначала проверяют initialized-database
ledger через `pnpm db:check-init-target`, затем применяют DDL через прямой
`DIRECT_URL` connection, а не PgBouncer; production database никогда не
reset-ят. После этого smoke-проверка идёт в порядке save → submit → publish →
search → PDF → Chat, а расходы, token/request rate, 429 и timeout смотрят по
workspace billing и bounded `customreport_assistant_*` metrics. При проблеме
откатывают application image, не удаляя additive DB objects. Полный порядок
команд — в [`operations/lead-report-assistant-rollout.md`](./operations/lead-report-assistant-rollout.md).

Аутентификация локально:

- `AUTH_DEV_MODE=true` включает dev-вход через `/auth/dev-login`.
- `NEXT_PUBLIC_DEV_ROLE_SWITCHER=true` показывает переключатель ролей в UI.
- В продакшене dev-флаги запрещены — api не стартует с ними при
  `NODE_ENV=production` (защита в `apps/api/src/lib/dev-auth-fence.ts`). Там
  работает только Keycloak SAML.

## 5. База данных

Во время MVP база одноразовая — её можно сбрасывать и пересобирать свободно.

- Схема — `prisma/schema.prisma`. Меняешь её напрямую и пересобираешь; отдельные
  alter-миграции не пишешь (есть единственная init-миграция, её держат в синхроне
  со схемой вручную, когда Prisma не выражает конструкцию).
- Залить демо-данные: `pnpm db:fresh:simple` (middle-tier) или
  `pnpm db:fresh:advanced` (canonical). Оба сначала делают hard-reset, затем
  выполняют relational seed, canonical snapshot finalization и проверку
  готовности Lead Chat.
- Поддерживаемые частичные команды — `pnpm db:seed:canonical`,
  `pnpm db:seed:small`, `pnpm db:seed:middle` и `pnpm db:seed:huge`.
  Файлы `prisma/seed.ts`, `prisma/seed-simple.ts` и `prisma/seed-demo.ts` —
  внутренние relational writers: не запускай их напрямую, иначе будут
  пропущены финализация snapshot и readiness-check.
- Для восстановления базы, созданной дефектными demo-fixtures, сначала укажи
  явный non-production `DATABASE_URL`, затем выполни `pnpm db:reset:hard`.
  Команда применяет миграции, очищает таблицы и Redis, заново создаёт middle
  fixture через orchestration и завершается только после проверки Lead Chat.
  Для canonical fixture после reset выполни `pnpm db:seed:canonical`.
  В UAT используй тот же порядок только для базы с суффиксом `_uat`; guard
  откажется работать с production-looking URL. Production базу не reset-ят и
  не пересеивают ни при каких обстоятельствах.
- Защита от случайного сноса не той базы — `prisma/_destructive-guard.ts`: он
  разбирает `DATABASE_URL` и не даёт деструктивную операцию без суффикса
  `_uat` / `_dev` / `_test` (продакшен защищён отдельно флагом
  `ALLOW_PROD_DESTRUCTIVE`).

Подробные правила — в [`../CLAUDE.md`](../CLAUDE.md), разделы про disposable БД и
Docker-базы.

## 6. Наблюдаемость (логи, трейсы, метрики, ошибки)

Наблюдаемость поднимается отдельной командой `pnpm observability:up`. Не запускай
её параллельно с `pnpm dev`: observability Compose-layer также включает Docker
версии `api` и `web`. Для обычной разработки достаточно `docker compose up -d
postgres redis mailhog`; полный порядок приведён в README.

1. **Grafana / otel-lgtm** (http://localhost:3003, `admin`/`admin`) — трейсы в
   Tempo, логи в Loki, метрики в Prometheus. Бэкенд экспортирует через OTLP
   (`apps/api/src/infrastructure/otel/otel.bootstrap.ts`).
2. **Bugsink** (http://localhost:8000) — трекер ошибок, совместимый с Sentry.
   Сюда летят только ошибки (не трейсы и не транзакции).

Связь между ними — по общему `trace_id`: ошибка в Bugsink несёт id своего
OTel-трейса, и по нему можно перейти к полному трейсу в Tempo. Реализация и
решение «почему Bugsink для ошибок, а LGTM для остального» —
в [`adr/0002-telemetry-sentry-skeleton-lgtm-backends.md`](./adr/0002-telemetry-sentry-skeleton-lgtm-backends.md)
и в OpenSpec-изменении `correlate-errors-to-traces`.

Чтобы корреляция работала в dev, `NEXT_PUBLIC_SENTRY_DSN` должен дойти до
процесса web (положи в `apps/web/.env.local`), а проект в Bugsink — существовать.

## 7. Гейты и стиль кода

Перед коммитом должны быть зелёными четыре гейта:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Инструменты:

- **ESLint** (`eslint.config.ts`) — логический линт TS/JS. Строгие правила:
  `no-explicit-any: error`, `no-floating-promises: error`, неиспользуемые
  переменные — ошибка.
- **Prettier** (`.prettierrc.json`) — форматирование всего (TS/JS/JSON/CSS/YAML/
  Markdown). Markdown форматируется, но не линтуется.
- **stylelint** (`.stylelintrc.json`) — линт CSS.
- Husky + lint-staged гоняют это на staged-файлах при коммите.

Правила, о которые легко споткнуться:

- **UI-строки — только английские.** Имеется в виду хардкод в продакшен-коде
  фронта (`apps/web/src`): JSX, toast, aria-label, placeholder. Русский допустим
  как данные из БД/сидов/фикстур, в комментариях и тестах. Полноценной i18n-фазы
  ещё нет.
- **Conventional Commits**: `type: subject` (`feat`/`fix`/`refactor`/`docs`/
  `test`/`chore`), повелительное наклонение.
- Язык артефактов: код, комментарии, коммиты — английские; прозовые доки
  (`README`, `docs/**`, ADR) — на языке файла (русский допустим).

## 8. Рабочий процесс: OpenSpec

Изменения ведутся через OpenSpec — лёгкий процесс «сначала контракт, потом код».

- `openspec/changes/` — активные изменения (предложение + задачи + дельта-спека).
- `openspec/specs/` — durable-контракты, которые накапливаются после внедрения.
- `openspec list` — список активных изменений; `openspec list --specs` — спеки.
- Каждое изменение валидируется: `openspec validate <id> --strict`.

Типичный цикл: создать изменение → описать proposal/tasks/spec → реализовать по
задачам → проверить → заархивировать (дельта вливается в `specs/`).

Для поведенческой проверки UI есть драйвер (`ai-ui-driver`) — он гоняет роль по
живому приложению против каталога сценариев. Термины «Driver», «Scenario
Catalog», «Role sweep» определены в [`../CONTEXT.md`](../CONTEXT.md).

## 9. Отладка

- Логи API — `pnpm logs` (хвост `apps/api/.logs/app.log`), только ошибки —
  `pnpm logs:errors`. В строках лога есть `traceId`/`spanId`.
- Трейс запроса — в Grafana → Tempo (ищи по `traceId` из лога).
- Ошибки с фронта и бэка — в Bugsink; оттуда переход к трейсу по общему id.
- Письма (например, напоминания) — в Mailpit (http://localhost:8025).
- Сломалась база или странные данные — пересобери:
  `pnpm db:fresh:simple`.
- `npx prisma generate`, если TypeScript «не видит» модель Prisma (клиент мог
  быть затёрт pnpm-операцией) — это регенерация, а не реальная ошибка.

## 10. Первые шаги

1. Запусти проект по «Быстрому старту» из README и зайди под каждой ролью через
   переключатель ролей.
2. Прочитай `CONTEXT.md` целиком — это язык, на котором написан проект.
3. Пройди один поток данных в коде: открой `apps/web/src/lib/trpc.ts`, найди
   вызов процедуры, проследи его до сервиса модуля в `apps/api/src/modules/*` и
   до Prisma.
4. Посмотри `openspec list` — это то, над чем идёт работа прямо сейчас.
5. Перед любым PR прогоняй четыре гейта из раздела 7.
