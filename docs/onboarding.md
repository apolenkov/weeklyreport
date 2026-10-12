# Онбординг разработчика

Гайд для того, кто впервые открыл этот репозиторий. Цель — быстро понять,
что это за проект, как он устроен, как его запустить и где что искать.

Если коротко: сначала прочитай [`README.md`](../README.md) и запусти проект по
разделу «Быстрый старт». Этот документ объясняет то, что стоит за командами.

## 1. Что за продукт

WeeklyReport автоматизирует еженедельные статус-отчёты отдела Development.

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
- **`apps/api`** — бэкенд на NestJS. Слой API — tRPC. Доступ к БД — Prisma.
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
роутера импортируются на фронт из `@weeklyreport/api`.

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

Локальные зависимости (Postgres с pgvector, Redis, Mailpit, Gotenberg) работают в
Kubernetes OrbStack, namespace `wr-dev`. `pnpm deps:up` применяет
`deploy/local-dev/deps.yaml`, `pnpm deps:down` останавливает поды, но не трогает
тома с данными; полный сброс — `kubectl delete namespace wr-dev`. OrbStack
публикует сервисы на localhost: Postgres `5432`, Redis `6379`, Mailpit SMTP
`1025` и UI `8025`, Gotenberg `3010`. Рендерер открывает печатную страницу
через алиас `host.internal`, поэтому в `.env` стоит
`PDF_BASE_URL=http://host.internal:3000`, а `GOTENBERG_URL=http://localhost:3010`.

Переход со старого Docker Compose: порты выше должны быть свободны. Останови
старые контейнеры `weeklyreport-postgres-1`, `-redis-1`, `-mailpit-1`,
`-gotenberg-1` (`docker stop`, без `down -v`), затем `pnpm deps:up` и заново
`pnpm db:bootstrap:local demo`: данные старого тома не переносятся, это
синтетическая база. Образец `.env` обновлён (`PDF_BASE_URL`, `GOTENBERG_URL`,
`OTEL_SDK_DISABLED=true`); перенеси эти строки в свой `.env`.

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
`Wipe + reseed` для профилей minimal, demo, full или stress. Сброс остаётся
доступен только для точной одноразовой базы, принятой destructive guard;
первичную базу подготовь штатной командой из следующего раздела.

Agentation `3.0.2` отправляет sessions, annotations, статусы и threads в
same-origin backend WeeklyReport; источником истины остаётся PostgreSQL.
Штатный `agentation-mcp` `1.3.2` запускается только как MCP-клиент к этому
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

Повторный `pnpm db:seed:profile full` сохраняет существующее состояние
AI-провайдеров и промптов. Управляющая запись провайдера создаётся выключенной,
только если её ещё нет. `Wipe + reseed` сначала выполняет `prisma migrate reset`,
поэтому удаляет и это состояние перед заполнением выбранного профиля.

По умолчанию ассистент в dev/e2e выключен: seed не создаёт конфигурацию
провайдера. Включить её можно opt-in шагом `prisma/seed-ai-provider.ts`,
который `db:seed:profile` запускает после writers любого профиля: если в
незакоммиченном окружении задана `E2E_AI_PROVIDER_API_KEY`, шаг создаёт одну
активную ревизию провайдера с ключом, зашифрованным штатным
`AesGcmCredentialCodec` (`AI_PROVIDER_CONFIG_ENCRYPTION_KEY` /
`AI_PROVIDER_CONFIG_KEY_VERSION`), и включает `AiProviderControl`. Тогда же
обязательны `E2E_AI_PROVIDER_BASE_URL` (origin должен входить в
`AI_PROVIDER_ALLOWED_ORIGINS`), `E2E_AI_PROVIDER_MODEL`,
`E2E_AI_PROVIDER_EMBEDDING_MODEL` и `E2E_AI_PROVIDER_EMBEDDING_DIMENSIONS`.
Без ключа шаг завершается без записей, и ассистент остаётся выключенным.
Для реальных ответов дополнительно нужен
`REPORT_ASSISTANT_OUTBOUND_DATA_APPROVED=true` в окружении API. Значение ключа
никуда не коммитится; в лог выводится только masked-суффикс.

- Схема — `prisma/schema.prisma`. После init любые изменения оформляются
  отдельной forward-only additive Prisma migration и применяются через
  `prisma migrate deploy`; init и migration history должны оставаться
  синхронными. DB-native инварианты, которые Prisma не выражает, добавляются
  в соответствующую миграцию и закрепляются OpenSpec-контрактом.
- Профили bootstrap: `minimal`, `demo` (текущий продуктовый набор), `full` и
  `stress` (проверка объёма данных).
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
  0, а одноразовые тестовые операции — DB, закреплённую за базой: 15 для
  `customreport_e2e`, 1..12 для lane a..l (`customreport_e2e_lane_a_test` → 1,
  `..._b_` → 2, …). Очистка сначала выполняет `SELECT <DB>` и только затем
  `FLUSHDB`; DB 0, 13, 14 и чужие DB не очищаются.

Подробные правила — в [`../AGENTS.md`](../AGENTS.md), раздел
**Database safety**.

## 6. Наблюдаемость (логи, метрики, ошибки)

- При локальном запуске API пишет структурированные логи в
  `apps/api/.logs/app.log` (без ротации). В production Kubernetes API пишет
  в stdout, ротацию делает kubelet. В обоих случаях записи содержат `traceId` и
  `spanId`, если они есть в контексте запроса.
- `GET /metrics` отдаёт внутренние метрики API. Production Caddy не публикует
  этот endpoint во внешний интернет.
- Sentry-совместимый сервис получает ошибки API и Web, когда заданы
  `SENTRY_DSN` и `NEXT_PUBLIC_SENTRY_DSN`. Локального стека Grafana/OTel и
  Bugsink в репозитории нет; дашборды и правила алертов лежат в
  `deploy/helm/weeklyreport/observability/` как материал для DevOps. Dev-запуск
  работает без DSN и без коллектора.

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

Единственный унаследованный список исключений —
[`eslint-suppressions.json`](../eslint-suppressions.json), только для правил
`max-lines-per-function` и `max-params`. Его разрешено только сокращать:
не добавляйте записи или правила и не увеличивайте счётчики. После исправления
нарушений удалите ненужные исключения, отформатируйте список и повторите проверку:

```bash
pnpm lint:eslint --prune-suppressions
pnpm exec prettier --write eslint-suppressions.json
pnpm lint:eslint
```

Обычный `pnpm lint:eslint` завершается с ошибкой, если в списке остались ненужные
исключения.

Правила, о которые легко споткнуться:

- **UI-строки — только английские.** Имеется в виду хардкод в продакшен-коде
  фронта (`apps/web/src`): JSX, toast, aria-label, placeholder. Русский допустим
  как данные из БД/сидов/фикстур, в комментариях и тестах.
- **Conventional Commits**: формат и типы — в
  [`CONTRIBUTING.md`](../CONTRIBUTING.md#commit-conventions), повелительное
  наклонение.
- Язык артефактов: код и коммиты — английские; комментарии — английские или
  русские; прозовые доки (`README`, `docs/**`, ADR) — на языке файла (русский
  допустим).

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
`pnpm --filter @weeklyreport/api test:integration`.

Конфиги API `vitest.integration.config.ts` и `vitest.coverage.config.ts` загружают
`.env.test`; `apps/web/vitest.config.ts` этот файл не загружает. По MVP-политике
одной базы (решение владельца 2026-09-18, см. [`AGENTS.md`](../AGENTS.md#database-safety))
обычная локальная разработка и последовательные тесты используют loopback-базу
`customreport_e2e` —
образец [`.env.test.example`](../.env.test.example) несёт только E2E-цель.
Для изолированных приёмочных запусков базы `customreport_e2e_lane_a_test` и
`customreport_e2e_lane_b_test` уже существуют; пользоваться ими можно только
после проверки владельца процесса и точного адреса. Остальные lane-базы не
подготовлены и не должны создаваться без нового распоряжения владельца.
Каждой test/E2E-фазе предшествуют guarded reset и явный seed с механическим
токеном, чтобы фазы не наследовали чужое состояние: helper очистки
откажет, если `DATABASE_URL` отсутствует или указывает на другой host, порт
или имя базы. Интеграционные suites работают от reset-baseline, а не от cleanup.
Для запуска очистки на каждой команде нужен механический токен
`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай'`; повторное разрешение
владельца для указанной одноразовой цели не требуется. Правила — в
[`AGENTS.md`](../AGENTS.md#database-safety).

Пользовательские сценарии проверяют в работающем приложении через реальный
браузер по разделу [Browser verification](../AGENTS.md#browser-verification):
перед действием называют ожидаемое наблюдаемое следствие и подтверждают его
DOM-, сетевыми наблюдениями или снимком экрана. Результат «неизвестно» или
«не удалось» успехом не считается; решающим критерием приёмки остаются
детерминированные проверки — unit/integration-тесты и гейты из раздела 7.

## 9. Отладка

- Локальные логи API — `pnpm logs` (хвост `apps/api/.logs/app.log`), только
  ошибки — `pnpm logs:errors`. Production-логи читаются из stdout контейнера:

  ```bash
  kubectl -n <ns> logs -f deployment/api -c api
  ```

  Лог миграций доступен через `kubectl -n <ns> logs deployment/api -c migrate`.
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
