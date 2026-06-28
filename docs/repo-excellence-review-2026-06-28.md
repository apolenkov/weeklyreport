## Итог-ревью CustomReport: финальный отчёт

**Здоровье репозитория: КРАСНОЕ. К продакшену не готов.**

Счёт находок после сверки с консилиумом:

- P0 (блокеры): 11
- P1 (серьёзные): 22
- P2 (важные): 22
- P3 (мелкие): 5
- Всего: 60 пунктов.

Почему красное, в трёх фразах:

1. Несколько путей сборки/деплоя ломают сам прод (dev-логин в проде, PDF 404, trust-proxy).
2. Открыты реальные дыры авторизации и XSS, доступные обычному пользователю.
3. Есть тихая потеря данных (carry-over, save секции, snapshot-restore) без сетки тестов.

Главный системный риск: CI спит, серверного гейта нет.
Сломанное по типам или авторизации может уехать в `main` без единой проверки.

---

### 1. Что считать перед запуском

Прод нельзя включать, пока не закрыты все P0.
Минимум P0 — это безопасность, потеря данных и неработающий вход/экспорт.

Особое внимание: четыре P0 — это чисто деплой-сборка.
Они не видны в локальной разработке и всплывут только на боевом контуре.

---

### 2. Таблица P0 + P1

| #     | Заголовок                                                                                   | Подсистема                   | Ключевые файлы                                                            | Что сделать                                                                                                |
| ----- | ------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| P0-1  | Carry-over теряет данные и падает на нерешённых решениях                                    | api/carry-over               | carry-over.prisma-repository.ts, carry-over.service.ts                    | Писать `stageNames` массивом; пройти по ВСЕМ секциям; добавить `priorityRank`+`stageNames`; ловить P2002   |
| P0-2  | `trust proxy` не выставлен: rate-limit и audit-IP схлопываются за Caddy                     | api/bootstrap                | main.ts, rate-limit.middleware.ts, trpc.context.ts                        | `expressApp.set('trust proxy', 1)` до middleware; убрать ложный комментарий; тест на X-Forwarded-For       |
| P0-3  | PDF 404 в проде: `/pdfs` не маршрутизируется на API на edge                                 | deploy/caddy                 | Caddyfile, Caddyfile.staging, next.config.ts                              | Добавить `/pdfs /pdfs/*` в `@api` в обоих Caddyfile и в rewrite                                            |
| P0-4  | Прод-образ web печёт dev-auth: вместо SSO показан dev-пикер                                 | deploy/docker                | Dockerfile.web, docker-compose.prod.yml, login-page.client.tsx            | Передать прод build-args (AUTH_STUB=false, API_URL=public); guard по NODE_ENV                              |
| P0-5  | Аналитика отдаёт чужие группы любому авторизованному                                        | api/analytics                | analytics.prisma-repository.ts, analytics.service.ts, trpc.router.ts      | Прокинуть `ctx.session`, применить `groupScopeFilter` как в compiledHistory; тест на scope                 |
| P0-6  | `leadForm.revoke`/`revokeAllSubmitted`: глава правит чужие группы (BOLA)                    | api/report-sections          | lead-form.service.ts, lead-form.prisma-repository.ts                      | Добавить `author.reportingGroupId in allowedIds` в load/updateMany как в respondReopenRequest              |
| P0-7  | Open redirect на `next` (обход через backslash) и dev-login redirect                        | web + api/auth               | login-page.client.tsx, auth.routes.ts                                     | Валидировать через `new URL` + сверку origin; переиспользовать SAML-guard для dev-login                    |
| P0-8  | Stored XSS: org-данные в `<script>` через сырой JSON.stringify                              | web/app                      | layout.tsx                                                                | Экранировать `<` и `/` или serialize-javascript; лучше передавать пропом; валидировать charset на схеме    |
| P0-9  | Save секции = delete/recreate без оптимистичной блокировки: потеря правок                   | api/report-sections + prisma | report-sections.prisma-repository.ts, schema.prisma                       | Добавить `version`, условный `updateMany`, 409 при count===0; не доверять клиентским id                    |
| P0-10 | Авто-публикатор воскрешает архивированный период в published                                | api/period                   | auto-publisher.scheduler.ts, period-transition.ts                         | Добавить `archived:false` в кандидаты (как у авто-архиватора); спека `period-dual-state`                   |
| P0-11 | PDF-артефакты доступны без авторизации на host-порту API (консилиум)                        | deploy + api/pdf-export      | main.ts, docker-compose.prod.yml, Caddyfile                               | Отдавать PDF через авторизованный эндпойнт (проверка `requestedBy`+scope) или убрать host-публикацию порта |
| P1-1  | PDF-экспорт и Bull Board минуют проверку деактивации/отзыва                                 | api/auth                     | trpc.context.ts, bull-board.module.ts                                     | Вынести проверку isRevoked+isActive в общий helper, звать в обоих местах                                   |
| P1-2  | Публикация check-then-write (TOCTOU): двойной счёт метрик, устаревший activeReportId        | api/publication + period     | publication.service.ts, period.service.ts                                 | Compare-and-set `updateMany where status!=published`; метрика только при count===1                         |
| P1-3  | Голова любого может публиковать/реоупенить произвольный reportId (консилиум: Codex)         | api/period                   | trpc.router.ts, period.service.ts                                         | Брать цель из активного scope-периода; reject archived; произвольный reportId — только admin               |
| P1-4  | Reminder dispatch/list/execute — head-процедуры без scope (консилиум: Codex)                | api/reminders                | trpc.router.ts                                                            | Прокинуть `ctx.session`; для не-admin head применить `groupScopeFilter` на ruleId/reportId/leadId          |
| P1-5  | Баги сравнения дат: Trends-сравнение и история пусты/неверны                                | api/analytics                | analytics.prisma-repository.ts, schemas/analytics.ts                      | Сравнивать периоды диапазоном дня; реальный парс даты вместо regex; агрегировать по всем отчётам метки     |
| P1-6  | Эскалация-дайджест не срабатывает для опоздавших; dedupe неатомарен                         | api/reminders                | reminders.prisma-repository.ts, reminders.service.ts                      | Брать получателя по РОЛИ head, а не publishedBy; insert-on-conflict как atomic-guard; enqueue после commit |
| P1-7  | Доменные отказы как plain Error всплывают как 500 «Unexpected error»                        | api/error-mapping            | lead-form.service.ts, admin-\*.queries.ts, trpc.error-mapper.ts           | Кидать типизированные ошибки; добавить ветки CONFLICT/NOT_FOUND/FORBIDDEN в mapDomainError                 |
| P1-8  | Snapshot-restore: не в транзакции, разрушительный reconcile                                 | api/admin                    | admin-snapshot-write.queries.ts, snapshot-admin.service.ts                | Обернуть фазы в `$transaction`; точечный upsert/delete по id вместо полного reconcile                      |
| P1-9  | Уникальность периода — app-level TOCTOU; обещанного unique-индекса нет                      | prisma + api/admin           | init/migration.sql, schema.prisma, admin-period.queries.ts                | Добавить partial unique index (или убрать ложный комментарий); ловить P2002 в ensureWeeklyReport           |
| P1-10 | `/web-vitals`: неавторизованный, без валидации, неверный инструмент                         | api/observability            | web-vitals.controller.ts, web-vitals.metrics.ts                           | DTO + ValidationPipe; whitelist navigationType; Gauge→Histogram; throttle/auth                             |
| P1-11 | `/metrics` публичен и неавторизован на edge                                                 | api/metrics + deploy         | metrics.controller.ts, Caddyfile                                          | Убрать `/metrics` из публичного `@api` (скрейп только во внутренней сети) или basicauth/allowlist          |
| P1-12 | DB-гейджи валят весь скрейп `/metrics` при сбое БД                                          | api/telemetry                | telemetry.gauges.ts                                                       | try/catch в collect-callback: при сбое лог + не ставить гейдж                                              |
| P1-13 | datetime-local дедлайна парсится как локальное: дрейф при ре-сейве                          | web/admin                    | periods-tab-dialog.tsx                                                    | Парсить как UTC (`+ ':00.000Z'`); консилиум: то же для periodStart/periodEnd                               |
| P1-14 | Risk-диалог несохраняем при нуле стадий; поля стадий принимают мусор                        | web/lead + shared            | risk-edit-dialog.tsx, stage-multi-select.tsx, report-primitives.schema.ts | Guard на availableStages.length; `z.string().min(1).refine(noNullBytes)`; спека `risk-stage-integrity`     |
| P1-15 | Графики ключуются по имени → дубль имён теряет данные сущности                              | web/charts                   | lead-velocity.chart.tsx, traffic-light-history.chart.tsx                  | Ключ по стабильному id; имя через recharts `name`                                                          |
| P1-16 | Dashboard: NaN-кольцо сабмишена и неверный ярлык первого pending-лида                       | web/dashboard                | kpi-cards.tsx, alert-bar.tsx                                              | Guard `total>0`; убрать позиционную эвристику isDraft                                                      |
| P1-17 | Порог heap 200MB против лимита 2GB → ложный DOWN и флаппинг                                 | api/health                   | health.controller.ts, docker-compose.prod.yml                             | Поднять порог до ~75% реального лимита; liveness не гейтить на ресурсе                                     |
| P1-18 | Без SMTP_HOST тихо теряется вся прод-почта; EmailService мимо валидного env                 | api/email                    | email.service.ts, env.schema.ts                                           | Fence на SMTP_HOST в prod superRefine; инжектить EnvConfig; поднять PDF_EXPORT_JWT_SECRET до .min(32)      |
| P1-19 | Автосейв lead-формы не сериализован → потеря правок + unhandled rejection                   | web/hooks                    | use-lead-form-autosave.ts                                                 | При isPending складывать в queue, не плодить mutate; `mutate` вместо `void mutateAsync`                    |
| P1-20 | `leadForm.getByPeriod` отдаёт всю секцию со-лида по одному общему продукту                  | api/report-sections          | lead-form.service.ts, lead-form.prisma-repository.ts                      | Ограничить чужую секцию shared-продуктами; контракт-тест на исключение                                     |
| P1-21 | Ошибки idle pg-pool проглатываются; размер пула не настроен                                 | api/prisma                   | prisma.service.ts                                                         | `onPoolError` в structured-логи; pool max/timeout из env                                                   |
| P1-22 | PDF-артефакты без авторизации (см. P0-11) — JWT verify без пина алгоритма (консилиум: Kimi) | api/auth                     | auth.controller.ts                                                        | `{ algorithms: ['HS256'] }` в jwt.verify (защита в глубину, риск минимален из-за симметричного HMAC)       |

Примечание к P1-22: консилиум (Kimi) просил поднять пин алгоритма выше P3.
Оставлен как защита в глубину — секрет симметричный (HMAC), эксплуатируемость алгоритм-конфьюжна минимальна.

---

### 3. P2 и P3 кратко

**P2 (22) — сгруппировано по теме:**

1. Мёртвые параллельные роутеры/passport-JWT, дублирующие авторизацию (BL-DEAD-ROUTERS-AUTH).
2. Диалоги объявляют aria-modal без focus-trap и возврата фокуса (BL-DIALOG-A11Y).
3. Дублированная логика вывода: allowedGroupIds, on-time-ratio, reportHasContent, worst-status (BL-DUPLICATED-DERIVATIONS, BL-STATUS-WORST-SSOT\*).
4. Наблюдаемость: трасса рвётся на воркере; DLQ-порог NaN; telegram не мониторится (BL-WORKER-OBSERVABILITY, BL-DLQ-MONITORING).
5. Admin/Organization логгер — no-op в проде (BL-ADMIN-LOGS-DROPPED).
6. CI спит, pre-push без typecheck; web-образ без frozen-lockfile (BL-CI-CD-GATES, BL-SUPPLY-CHAIN).
7. Деплой-швы: порт API 3001 vs 3002; API host-published мимо Caddy (BL-DEPLOY-SEAM-MISC).
8. CSP только Report-Only без sink → не применяется (BL-SECURITY-HEADERS-CSP).
9. FK onDelete несимметричны (Decision/StageStatus CASCADE vs Item/Risk RESTRICT) (BL-FK-ONDELETE-ASYMMETRY).
10. Перф: queries-in-loop, sequential awaits, пагинация в памяти, upsert-on-read (BL-PERF-QUERIES).
11. Прочая web-корректность: дубль DOM-id, проглоченный toast, общая мутация (BL-WEB-CORRECTNESS-MISC).
12. Live-порядок портфеля недетерминирован; ratio мешает frozen/live (BL-PUBLISH-PARITY-LIVE).
13. Латентный дрейф контрактов: draft-save теряет контент, лоссные касты (BL-LATENT-CONTRACT-DRIFT).
14. Тест-инфра мёртвая: MSW не стреляет, утёкшие спаи (BL-TEST-INFRA).
15. Seed/backfill без non-prod guard (BL-SEED-GUARD).
16. `dev.wipeAndReseed` под protectedProcedure вместо adminProcedure (BL-DEV-WIPE-ROLE).
17. `period.manual-edit` нет в union AuditEvent (BL-AUDIT-EVENT-UNION).
18. SCHEDULED→OPEN флип за autoCreate-гейтом; auto-флаги протухают (BL-PERIOD-STATE-HYGIENE).
19. PDF-checksum считается, но не сохраняется — мёртвое поле (BL-PDF-CHECKSUM-DEAD).

\* BL-STATUS-WORST-SSOT уже отслеживается в спеках — исключён из дорожной карты ниже.

**P3 (5) — кратко:**

1. Защита входов: x-request-id, search-q null-байты, пин JWT (BL-INPUT-HARDENING).
2. Мёртвый код и мёртвые redirect-цели (BL-DEAD-CODE).
3. Устаревшие комментарии и границы схем (BL-COMMENT-DRIFT).
4. Мелкие UX/корректность: window.confirm, мёртвые ветки, нет memo (BL-MINOR-CORRECTNESS-UX).
5. Двойная валидация и пустой shutdown-хук (BL-REDUNDANT-WORK).

---

### 4. Консилиум

Ответили 2 из 4 внешних моделей.

- **Codex** — доступен, дал 4 «пропущенных», ни одного ложного срабатывания.
- **Kimi** — доступен, 1 ложное срабатывание и 3 «пропущенных».
- **Qwen** — таймаут 600с, вердикта нет.
- **GLM** — таймаут 600с, пустой вывод.

Заметные согласия и конфликты:

1. **PDF без авторизации на host-порту** — подняли ОБА (Codex High, Kimi Critical).
   Высокая уверенность; промотирован в P0-11 (отдельно от P0-3 про маршрутизацию).
2. **Конфликт по BL-OPEN-REDIRECT** — Kimi назвал backslash-обход неэксплуатируемым.
   Опровержение неверно: браузеры нормализуют `/\evil.com` в `//evil.com` (protocol-relative, уходит off-origin).
   Это классический `/\`-обход; находку оставил P0, понизить нельзя.
   Большинства за «ложное» нет (1 из 2 ответивших), правило демоута не срабатывает.

Council-only находки, промотированные в бэклог:

1. Голова правит произвольный reportId при публикации/реоупене (Codex) → P1-3.
2. Reminder-процедуры без scope (Codex) → P1-4.
3. PDF без авторизации (Codex + Kimi) → P0-11.
4. JWT без пина алгоритма (Kimi) → отражено в P1-22 / BL-INPUT-HARDENING.
5. periodStart/periodEnd как UTC-полночь из локального ввода (Kimi) → расширение P1-13.
6. CI ссылается на несуществующий `db:seed:simple` (Codex, Medium) → вложено в BL-CI-CD-GATES.

---

### 5. Что НЕ сочли проблемой

Исключения по конвенциям репозитория (MVP-фаза):

1. **Disposable БД и migrate reset** — прямой решейп схемы и reset на не-прод базах это норма, не находка.
2. **Commit прямо в main** — pre-authorized в MVP; не отмечаем как нарушение гигиены.
3. **ComingSoon-фичи** (Phase 54 AI/RAG, Phase 55 Telegram) — намеренно отложены, не «незавершёнка».
4. **Англоязычные UI-строки** — так и задумано до фазы i18n.

Опровергнуто или понижено на проверке:

1. **Kimi: backslash в open-redirect неэксплуатируем** — отклонено, опровержение фактически неверно (см. консилиум).
2. **Стейл-сиды Codex** — ни один из ранее предполагавшихся ложных не подтвердился; Codex явно отметил 0 ложных.
3. **BL-STATUS-WORST-SSOT** — реальная находка, но уже отслеживается в спеках; исключена из новой дорожной карты.

---

### 6. Рекомендуемый порядок OpenSpec-изменений

Волна A — P0, безопасность и потеря данных (делать первой):

1. fix-carryover-persistence — массив stageNames, цикл по всем секциям, priorityRank, P2002.
2. fix-prod-web-build-args — прод build-args для web-образа, скрыть dev-логин, вернуть SSO.
3. route-pdfs-and-authz — `/pdfs` на API в Caddy + авторизованная отдача артефактов (закрывает P0-3 и P0-11).
4. set-express-trust-proxy — trust proxy до middleware, восстановить rate-limit и audit-IP.
5. scope-analytics-to-group — прокинуть session, applyScopeFilter в analytics-репо.
6. scope-leadform-revoke-authz — group-scope на revoke и revokeAllSubmitted.
7. fix-open-redirect-next-param — URL-валидация next и dev-login redirect.
8. escape-org-data-script — экранирование org-данных в inline-script.
9. add-section-optimistic-lock — version-поле и compare-and-set для save секции.
10. guard-autopublish-archived — `archived:false` в кандидатах авто-публикатора.

Волна B — P1, авторизация и целостность:

11. scope-period-lifecycle-authz — цель публикации/реоупена из scope, reject archived.
12. scope-reminder-authz — group-scope на dispatch/list/execute reminder.
13. enforce-deactivation-pdf-bullboard — общий helper isRevoked+isActive в обоих путях.
14. make-publish-atomic — compare-and-set публикации, метрика при count===1.
15. transactional-snapshot-restore — `$transaction` + точечные мутации вместо reconcile.
16. period-uniqueness-db-constraint — partial unique index + маппинг P2002.
17. scope-leadform-getbyperiod — ограничить чужую секцию shared-продуктами.
18. map-domain-errors — типизированные доменные ошибки + ветки маппера.

Волна C — P1, корректность данных и наблюдаемость:

19. fix-analytics-date-matching — диапазон дня, реальный парс даты, агрегация.
20. fix-reminders-escalation-dedupe — получатель по роли head, атомарный dedupe.
21. harden-web-vitals-endpoint — DTO, whitelist, Histogram, throttle.
22. protect-metrics-endpoint — убрать `/metrics` из публичного edge.
23. guard-metrics-scrape-db-failure — try/catch в collect-callback.
24. fix-period-datetime-tz — UTC-парс дедлайна и periodStart/periodEnd.
25. fix-risk-stage-integrity — guard на стадии, валидация элементов.
26. key-charts-by-id — ключ серий по id, имя через name.
27. fix-dashboard-nan-pending — guard ratio, убрать isDraft-эвристику.
28. fix-heap-health-threshold — порог heap от реального лимита.
29. enforce-smtp-config — fence SMTP_HOST, инжект EnvConfig, JWT .min(32).
30. serialize-autosave — очередь автосейва, fire-and-forget.
31. observe-prisma-pool — onPoolError, размер пула из env.

Волна D — P2/P3, гигиена (после прод-готовности):

32. enable-ci-and-pre-push-gates — поднять runner, typecheck в pre-push, required checks, fix `db:seed:simple`.
33. lock-supply-chain — frozen-lockfile в web-образе, digest-пины.
34. fix-deploy-seams — порт API 3001, API за Caddy (expose-only).
35. enforce-csp — переключить CSP с Report-Only на enforcing.
36. consolidate-duplicated-derivations — общий allowedGroupIds, on-time-ratio, reportHasContent.
37. fix-worker-observability — traceparent в job-data, логи воркера через AppLogger.
38. fix-dlq-monitoring — валидация порога, telegram в QUEUE_NAMES, закрытие очередей.
39. shared-dialog-focus-management — единый focus-managed диалог-примитив.
40. perf-hot-path-queries — Promise.all, DB-пагинация, bulk-операции.
41. cleanup-dead-code-and-test-infra — мёртвые роутеры/код, починка/удаление MSW, restoreMocks.
42. align-fk-ondelete — единая политика onDelete для контента продукта.
43. misc-hardening-and-comment-drift — input-hardening, seed-guard, dev-wipe adminProcedure, audit-union, комментарии.

Уже в спеках (не включать в дорожную карту): traffic-light single-source-of-truth (BL-STATUS-WORST-SSOT).
