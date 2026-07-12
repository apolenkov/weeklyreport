# Repo-Excellence Review — CustomReport

## 1. Итог

**Состояние репозитория: RED. К проду не готов.**

Счёт после сверки с консилиумом:

- P0 — **7** (конфиденциальность, целостность данных, блокеры деплоя)
- P1 — **17** (16 из backlog + 1 от консилиума)
- P2 — **22** (18 из backlog + 4 от консилиума)
- P3 — **5**
- Всего — **51**

Почему RED, а не YELLOW:

- Семь P0 — не косметика. Это утечка данных между группами, порча инварианта периода, тихая потеря отчётного контента, битый PDF в прод-образе.
- Три P0 — прямые блокеры релиза: PDF-экспорт не запускается в собранном образе (BL-06), reopen мёртв и одновременно обходится на submit (BL-01), immutable-снапшот собирается вне транзакции (BL-08, формально P1, но рядом с публикацией).
- Auth-stub и dev-role-switcher могут запечься в прод-образ при любой сборке мимо одного конкретного compose-файла (BL-21).

Что хорошо (чтобы не только про плохое):

- Sibling-пути уже делают правильно — `publishCompareAndSet`, zone-aware `PolicyApplicatorService`, rate-limited `/api/web-vitals`, `useDialogFocus`. Большинство P0/P1 — это места, отставшие от уже существующего в репозитории эталона, а не отсутствие эталона.
- Ложных срабатываний по существу консилиум не нашёл (единственная претензия — по строгости, не по факту).

**Production-readiness: NOT READY.** До первой прод-точки обязательны все P0 и деплой-класс P1 (BL-06, BL-11, BL-14, BL-20, BL-21, CN-01).

---

## 2. P0 + P1 (таблица)

| ID    | Заголовок                                                                                   | Подсистема                  | Ключевой файл                         | Рекомендация (одной строкой)                                                                                                   |
| ----- | ------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| BL-01 | Write-гейты читают legacy-`status`: reopen мёртв, submit не защищён                         | api/report-sections         | report-sections.service.ts            | Гейтить и saveDraft, и submitSection по `periodStatus` (reject только `published`); добавить already-submitted guard на submit |
| BL-02 | reopen гонится с archive и рвёт dual-state                                                  | api/period                  | period.prisma-repository.ts           | Провести reopen через guarded compare-and-set (`where:{archived:false, periodStatus:'published'}`), count===0 → fail-closed    |
| BL-03 | lead-form read: утечка cross-group и не-product-scoped контента                             | api/report-sections (authz) | lead-form.service.ts                  | Гейтить head-ветку `byPeriod` через `groupScopeFilter`; в cross-author линзе `activities:[]` + drop `reviews`                  |
| BL-04 | carry-over не идемпотентен: FK-креш на гонке + тихая потеря items                           | api/carry-over              | carry-over.prisma-repository.ts       | В existing-ветке пере-читать и вернуть существующую execution; пере-валидировать editability внутри транзакции                 |
| BL-05 | verdict фиксирует `judgedVersion` от версии, которую ревьюер не видел                       | api/review                  | review-actions.service.ts             | Писать `judgedVersion` из `input.version`; optimistic lock на verdict для approved И changes_requested                         |
| BL-06 | Прод-образ везёт Playwright 1.59.1, воркспейс — 1.61.0: Chromium не стартует                | deploy/pdf-export           | Dockerfile.api                        | Синхронизировать тег образа и зависимость (`v1.61.0-noble` либо откат playwright к 1.59.x)                                     |
| BL-07 | print рисует вечный спиннер при ошибке; воркер снимает его как готовый PDF                  | web/print + api/pdf-export  | print-report-template.tsx             | Терминальное error-state (не LoadingShell); ready/error-контракт для воркера перед `page.pdf()`                                |
| BL-08 | Публикация собирает снапшот вне транзакции; одна ветка теряет правки секций                 | api/publication             | publication.prisma-repository.ts      | Обернуть CAS+сборку снапшота в `$transaction` с пере-чтением; удалить/дописать unreachable `saveAssembledReport`               |
| BL-09 | Рассылка напоминаний нетранзакционна: дубли на retry, `queued`-сироты без reaper            | api/reminders + bullmq      | email-reminder.processor.ts           | Идемпотентный send (mark `sending`/проверка статуса) + outbox/reaper для зависших `queued`                                     |
| BL-10 | Restore снапшота теряет `ReportingGroup.headUserId`                                         | api/admin                   | admin-snapshot-write.queries.ts       | Второй проход по `snapshot.groups` после `upsertUsers` для `headUserId` (FK уже есть)                                          |
| BL-11 | Публичный `/api/client-logs` без auth и rate-limit пишет в общий app.log                    | api/bootstrap (security)    | main.ts                               | Per-IP limiter перед хендлером (паттерн `createRateLimits` от web-vitals)                                                      |
| BL-12 | Analytics: неэффективный leadId-фильтр, нет dedup по period-label, небезопасный nested hash | api/analytics               | analytics.prisma-repository.ts        | `leadFilter` в `include.sections.where`; группировать `leadVelocity` по `periodLabel`; рекурсивный stable-stringify            |
| BL-13 | `wipe-manual-uat` не чистит project-activity → FK-откат всего wipe+reseed                   | prisma/scripts              | wipe-manual-uat.ts                    | Вставить activity-удаления в FK-безопасном порядке (как seed-simple) или перейти на TRUNCATE CASCADE                           |
| BL-14 | Redis readiness-клиент без fail-fast → `/health/ready` виснет при падении Redis             | api/health                  | redis.health.ts                       | `maxRetriesPerRequest:1`, `enableOfflineQueue:false`, `on('error')` (как cache-клиент)                                         |
| BL-15 | trends пришит к жёстким границам 2026 → после 2026 все графики пусты                        | web/reports                 | trends/page.tsx                       | Выводить окно из текущей даты (rolling 12 мес.) или из min/max данных. _(GLM: severity спорна — см. §4)_                       |
| BL-16 | Форма org-identity затирает несохранённые правки и рапортует успех при провале revalidate   | web/organization            | settings-identity-sub-tab.tsx         | Re-seed только при `!isDirty`; проверять `response.ok` + try/catch, отдельный toast на провал revalidate                       |
| BL-17 | Дубли в `linkedProductIds` дают непрозрачный 500 вместо 400                                 | api/project-activity        | project-activity.prisma-repository.ts | `.refine` на уникальность на границе схемы; `skipDuplicates:true` как defense-in-depth                                         |
| BL-18 | Cross-group audit на published-ветке считается от live-списка, теряет snapshot-only данные  | api/weekly-report (audit)   | weekly-report.prisma-repository.ts    | Сигнал считать от продуктов, реально отданных в снапшоте (owner-group заморожен на publish)                                    |
| BL-19 | Backfill игнорирует timezone политики и перетирает DST-корректный fireAt                    | prisma/scripts + reminders  | backfill-policy-rules.ts              | Считать fireAt zone-aware как `PolicyApplicatorService` (luxon); вынести общий чистый helper                                   |
| BL-20 | `@api` matcher Caddy без `/api/*` → beacon идёт вторым хопом через web                      | deploy/caddy                | Caddyfile                             | Добавить `/api /api/*` в `@api` в Caddyfile И Caddyfile.staging (см. CN-03)                                                    |
| BL-21 | Dockerfile.web запекает dev-auth + role-switcher в прод-бандл                               | deploy/config-secrets       | Dockerfile.web                        | Безопасные значения сделать дефолтами Dockerfile (`false`), dev/compose переопределяет в `true`                                |
| BL-22 | Empty-state и счётчик берутся из нефильтрованного источника (2 компонента)                  | web/admin + review          | action-log-tab.tsx, reopen-tab.tsx    | Считать empty-state и count от filtered/visible; различать «нет строк» и «нет по поиску»                                       |
| BL-23 | Lead-slides не клампит `selectedIndex` → ложное «No slides available»                       | web/slides                  | lead-slides-client.tsx                | Кламп-эффект на `[selectedIndex, slides.length]` (как в HeadSlidesClient)                                                      |
| CN-01 | Redis noeviction + 256 MB: OOM в write-path BullMQ = каскадный отказ, не shed               | deploy/infra                | docker-compose.prod.yml               | `allkeys-lru`/`volatile-lru` (данные восстановимы из execution-строк) + алерт на 80% + DLQ-reaper. _Источник: консилиум/Qwen_  |

---

## 3. P2 / P3 — сжато

### P2 (22)

**Наблюдаемость / логи**

- BL-24 — DI-фабрики строят сервисы без APP_LOGGER → info-логи admin/pdf/reminders немы в проде.
- BL-33 — PII (email получателя) пишется в логи вопреки политике userId-not-email.
- BL-32 — прод-трейсинг фактически выключен (0.1 non-ParentBased, нет OTLP endpoint/коллектора).
- CN-04 — pgbouncer healthcheck проверяет только TCP; Dockerfile.api HEALTHCHECK на `/health/live` расходится с compose `/health/ready`. _(консилиум/Qwen)_

**Конфиг / no-fallback**

- BL-25 — прод-конфиг читается из `process.env` с тихими дефолтами вместо валидированного EnvConfig (худший — PDF_OUTPUT_DIR пишет туда, где ничего не отдаётся).
- CN-05 — env.schema не требует `KEYCLOAK_SAML_*` при `AUTH_DEV_MODE=false` в проде → поздний отказ на первом логине. _(консилиум/GLM)_
- BL-30 — `projectStatuses`/`stageStatuses` без `.max()`, который есть у соседних массивов.

**Безопасность / деплой**

- BL-34 — нет серверного merge-gate: CI dispatch-only, 0 раннеров, pre-push — обходимый subset.
- BL-37 — CSRF-able logout, over-broad revalidate-org, непроверенный logout-redirect.
- BL-38 — CSP только Report-Only без report-uri; limiters на MemoryStore; образы по mutable-тегу, не по `@sha256` (+ compose-сервисы, консилиум/GLM).
- CN-02 — tRPC express-адаптер без bound на размер тела запроса. _(консилиум/Qwen)_
- CN-03 — Caddyfile.staging без HSTS и CSP вовсе + тот же `/api`-gap, что BL-20. _(консилиум/Qwen)_

**Корректность / архитектура**

- BL-28 — search `ts_headline` считается на всех WHERE-строках, не только на post-LIMIT.
- BL-40 — stage-assignment reassign гонится на unique-constraint → 500.
- BL-41 — CarryOver-таблицы (+ 2 review-FK) без индекса на cascade/FK-колонках.
- BL-35 — TelegramProcessor руками повторяет raw-Worker lifecycle вместо базового класса; дублирует job-options-константу.
- BL-29 — presentation-типы импортятся из mock/legacy-модулей, маскируя реальный drift.
- BL-27 — full-reload anchors, дубль serial `auth.me`, per-product N+1.
- BL-26 — half-built keyboard/focus a11y в нескольких диалогах + period-listbox вместо общего примитива.
- BL-31 — dead code: осиротевший дубль reminders-router + неиспользуемые web-хелперы/валидаторы.
- BL-36 — canonical seed не даёт paused/postponed и не гоняет coverage-guard.
- BL-39 — пробелы тестов на двух самых логикоёмких/security-relevant repo-путях (activity, archive cross-group isolation).

### P3 (5)

- BL-42 — микро-перф на hot-path (org-upsert write-herd, serial `reminderPolicy.count`, over-fetch на published-read).
- BL-43 — археология в комментариях/тайтлах тестов (Phase/UFB/SDLC-теги).
- BL-44 — дублированные типы/константы, которые надо централизовать (OrganizationBrand ×3, палитра чартов, role-list).
- BL-45 — пачка мелких react/correctness-нитов (usePauseReason в updater, autosave badge на green, slides-fallback на edit-route и т.д.).
- BL-46 — устаревшие/вводящие в заблуждение комментарии и косметика (403-copy зовёт dev-only switcher в проде).

---

## 4. Консилиум

**Ответили 2 из 4.**

- **Codex** — недоступен (watchdog 600s, ни одной `item.completed`; tooling-фейл, не результат).
- **Kimi** — недоступен (opencode-go таймаут 900s; известный паттерн `council-workflow-opencode-timeouts`).
- **Qwen** — доступен: 0 ложных срабатываний, 6 «missed».
- **GLM** — доступен: 1 претензия по строгости (BL-15), 2 «missed».

**Согласия.** Оба ответивших спот-чекнули ядро backlog против реального кода и подтвердили: Qwen — BL-01/02/06/11/14/15/20/21; GLM — BL-01/05/06/07/20/21/32/34. Противоречий листингу ни один не нашёл. Уверенность в P0/P1 высокая.

**Единственный конфликт — BL-15.** GLM зовёт это false positive «по строгости»: окно 2026-01-01…2026-12-31 сегодня (2026-07-12) валидно, страница dev-only, прод-точки нет ещё → P2/P3, не P1.

Разбор: это не опровержение факта — GLM сам признаёт, что баг (жёсткий год) существует и выстрелит 2027-01-01. Это спор о severity. По правилу «majority ответивших» нужно 2 из 2 для демоушена — здесь 1 из 2. **Оставляю BL-15 как подтверждённый Claude баг, но фиксирую дессент GLM: до прод-точки severity можно читать как P2.** Time-bomb остаётся time-bomb.

**Council-only, поднято в backlog:**

- **CN-01** (Qwen, High → P1) — Redis `noeviction` + 256 MB: при упоре в потолок каждый write BullMQ (LPUSH/HSET/ZADD) возвращает OOM → enqueue/complete/fail встают, PDF и reminders халтят без graceful degradation. Самый серьёзный council-only; поднял до P1.
- **CN-02** (Qwen, P2) — tRPC express-адаптер без `maxBodySize`; сосед `/api/client-logs` явно ставит `128kb`, tRPC полагается на недокументированный дефолт.
- **CN-03** (Qwen, P2) — Caddyfile.staging без HSTS и CSP вовсе (прод-Caddyfile их несёт) + тот же `/api`-gap. Часть сворачивается в BL-20.
- **CN-04** (Qwen, P2) — pgbouncer healthcheck только TCP (`/health/ready` рапортует UP, пока все Prisma-запросы таймаутят); Dockerfile.api HEALTHCHECK `/health/live` vs compose `/health/ready` — standalone `docker run` едет с liveness-only.
- **CN-05** (GLM, P2) — env.schema не форсит `KEYCLOAK_SAML_*` при `AUTH_DEV_MODE=false` в проде; голый прод-boot без SAML-env поднимается и падает поздно на первом логине.
- **Свёрнуто в существующие:** staging `/api`-matcher → BL-20; digest-пиннинг compose-сервисов (GLM) → расширение BL-38.

Двумя+ членами ни один council-only не поднят (только 2 ответили), так что boost «2+» не применялся.

---

## 5. Что НЕ сочли проблемой

- **Ложных срабатываний по существу нет.** Единственная претензия (GLM → BL-15) — про severity, не про факт; баг подтверждён, оставлен (см. §4).
- **Codex-семена не тянутся** — Codex вообще не выдал вердикта (таймаут), так что stale-seed для отсева нет.
- **Осознанно вне scope (репо-конвенции, а не дефекты):**
  - MVP-постура CI (dispatch-only, pre-push subset) задокументирована как принятая — вынесена в BL-34 как долг к прод-точке, но это не «скрытый» баг.
  - Stateless-logout окно 1h (BL-37) — стандартный tradeoff JWT; рекомендация — задокументировать, а не чинить revocation без jti.
  - Deferred hardening (CSP flip, redis-backed limiters, `@sha256` — BL-38) уже помечено TODO в коде; это релиз-блокеры, но не «незамеченный» долг.
  - `dev.listUsers` (trpc.router.ts:420) — GLM подтвердил runtime-guard на `AUTH_DEV_MODE===true`, не unauth-утечка. Не заводим.
  - `trpc.context` синтетический PDF-export userId не-UUID (BL-46) — безвреден (колонки TEXT), только комментарий врёт.

---

## 6. Рекомендованный порядок OpenSpec-изменений

Всё ниже — `alreadyTracked:false`; в `openspec/specs/` не покрыто. Порядок: сначала конфиденциальность/целостность/блокеры деплоя, затем прочие P1, затем тематические чистки P2/P3.

**Волна 0 — P0 (блокеры прод-точки, каждый — отдельное изменение):**

1. `fix-report-section-write-gates` — гейтить saveDraft+submit по periodStatus, оживить reopen, закрыть submit-обход (BL-01).
2. `guard-period-reopen-cas` — reopen через guarded compare-and-set, fail-closed на count===0 (BL-02).
3. `close-leadform-read-leaks` — group-scope head-ветки byPeriod + сузить cross-author линзу (BL-03).
4. `idempotent-carry-over` — идемпотентная existing-ветка + re-валидация editability в транзакции (BL-04).
5. `review-verdict-version-lock` — judgedVersion из input + optimistic lock на оба вердикта (BL-05).
6. `sync-playwright-prod-image` — синхронизировать тег образа и зависимость playwright (BL-06).
7. `print-error-state-and-pdf-readiness` — терминальное error-state + ready-контракт воркера (BL-07).
8. `dockerfile-web-fail-safe-auth-defaults` — безопасные дефолты в Dockerfile, dev override (BL-21; безопасность-критичный, тянуть в волну 0).

**Волна 1 — P1 (целостность данных, деплой-safety, инфра):**

9. `atomic-publish-snapshot` — CAS+снапшот в одной транзакции; удалить unreachable путь (BL-08).
10. `reliable-reminder-delivery` — идемпотентный send + outbox/reaper (BL-09).
11. `redis-write-path-resilience` — политика вытеснения + алерт памяти + DLQ-reaper (CN-01).
12. `rate-limit-public-endpoints` — limiter на /api/client-logs + bound на тело tRPC (BL-11, CN-02).
13. `caddy-api-routing-and-staging-headers` — `/api/*` в @api обоих Caddyfile + HSTS/CSP в staging (BL-20, CN-03).
14. `fix-analytics-query-correctness` — leadId-фильтр, period-label dedup, stable-stringify (BL-12).
15. `fix-wipe-uat-activity-tables` — activity-удаления в FK-порядке или TRUNCATE CASCADE (BL-13).
16. `redis-health-failfast` — fail-fast опции readiness-клиента (BL-14).
17. `dynamic-trends-window` — окно из текущей даты/данных (BL-15).
18. `fix-org-settings-form-safety` — dirty-guard re-seed + проверка revalidate (BL-16).
19. `dedup-linked-products` — refine-уникальность на границе схемы (BL-17).
20. `fix-published-crossgroup-audit` — сигнал от snapshot-продуктов (BL-18).
21. `fix-policy-backfill-timezone` — zone-aware fireAt через общий helper (BL-19).
22. `fix-list-empty-state-source` — count/empty от filtered в двух компонентах (BL-22).
23. `clamp-lead-slides-index` — кламп selectedIndex (BL-23).
24. `admin-snapshot-head-restore` — второй проход для headUserId (BL-10).

**Волна 2 — P2 (наблюдаемость, конфиг, hardening, корректность):**

25. `inject-app-logger-di` — APP_LOGGER в фабрики admin/pdf/reminders (BL-24).
26. `env-config-no-fallback-sweep` — читать из EnvConfig, форсить SAML-env в проде (BL-25, CN-05).
27. `deploy-observability-and-tracing` — прод-коллектор+OTLP, ParentBased sampler, глубокие healthcheck'и (BL-32, CN-04).
28. `redact-pii-logs` — убрать/маскировать email, redaction-helper (BL-33).
29. `server-side-merge-gate` — раннер + required checks; сложить дешёвые гейты в pre-push (BL-34).
30. `prod-security-hardening` — CSP→enforcing, redis-backed limiters, `@sha256` digest (Dockerfile+compose) (BL-38).
31. `auth-session-hardening` — CSRF-check logout, admin-gate revalidate, ok-check redirect (BL-37).
32. `bound-section-save-arrays` — .max() на projectStatuses/stageStatuses (BL-30).
33. `search-headline-post-limit` — rank+LIMIT до ts_headline (BL-28).
34. `carry-over-fk-indexes` — индексы на cascade/FK-колонки (BL-41).
35. `stage-assignment-upsert` — атомарный upsert по composite unique (BL-40).
36. `telegram-processor-baseclass` — extend RawBullMqProcessor + общая job-options (BL-35).
37. `web-type-ssot-drift` — импорты на реальные domain-модели, снять `as`-каст (BL-29).
38. `web-nav-and-query-perf` — next/link, снять дубль RoleGate, batched ownership-эндпоинт (BL-27).
39. `a11y-dialog-listbox-cluster` — общий useDialogFocus + scrollIntoView + ARIA (BL-26).
40. `remove-dead-code` — удалить/подключить осиротевшее (BL-31).
41. `seed-coverage-paused-postponed` — добавить состояния + assertSeedCoverage в seed.ts (BL-36).
42. `test-coverage-activity-archive` — кейсы на getLiveActivity ветки + archive cross-group isolation (BL-39).

**Волна 3 — P3 (чистки, батчабельно):**

43. `micro-perf-hot-paths` — org-upsert, serial count, over-fetch (BL-42).
44. `comment-hygiene-archaeology` — снять Phase/UFB/SDLC-теги (BL-43).
45. `centralize-duplicated-types` — OrganizationBrand, палитра, role-list в shared (BL-44).
46. `web-polish-lows` — пачка react/correctness-нитов (BL-45).
47. `fix-stale-comments` — привести комментарии/403-copy к текущей правде (BL-46).
