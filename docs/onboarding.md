# Онбординг разработчика

Гайд для того, кто впервые открыл этот репозиторий. Цель — быстро понять,
что это за проект, как он устроен, как его запустить и где что искать.

Если коротко: сначала прочитай [`README.md`](../README.md) и запусти проект по
разделу «Быстрый старт». Этот документ объясняет то, что стоит за командами.

## 1. Что за продукт

WeeklyReport автоматизирует еженедельные статус-отчёты отдела CoreDev.

Бизнес-сценарий по ролям:

1. **lead** — заполняет свою секцию отчёта за текущий отчётный период.
2. **head** — просматривает секции всех лидов, публикует и экспортирует единый
   сводный отчёт (в том числе в PDF).
3. **admin** — администрирование: продукты, настройки, фоновые задачи.
4. **viewer** — открывает текущий доступный отчёт в режиме просмотра. В открытом
   периоде по умолчанию видит только отправленные секции, а через «Show all»
   может раскрыть остальные доступные ему секции. Опубликованные отчёты читаются из
   неизменяемого снимка, поэтому «Show all» к ним не применяется. Назначенный
   viewer также может выполнять review-действия (подтверждение, комментарий и
   verdict), но не изменяет содержание отчёта.

Ключевые термины («отчётный период», «submission», «архивный период» и т.д.)
строго определены в [`../CONTEXT.md`](../CONTEXT.md). Это не формальность: эти
слова фиксируют единый язык. Прочитай его до того, как
начнёшь спорить о названиях в коде или ревью.

## 2. Архитектура

Это монорепо на pnpm workspaces + Turborepo. Главные части:

- **`apps/web`** — фронтенд на Next.js 16 / React 19. App Router.
- **`apps/api`** — бэкенд на NestJS 11. Слой API — tRPC. Доступ к БД — Prisma.
- **`packages/shared`** — Zod-схемы, типы, enum-ы. Общий контракт между web и api.
- **`packages/report-persistence`** — серверный Prisma include/mapper и сборка
  immutable published snapshots, общая для API и seed-профилей.
- **`packages/migrator-runtime`** — зафиксированный manifest Prisma CLI и dotenv
  для production migration image; продуктового кода здесь нет.
- Production API собирается через изолированный `pnpm deploy --prod`. После
  deploy скрипт [`scripts/gates/production-deps-prune.ts`](../scripts/gates/production-deps-prune.ts)
  удаляет из virtual store миграторный и компиляторный payload по фактической
  symlink-достижимости и проверяет отсутствие битых runtime-ссылок. Поэтому
  Prisma CLI и TypeScript не попадают в API runner даже при peer-контекстах
  общего lockfile.
- **`packages/ui`** — компоненты shadcn/ui и токены Tailwind.
- **`prisma`** — схема БД, canonical migration history (init плюс только
  forward-only additive migrations), сиды,
  защитные guard-ы.
- **`openspec`** — спецификации поведения продукта (см. раздел 8).

Граница доменов на бэкенде — это Nest-модули (`apps/api/src/modules/*`) плюс
репозитории Prisma. Бизнес-логика живёт в сервисах модулей, а не в роутере.

## 3. Как данные ходят между web и api

Поток одного запроса с фронтенда:

1. Браузер вызывает tRPC-клиент. URL запроса — относительный `/trpc`
   (`apps/web/src/shared/lib/trpc/trpc.ts`), то есть same-origin к web-серверу.
2. Next.js по правилам из `apps/web/next.config.ts` (`rewrites`) проксирует
   `/trpc`, `/auth`, `/health`, `/api` на бэкенд через обязательный `API_URL`.
3. На бэкенде tRPC примонтирован как Express-middleware на `/trpc`
   (`apps/api/src/bootstrap/api-ingress.ts`), который вызывается bootstrap-слоем;
   роутер собирается в
   `apps/api/src/infrastructure/trpc/`.
4. Процедура вызывает сервис нужного модуля → Prisma → PostgreSQL.

Почему так, а не прямой вызов браузер→api: тот же origin упрощает куки/CORS, а
проброс через Next даёт единую точку входа. Типобезопасность сквозная — типы
роутера импортируются на фронт из `@customreport/api`.

## 4. Окружение и переменные

Файлы окружения:

- **Корневой `.env`** — единый native-контракт. Его явно загружают package
  scripts API и Web. Образец — `.env.example`, скопируй его в `.env`.
- **`apps/web/.env*` не требуется** для штатного запуска. Не создавай второй
  источник значений без отдельной причины: уже экспортированная shell-переменная
  имеет приоритет над корневым файлом.

Важная тонкость: переменные `NEXT_PUBLIC_*` должны быть доступны процессу web,
иначе браузер их не увидит. Например, `NEXT_PUBLIC_SENTRY_DSN` нужен в окружении
web, чтобы заработала корреляция ошибок с трейсами (см. раздел 6). В production
он компилируется в Web-образ, поэтому изменение требует новой сборки.

Локальный `pnpm observability:up` читает настройки overlay из корневого `.env`:
`GRAFANA_PORT` (по умолчанию `3003`), `GRAFANA_ADMIN_USER` (по умолчанию
`admin`) и обязательный `GRAFANA_ADMIN_PASSWORD`. Порты Grafana и Bugsink
(`BUGSINK_PORT`, по умолчанию `8000`) привязаны только к loopback. Для Bugsink
также обязателен `BUGSINK_SECRET_KEY`; значение из `.env.example` подходит
только для локального стека и должно быть заменено в общем окружении. Подробный
контракт — в [environment.md](environment.md).

Аутентификация локально:

- `AUTH_DEV_MODE=true` включает dev-вход через `/auth/dev-login`.
- `NEXT_PUBLIC_DEV_ROLE_SWITCHER=true` показывает переключатель ролей в UI.
- В продакшене dev-флаги запрещены — api не стартует с ними при
  `NODE_ENV=production` (защита в `apps/api/src/lib/dev-auth-fence.ts`). Там
  работает только Keycloak SAML.

Для проверки обратной связи с переключением ролей запусти отдельный локальный
контур:

```bash
pnpm dev:feedback
```

Команда включает dev-only панель Agentation и переключатель в верхнем меню. Через него
можно войти под любым сидированным Lead, Head, Admin или Viewer и выбрать
`Wipe + Reseed` для профилей minimal, demo, full или stress. Сброс остаётся
доступен только для точной одноразовой базы, принятой destructive guard;
первичную базу подготовь штатной командой из следующего раздела.

Agentation `3.0.2` отправляет sessions, annotations, статусы и threads в
same-origin backend WeeklyReport; источником истины остаётся PostgreSQL.
Штатный `agentation-mcp` `1.2.0` запускается только как MCP-клиент к этому
adapter API, без собственного HTTP-сервера и без локальной SQLite:

```bash
pnpm agentation:mcp
```

Команда эквивалентна
`agentation-mcp server --mcp-only --http-url http://127.0.0.1:3002/api/v1/agentation`.
Браузерная UI-аутентификация идёт через текущую WeeklyReport session-cookie;
MCP не получает эту cookie автоматически. Для агентского доступа adapter
должен принимать отдельный agent credential из переменной
`AGENTATION_API_KEY`, переданной через локальное окружение.
Adapter принимает этот ключ только от loopback-соединения; совпадающий ключ с
удалённого адреса получает отказ.
Само значение ключа не записывай в репозиторий, shell history,
конфигурацию агента или документацию. Пока ключ не настроен, MCP-команду можно
использовать только для локального контурного теста, не для production.

## 5. База данных

Обычные базы не считаются одноразовыми. Сброс и пересоздание разрешены только
для точной loopback-базы, которую принимает destructive guard.

Штатная локальная разработка из `.env.example` намеренно использует
`customreport_e2e`: это единственная seedable-база, которую guard считает
одноразовой. После запуска локальных Postgres и Redis выполни:

```bash
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай' \
  pnpm db:bootstrap:local demo
```

Команда проверяет, что `DATABASE_URL` и `E2E_DATABASE_URL` указывают на одну
точную loopback-базу, затем последовательно создаёт её, применяет миграции и
заливает выбранный профиль. Каждый шаг повторно проверяет guard и согласие;
при первой ошибке следующие шаги не запускаются.

После запуска локальных Postgres и Redis данные можно залить через
`pnpm db:seed:profile demo` с тем же явным согласием; корневой `.env` указывает
на loopback-порт этой базы.

Повторный `pnpm db:seed:profile full` сохраняет существующее состояние
AI-провайдеров и промптов. Управляющая запись провайдера создаётся выключенной,
только если её ещё нет. `Wipe + Reseed` сначала выполняет `prisma migrate reset`,
поэтому удаляет и это состояние перед заполнением выбранного профиля.

- Схема — `prisma/schema.prisma`. После init любые изменения оформляются
  отдельной forward-only additive Prisma migration и применяются через
  `prisma migrate deploy`; init и migration history должны оставаться
  синхронными. DB-native инварианты, которые Prisma не выражает, добавляются
  в соответствующую миграцию и закрепляются OpenSpec-контрактом.
- Профили bootstrap: `demo` для текущего продуктового набора и `stress` для
  проверки объёма данных.
  Внутренние seed-слои остаются деталями реализации.
- Единая публичная точка входа — `prisma/seeds/profiles/seed-profile.ts`; внутренние writers
  остаются раздельными.
- Защита операций с disposable-базой — `prisma/guards/_destructive-guard.ts`:
  exact guard
  принимает только loopback и точные базы `customreport_e2e` или
  `customreport_e2e_lane_[a-o]_test`, без query/fragment, кодированных или
  лишних path-сегментов. Для каждой операции нужен отдельный
  `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'`; `ALLOW_PROD_DESTRUCTIVE`
  этот guard не обходит.
- Локальные операции с одноразовой тестовой БД также используют этот exact
  guard. Production restore остаётся отдельным entrypoint, но требует того же
  явного одноразового согласия вдобавок к точному target и production-флагу.
- Redis требует явный `REDIS_DB`: обычная разработка использует логическую DB
  0, а одноразовые тестовые операции — зарезервированную DB 15. Очистка
  сначала выполняет `SELECT 15` и только затем `FLUSHDB`; DB 0 не очищается.

Подробные правила — в [`../AGENTS.md`](../AGENTS.md), разделы про disposable БД и
Docker-базы.

## 6. Наблюдаемость (логи, метрики, ошибки)

- При локальном запуске API пишет структурированные логи в
  `apps/api/.logs/app.log`. В production Compose файл находится в
  `/app/logs/app.log` внутри контейнера `api` и сохраняется в named volume
  `apilogs`. В обоих случаях записи содержат `traceId` и `spanId`, если они есть
  в контексте запроса.
- `GET /metrics` отдаёт внутренние метрики API. Production Caddy не публикует
  этот endpoint во внешний интернет.
- Sentry-совместимый сервис получает ошибки API и Web, когда заданы
  `SENTRY_DSN` и `NEXT_PUBLIC_SENTRY_DSN`. Для локальной диагностики команда
  `pnpm observability:up` добавляет Grafana/OTel и Bugsink в текущий Compose-
  проект и переиспользует его PostgreSQL, Redis и Mailpit без конкурирующих
  host-портов. Основной dev-стек остаётся работоспособным без overlay и DSN;
  `pnpm observability:down` удаляет только observability-сервисы.

## 7. Гейты и стиль кода

Перед коммитом должны быть зелёными шесть обязательных гейтов:

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm spec:check
```

Инструменты:

- **ESLint** (`eslint.config.ts`) — логический линт TS/JS. Строгие правила:
  `no-explicit-any: error`, `no-floating-promises: error`, неиспользуемые
  переменные — ошибка.
- **Prettier** (`.prettierrc.json`) — форматирование всего (TS/JS/JSON/CSS/YAML/
  Markdown); `pnpm format:check` проверяет результат.
- **stylelint** (`.stylelintrc.json`) — линт CSS.

Правила, о которые легко споткнуться:

- **UI-строки — только английские.** Имеется в виду хардкод в продакшен-коде
  фронта (`apps/web/src`): JSX, toast, aria-label, placeholder. Русский допустим
  как данные из БД/сидов/фикстур, в комментариях и тестах.
- **Conventional Commits**: `type: subject` (`feat`/`fix`/`refactor`/`docs`/
  `test`/`chore`), повелительное наклонение.
- Язык артефактов: код, комментарии, коммиты — английские; прозовые доки
  (`README`, `docs/**`, ADR) — на языке файла (русский допустим).

## 8. Рабочий процесс: OpenSpec

Изменения ведутся через OpenSpec — лёгкий процесс «сначала контракт, потом код».

- `openspec/specs/` — актуальные спецификации поведения продукта.
- `openspec list --specs` — список спецификаций.
- Каждое изменение валидируется до слияния с контрактами: `openspec validate <id> --strict`.

Типичный цикл: описать нетривиальное поведение → реализовать его → проверить
спецификацию и код.

Тесты живут рядом с продуктовым кодом. Корневой `pnpm test` запускает unit-тесты
workspace, Prisma-тесты и проверки repository cleanliness и operations. Он не
запускает интеграционные тесты API с базой данных: их запускают отдельно через
`pnpm --filter @customreport/api test:integration`.

Конфиги API `vitest.integration.config.ts` и `vitest.coverage.config.ts` загружают
`.env.test`; `apps/web/vitest.config.ts` этот файл не загружает. По MVP-политике
одной базы (решение владельца 2026-09-18, см. [`AGENTS.md`](../AGENTS.md#database-safety))
локальная разработка, тесты и E2E делят одну loopback-базу `customreport_e2e` —
образец [`.env.test.example`](../.env.test.example) несёт только E2E-цель.
Lane-базы не подготовлены и не должны создаваться без нового распоряжения
владельца. Каждой test/E2E-фазе предшествуют guarded reset и явный seed под
per-run согласием, чтобы фазы не наследовали чужое состояние: helper очистки
откажет, если `DATABASE_URL` отсутствует в окружении или указывает на ту же
базу, — интеграционные suites работают от reset-baseline, а не от cleanup. Для запуска очистки нужно отдельное согласие на эту операцию
через `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`; правила — в
[`AGENTS.md`](../AGENTS.md#database-safety).

Пользовательские сценарии проверяют в работающем приложении через реальный
браузер по разделу [Browser verification](../AGENTS.md#browser-verification):
перед действием называют ожидаемое наблюдаемое следствие и подтверждают его
DOM-, сетевыми наблюдениями или снимком экрана. Результат «неизвестно» или
«не удалось» успехом не считается; решающим критерием приёмки остаются
детерминированные проверки — unit/integration-тесты и гейты из раздела 7.

## 9. Отладка

- Локальные логи API — `pnpm logs` (хвост `apps/api/.logs/app.log`), только
  ошибки — `pnpm logs:errors`. Production-файл читается точным Compose-контуром:

  ```bash
  docker compose --env-file .env.production -f docker-compose.prod.yml exec api \
    tail -F /app/logs/app.log
  ```

  Стандартный поток контейнера доступен через ту же конфигурацию командой
  `docker compose --env-file .env.production -f docker-compose.prod.yml logs -f api`.
  В строках структурированного лога есть `traceId`/`spanId`.

- Трассировка запроса начинается со структурированного лога и его `traceId`.
- Ошибки с фронта и бэка — во внешнем Sentry.
- Сломалась локальная disposable-база или нужны другие демо-данные — останови
  API и повтори guarded bootstrap с профилем `demo`.
- `pnpm exec prisma generate`, если TypeScript «не видит» модель Prisma (клиент мог
  быть затёрт pnpm-операцией) — это регенерация, а не реальная ошибка.

## 10. Первые шаги

1. Запусти проект по «Быстрому старту» из README и зайди под каждой ролью через
   переключатель ролей.
2. Прочитай `CONTEXT.md` целиком — это язык, на котором написан проект.
3. Пройди один поток данных в коде: открой `apps/web/src/shared/lib/trpc/trpc.ts`, найди
   вызов процедуры, проследи его до сервиса модуля в `apps/api/src/modules/*` и
   до Prisma.
4. Открой нужную спецификацию поведения в `openspec/specs/`.
5. Перед любым PR прогоняй шесть гейтов из раздела 7.
