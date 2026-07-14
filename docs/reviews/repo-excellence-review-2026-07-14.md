## Итог

Репозиторий **YELLOW**, ось «целостность данных + авторизация» — **RED**.
К первому продакшн-пойнту **не готов**: четыре P0 — тихая потеря правок, утечка чужих ревью-комментариев, порча жизненного цикла периода и срыв всего расписания напоминаний одним битым таймзоном.

Счёт после сверки с консилиумом:

- **P0 — 4** (BL-01, BL-02, BL-03, BL-04)
- **P1 — 18** (BL-05…BL-21 + council-находка BL-29)
- **P2 — 6** (BL-22…BL-27)
- **P3 — 1** (BL-28)

Всего 29 пунктов. Один пункт (BL-08) сужен: половина заявки опровергнута кодом, вторая половина подтверждена.

Что чинить первым: BL-01 (правки лида теряются при штатном сохранении) и BL-02 (кросс-авторская утечка ревью-комментариев) — оба бьют по каждому пользователю, оба тихие.

---

## P0 + P1: таблица

| ID                                                                                          | Заголовок                                                                                               | Подсистема                           | Файлы (ключевые)                                                                               | Что сделать                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BL-01** P0                                                                                | In-flight reseed затирает правки лида                                                                   | web/report-sections draft pipeline   | `use-lead-form-draft-orchestration.ts`, `lead-section-draft-payload.ts`                        | Guard на reseed при dirty; reconcile серверных id без затирания правок. Фильтр рисков — добавить `hasText(r.impact)`. См. оговорку консилиума ниже.                                                                        |
| **BL-02** P0                                                                                | «Everyone»-линза лида отдаёт чужие ревью-комментарии                                                    | api/report-sections authz            | `lead-form-cross-author-scope.ts`                                                              | В `filterSectionToSharedProducts` сбросить `comments[]` на items/risks/decisions, как уже сделано для activities/reviews. Тест: comments отсутствуют.                                                                      |
| **BL-03** P0                                                                                | Планировщик создания периода: затирает конкурентный archive + плодит дубли scheduled                    | api/period lifecycle                 | `period-creator.scheduler.ts`, `period-factory.ts`, `init/migration.sql`                       | Флип сделать guarded: `updateMany({where:{id, periodState:'scheduled'}})`, `count===0` → log-skip. Расширить partial-unique на scheduled или сверять/удалять orphan.                                                       |
| **BL-04** P0                                                                                | Таймзона политики напоминаний не валидируется → срыв расписания всего периода                           | shared/admin schema + api applicator | `reminder-policy.schema.ts`, `policy-applicator.service.ts`                                    | Refine `timezone` против IANA на схеме, рядом с существующим refine окна валидности.                                                                                                                                       |
| **BL-05** P1                                                                                | Широкий try/catch гидрации сессии логаутит на транзиентном сбое БД                                      | api/tRPC context                     | `trpc.context.ts`, `trpc.session-hydration.ts`                                                 | Сузить catch до token-verify; ошибки `hydrateSession` → retriable 500.                                                                                                                                                     |
| **BL-06** P1                                                                                | PeriodNavigator показывает не тот период на viewer-роуте                                                | web/period navigator                 | `period-navigator.tsx`, `viewer-report-shell.tsx`                                              | Прокинуть `currentPeriodId` пропом из ViewerReportShell вместо разбора pathname (или расширить regex на `/reports/:id`).                                                                                                   |
| **BL-07** P1                                                                                | PDF-кнопка: popup-blocked download рапортует success; ошибка poll’а вешает кнопку навсегда              | web/pdf-export                       | `export-pdf-button.tsx`                                                                        | Открывать вкладку синхронно в click; проверять возврат `window.open`. Обработать `statusQ.isError`: toast + `setJobId(null)`.                                                                                              |
| **BL-08** P1                                                                                | SaveNowButton держит зелёный «Saved» поверх новых правок                                                | web/report-sections + shared         | `save-now-button.tsx`, `lead-form-header-actions.tsx`                                          | Сбрасывать таймер и `showSaved=false`, когда `state!=='saved'` (или гейтить ветку в `deriveSaveView`). **Сужено:** заявка про «застрявший Pending» опровергнута GLM.                                                       |
| **BL-09** P1                                                                                | Запись RecordComment ревьюером не согласована с delete/recreate в saveSection                           | api/review write                     | `review-actions.prisma-repository.ts`, `report-sections.prisma-repository.ts`                  | Резолв anchor + insert в одной транзакции с тем же FOR UPDATE / version compare-and-set; anchor по stableId. Как минимум ловить P2003.                                                                                     |
| **BL-10** P1                                                                                | Admin write: race на attach продукта отдаёт сырой 500                                                   | api/admin write                      | `admin-entity-write.queries.ts`, `admin-group-product.queries.ts`                              | Ловить `isUniqueViolation` в `attachProductToGroup` → `AdminGroupProductConflictError`. **Сужено:** синхронизацию `samlId` НЕ делать (см. консилиум).                                                                      |
| **BL-11** P1                                                                                | Reminders: gate по устаревшему JWT, сырой UUID в письме, обрезка пагинации на 100                       | api/reminders                        | `reminders.router.ts`, `reminders-queue-payload.ts`, `reminders.prisma-repository.ts`          | Активный id брать из БД (`getCurrentEditableId`). В legacy-payload — реальный лейбл периода. Курсор-пагинацию — в Prisma-запрос.                                                                                           |
| **BL-12** P1                                                                                | Порядок секций в опубликованном отчёте недетерминирован и расходится с превью                           | api/publication + snapshot           | `publication.service.ts`, `published-report-snapshot.ts`, `weekly-report.prisma-repository.ts` | Добавить `orderBy` по authorName в `reportFullIncludeForSnapshot` — детерминизм на момент заморозки, как в `getAssembledReport`.                                                                                           |
| **BL-13** P1                                                                                | PDF-backend: преждевременный «failed», неуправляемый Redis-клиент, opt-in ownership, over-count метрики | api/pdf-export                       | `pdf-export.processor.ts`, `main.ts`, `pdf-export.service.ts`, `pdf-export.router.ts`          | Terminal-attempt guard в `onJobFailed`; `app.get(SessionRevocationService)`; `requestedBy` обязателен; `inc()` после enqueue; `canReadReport` на seam. Сюда же второй `new`-клиент из `trpc.context.ts` (консилиум/Codex). |
| **BL-14** P1                                                                                | Slides: дубли React-ключей, выход из fullscreen при навигации, нет Space                                | web/slides                           | `head-slide-carousel.tsx`, `status-slide-deck.tsx`, `slide-article-rows.tsx`                   | Ключ `${item.id}:${pageIndex}`; поднять `useFullscreen` на постоянный root; обработать Space + preventDefault.                                                                                                             |
| **BL-15** P1                                                                                | Отклонённые SAML-ассершены не пишут аудит и fail-метрику                                                | api/auth SAML                        | `auth.routes.ts`                                                                               | Убрать `failureRedirect`, кастомный callback: `loginFail` + `loginAttemptsTotal{fail}` затем redirect на error.                                                                                                            |
| **BL-16** P1                                                                                | Прод-SMTP: hardcoded `secure:false`, нет `requireTLS` (cleartext-AUTH, нет 465)                         | api/email                            | `email.service.ts`, `env.schema.ts`                                                            | `requireTLS:true` при наличии auth; `secure: port===465`.                                                                                                                                                                  |
| **BL-17** P1                                                                                | Скрипты reset/wipe неверно обрабатывают Redis flush: вечный hang и ложное «OK»                          | prisma maintenance                   | `wipe-manual-uat.ts`, `reset-hard.ts`                                                          | Идемпотентный resolve в `close`; трекать `+OK` и reject в `end`, если не пришло.                                                                                                                                           |
| **BL-18** P1                                                                                | Weekly-report page: deep-link scroll no-op, activity-only draft скрыт без «Show all», лишний re-map     | web/report-sections page             | `weekly-report-page-view.ts`, `weekly-report-page-helpers.ts`, `use-weekly-report-page.ts`     | `scrollTargetProductId` из `focusedProductId`; activity-only draft в `draftCount`; `useMemo` на цепочку мапперов.                                                                                                          |
| **BL-19** P1                                                                                | Period fill-from / pause: «Previous» врёт при поиске, stale-search, нет focus-trap                      | web/period dialogs                   | `fill-from-dropdown-panel.tsx`, `fill-from-button.tsx`, `pause-reason-dialog.tsx`              | Бейдж по `p.id===previousPeriodId`; сброс search на close; `useDialogFocus` в pause-диалоге.                                                                                                                               |
| **BL-20** P1                                                                                | Admin products-tab переоткрывает свёрнутую панель на refetch; skeleton без ширины                       | web/admin + dashboard                | `products-tab.tsx`, `dashboard-skeleton.tsx`                                                   | Флаг взаимодействия для effect’а; статическая карта ширин или `style={{width}}` вместо динамического Tailwind-класса.                                                                                                      |
| **BL-21** P1                                                                                | Изоляция групп: telemetry без scope, viewer-fallback без archived/visibility фильтра                    | api/telemetry + weekly-report        | `telemetry.service.ts`, `weekly-report.service.ts`                                             | Прокинуть `groupScopeFilter` в telemetry (как в analytics) + в cache-key; viewer-fallback на visibility-scoped resolver.                                                                                                   |
| ~~council-glm-idor~~ REJECTED (см. амендменты; номер BL-29 НЕ его — BL-29 это audit-target) | Head cross-group archive/unarchive IDOR — нет group-scope на client `reportId`                          | api/authz archive router             | `archive.router.ts`, `admin.service.ts`, `period-admin.service.ts`                             | Прокинуть `groupScopeFilter(ctx.session)` через `archivePeriod`/`unarchivePeriod` и проверить принадлежность группе head’а; либо повысить до `adminProcedure`, если кросс-группа — намеренно admin-only.                   |

---

## P2 / P3 — сжато

**BL-22** P2 — деплой/observability дрейф: postgres-exporter захардкожен на `customreport_dev`, Prometheus скрапит dev-порт `3002`, Grafana admin/admin наружу, `:latest`-теги в dev/CI, CSP `unsafe-inline`. Сюда же council/GLM: alertmanager webhook бьёт в несуществующий `api:3002/api/alerts`, staging-CSP расходится с prod, Redis без пароля в prod-compose, Caddy admin API без auth; council/Codex: GitHub Actions на mutable `@v4` вместо SHA-пинов.

**BL-23** P2 — CI только `workflow_dispatch` (0 раннеров) и нет сканера зависимостей. **CI-гейт уже трекается** в `openspec/specs/ci-merge-gate` (поправка Codex — `alreadyTracked` было устаревшим); в отдельный change выносим только dependency-scanning (`pnpm audit`/OSV/Dependabot).

**BL-24** P2 — дублирование типов: admin `group/product/user-form` тянут `Mock*` из `admin-mock-data` вопреки самодокументации `admin-types`; `RecordStageStep` ≈ `RiskStageStep`. Выбрать один источник типов, извлечь общий StageStep.

**BL-25** P2 — строгость контрактов (латентно): `publishedById` = `z.string()` vs `z.uuid()` у сиблинга; web-vital `value` без `.max()`; P2002 substring-матч; search `excludeTypes` чтит только `project`.

**BL-26** P2 — латентная устойчивость: `ensure-lead-section` create+seed не в транзакции; `myHistory` мимо `mapDomainError`; admin `dlqCount/retryFailed` fail-soft маскируют регресс проводки; `/api/client-logs` без cap на тело; `useScrollFade` устаревает при росте контента; carry-over `recordType` от nullable id; `_destructive-guard` криво парсит DATABASE_URL. Сюда же council/GLM (Low): `dev.listUsers` без `NODE_ENV`-assert.

**BL-27** P2 — observability-слепые пятна: нет gauge глубины очередей (застрявший job невидим — тот самый «почему отчёт завис»); DLQ event-driven undercount; нет per-procedure OTel-span; `bullmq.health` без таймаута; on-time-ratio gauge не сбрасывается. Сюда же council/GLM (Low): нет проброса W3C `traceparent` web→API.

**BL-28** P3 — чистка: archaeology-префикс в `env.ts`; мёртвый `draftSaveSchema.status`; ложный «invariant»-комментарий; `client-logger` стекует обёртки на HMR; мёртвая archive-плитка dashboard; хрупкий селектор agentation по хешированному CSS-классу; мёртвый `--pulse-line`.

---

## Консилиум

Ответили **2 из 4**: **Codex** и **GLM** (available).
**Kimi** и **Qwen** — недоступны: процессы не успели выдать вердикт до форс-таймаута харнеса (Qwen — известный потолок Bash 600s против watchdog 900s). Их пустые слоты не заполнялись выдуманными вердиктами.

Согласия и конфликты:

- **BL-08** — GLM опроверг подпункт (a) «застрявший Pending» на уровне кода (`draftSection` стартует `useState(null)` → `dirty=false` на первом рендере; `initialSavedKey` праймит `lastSavedRef` в том же батче). Подпункт (b) — подтвердил. Пункт **сужен**, остаётся P1.
- **BL-01** — Codex: подзаявка про blank-impact завышена — сейв отклоняется, но autosave входит в видимый error-state с toast, а draft остаётся dirty; «тихой» потери на этой ветке нет. **In-flight reseed race — реален**, P0 держим; фильтр `impact` оставляем как мелкое упрочнение, но без «silent»-рамки.
- **BL-10** — Codex: синхронизация `samlId` при правке email — вредна (это внешний ключ SAML-идентичности, create-only намеренно). **Рекомендацию про samlId убрал**; P2002 + product-attach race остаются.
- **BL-23** — Codex: `alreadyTracked` устарел — CI-гейт трекается в `ci-merge-gate`. Учтено.

Council-only misses, поднятые в бэклог:

- ~~**GLM — head cross-group archive/unarchive IDOR**~~ — REJECTED в амендментах ниже: guard'ы на head-lifecycle-операции — отклонённое продуктовое решение (2026-07), кросс-групповой archive для head намеренный. НЕ путать с BL-29 (audit-target coverage) из амендментов.
- **Codex — второй неуправляемый Redis-клиент** в `trpc.context.ts` (тот же класс, что BL-13b). Свёрнут в BL-13.
- **GLM — deploy-hardening** (alertmanager порт, staging-CSP, Redis-auth, Caddy admin) — свёрнуто в BL-22.
- **Codex — GH Actions без SHA-пинов** — свёрнуто в BL-22 (supply-chain).
- **GLM (Low)** — stale-JWT `getActive` read-window, отсутствие `traceparent`, `dev.listUsers` без NODE_ENV — свёрнуты в BL-11/BL-27/BL-26 как связанные.

---

## Что НЕ сочли проблемой

- **BL-08(a)** «застрявший Pending на чистой загрузке» — опровергнуто кодом (GLM), снято.
- **BL-01** blank-impact как «тихая потеря» — снято (Codex): потеря видима (error + toast), draft остаётся dirty.
- **BL-10** синхронизация `samlId` при правке email — снято (Codex): это внешний SAML-ключ, create-only намеренно; правка сломала бы сопоставление идентичностей.
- **BL-23** серверный CI-гейт — не выносим отдельным change’ем: уже трекается в `openspec/specs/ci-merge-gate` как принятый MVP-интерим.
- **Публикация vs section-save (проверка Codex)** — путь сериализован Report FOR UPDATE lock (`report-sections.prisma-repository.ts:119`); НЕ баг, в бэклог не заведён.
- **env.schema / NEXT_PUBLIC / Dockerfiles** (проверка GLM) — без silent-defaults, non-secret, multi-stage/non-root/digest-pinned; чисто.

---

## Рекомендованный порядок OpenSpec-изменений

Исключён CI-merge-gate (трекается). Порядок: P0 → P1 (сначала утечки/потеря данных и authz) → P2 → P3.

1. `fix-lead-draft-inflight-reseed-loss` (P0) — guard reseed при dirty + фильтр impact.
2. `fix-cross-author-comment-leak` (P0) — сброс `comments[]` в Everyone-линзе.
3. `fix-period-scheduler-concurrency` (P0) — guarded flip + unique на scheduled.
4. `validate-reminder-policy-timezone` (P0) — IANA-refine на схеме.
5. `coordinate-review-comment-with-savesection` (P1) — транзакция + stableId anchor.
6. `scope-telemetry-and-viewer-fallback` (P1) — groupScopeFilter в telemetry + fallback.
7. `narrow-session-hydration-catch` (P1) — catch только token-verify.
8. `audit-rejected-saml-assertions` (P1) — audit+метрика на отклонённые ассершены.
9. `harden-smtp-transport-tls` (P1) — requireTLS + secure по порту.
10. `deterministic-published-section-order` (P1) — orderBy в snapshot-include.
11. `fix-reminders-active-period-and-pagination` (P1) — активный id из БД, лейбл периода, курсор в Prisma.
12. `harden-pdf-export-backend` (P1) — terminal-guard, app.get Redis, required requestedBy, метрика, scope.
13. `fix-pdf-export-button-popup-and-wedge` (P1) — синхронный open + isError-обработка.
14. `harden-admin-entity-write-races` (P1) — P2002 на attach.
15. `fix-prisma-reset-redis-flush` (P1) — идемпотентный resolve + трекинг +OK.
16. `fix-period-navigator-viewer-route` (P1) — currentPeriodId пропом.
17. `fix-lead-save-status-indicator` (P1) — сброс showSaved.
18. `fix-slides-deck-react-defects` (P1) — ключи, fullscreen, Space.
19. `fix-weekly-report-page-view-bugs` (P1) — scroll target, draftCount, useMemo.
20. `fix-period-fill-from-and-pause-dialogs` (P1) — previousPeriodId бейдж, сброс search, focus-trap.
21. `fix-admin-products-tab-and-dashboard-skeleton` (P1) — флаг взаимодействия + статичная ширина.
22. `harden-deploy-observability-config` (P2) — параметризация exporter/scrape, bind 127.0.0.1, SHA-пины, alertmanager/Redis/Caddy.
23. `add-dependency-vulnerability-scanning` (P2) — pnpm audit / OSV / Dependabot (CI-гейт исключён — трекается).
24. `expand-observability-metrics` (P2) — queue-depth gauge, per-procedure span, health-timeout, traceparent.
25. `tighten-schema-contract-strictness` (P2) — uuid/max/word-boundary/excludeTypes.
26. `harden-latent-partial-failure-gaps` (P2) — транзакции seed, mapDomainError, cap body, discriminator.
27. `dedup-admin-types-and-stage-step` (P2) — один источник типов + общий StageStep.
28. `cleanup-archaeology-and-dead-code` (P3) — префиксы, мёртвый код/CSS/схема, HMR-логгер.

## Orchestrator amendments (post-council, hand-verified)

Council seat status: codex + glm delivered verdicts; kimi + qwen hit the
external-CLI execution window and returned no verdict (explicitly, without
fabricating one) — their audit coverage is absent, not negative.

### Corrections applied to the backlog

- **BL-01** (codex): the blank-impact sub-claim is overstated — the rejected
  save surfaces an error state + toast and the draft stays dirty; only the
  in-flight reseed race loses data silently. Severity holds on part (a) alone.
- **BL-08** (glm): sub-claim (a) ("stuck Pending on clean load") is REFUTED —
  initialSavedKey primes lastSavedRef in the same effect batch, dirty stays
  false. Sub-claim (b) (stale "Saved" over new edits) is confirmed.
- **BL-10** (codex): do NOT sync samlId to email on admin edit — samlId is the
  external identity key and is intentionally create-only; keep only the P2002
  handling + product-attach race parts.
- **BL-23** (codex): real gap, but `alreadyTracked` is stale — ci.yml points at
  openspec/specs/ci-merge-gate as the accepted pre-production requirement.

### Findings restored (their verify agents died mid-run; re-verified by hand)

- **BL-29 [P2/observability] Audit trail records no target for user-lifecycle
  mutations.** CONFIRMED: `TARGET_ID_KEYS` (trpc.middleware.ts) lacks `userId`
  / `groupId` / `productId`, so deactivateUser/activateUser/deleteUser and
  group-product edge mutations write audit rows with an empty target. Fix:
  extend the key list; add a test pinning target extraction per mutation.
- **BL-30 [P3/correctness-latent] `useCursorPagination` clobbers factory-set
  `enabled`.** CONFIRMED mechanism, currently unreachable (no caller sets
  enabled via the factory): `{ ...built, enabled: options.enabled }`
  unconditionally overwrites. Fix: merge (`options.enabled ?? built.enabled`).

### Council-reported misses, hand fact-checked

- CONFIRMED **[P2] GitHub Actions pinned to mutable tags** (`@v4`), while
  docker images are SHA-pinned — pin actions to SHAs for parity.
- CONFIRMED **[P2] Staging Caddyfile CSP diverges from prod** (no script-src
  in staging; prod has it) — staging stops rehearsing prod policy.
- CONFIRMED **[P2] Second unmanaged ioredis client** in trpc.context.ts
  (SessionRevocationService constructed outside DI; lifecycle unmanaged).
- CONFIRMED-CONFIG **[P2] alertmanager webhook → api:3002 `/api/alerts`** —
  port/endpoint mismatch plausible; verify the receiver before wiring fixes.
- REJECTED **glm's "archive/unarchive IDOR" (High)**: head lifecycle authz
  guards were explicitly declined as a product decision (2026-07; recorded);
  not a defect.
- Redis `requirepass` absence: not fully checked (compose `command` block not
  audited) — carry as an open verify item, not a finding.
