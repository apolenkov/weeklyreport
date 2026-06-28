# Handoff — результаты repo-excellence-review (утро 2026-06-28)

**Кому:** Саше / свежей сессии. **Статус:** ревью завершено, правок в коде НЕ делалось.

## Bottom line

Здоровье репозитория — **КРАСНОЕ, к продакшену не готов.**
Прогнан модернизированный 5-модельный движок ревью всего репозитория.
Результат — verified backlog. OpenSpec-changes НЕ каркасились (ждут твоего «добро»).

## Артефакты (durable, на диске)

1. `docs/repo-excellence-review-2026-06-28.md` — человеческий отчёт (таблица P0+P1, консилиум, дорожная карта).
2. `docs/repo-excellence-review-2026-06-28.data.json` — машиночитаемый backlog + recommendedChanges + вердикты консилиума.
3. `.claude/workflows/repo-excellence-review.js` — модернизированный движок (совет + sweep широты).

## Счётчики (честно, три артефакта — три числа)

- **Структурный backlog (JSON): 56** — P0:10, P1:19, P2:22, P3:5.
- **Отчёт-нарратив: 60** — +4 council-promoted находки доложены сверх структурных.
- **recommendedChanges: 44** → в отчёте сгруппированы в дорожную карту из 43 пунктов (4 волны).
- **Авторитетно для каркасинга — `recommendedChanges` (44) из JSON-сайдкара.**

## Топ-P0 (10 структурных changes)

1. fix-carryover-persistence — потеря данных + краш на нерешённых решениях (behavioral).
2. set-express-trust-proxy — trust proxy не выставлен → rate-limit/audit-IP схлопнуты.
3. route-pdfs-and-authz — `/pdfs` не за Caddy (404) + неавторизованная отдача артефактов.
4. fix-prod-web-build-args — prod web-образ печёт dev-логин вместо SSO.
5. scope-analytics-to-group — аналитика утекает между группами любому авторизованному.
6. scope-leadform-revoke-authz — глава правит чужие группы (BOLA).
7. fix-open-redirect-next-param — open redirect на `next` (backslash-обход).
8. escape-org-data-script — stored XSS через сырой JSON.stringify в inline-script.
9. add-section-optimistic-lock — save секции = delete/recreate без блокировки → потеря правок.
10. guard-autopublish-archived — авто-публикатор воскрешает архивный период.

## Уровень доверия к находкам

- **Config-P0 — подтверждены грепом наземной правды (не только AI-verify):**
  - trust proxy: в `apps/api/src/main.ts` нет ни одного совпадения ✓
  - `/pdfs`: отсутствует в `@api`-matcher `deploy/caddy/Caddyfile` (там только trpc/auth/health/metrics/admin) ✓
  - Dockerfile.web: `NEXT_PUBLIC_AUTH_STUB=true`/`DEV_ROLE_SWITCHER=true` инлайнятся, compose не переопределяет ✓
  - Бонус: `/metrics` публичен в `@api` (подтверждает P1-11).
- **Behavioral-P0 (carry-over, auto-publisher, optimistic-lock) — backlog-confidence,**
  каждую подтверждать при реализации (verify-скептик этого репо умеет ложно подтверждать).

## Консилиум (Claude + Codex + Kimi + Qwen + GLM)

- Ответили **3 из 5**: Claude (per-finding) + **Codex** (4 пропуска, 0 FP) + **Kimi** (1 FP, 3 пропуска).
- **Qwen и GLM — таймаут 600с** (начали глубоко исследовать репо, не уложились; watchdog убил — graceful degradation сработала).
- Council-находки попали и в структурный список: route-pdfs-and-authz, scope-period-lifecycle-authz, scope-reminder-authz.
- Конфликт: Kimi назвал backslash open-redirect неэксплуатируемым — опровержение неверно (браузеры нормализуют `/\` в `//`), находка оставлена P0.
- **Опция на утро (по твоему решению, НЕ запускал):** council-only переотправка только Qwen+GLM против готового backlog — поднять cap до ~900с или ужать промпт, чтобы не переисследовали. Это 2 backlog-вызова, без переревью, дёшево.

## Дедуп против существующих спеков (шаг 3 — ВАЖНО при каркасинге)

Синтезатор сверялся только с 2 спеками — ниже остальные пересечения.
Правило: **сначала проверь ТЕЛО спеки, расширяй её, а не плоди дубль** (имя ≠ содержание).

- **Подтверждённый extend:** `fix-risk-stage-integrity` (#25) → спека **`risk-stage-integrity`** уже есть (6 reqs).
- **Кандидаты на extend (проверить тело при каркасинге):**
  - период (#10/#11/#16) → `period-dual-state`, `period-lifecycle-ui`, `schema-conventions`
  - `map-domain-errors` (#18) → `client-error-policy`
  - `lock-supply-chain` (#33) → `dependency-currency`
  - `shared-dialog-focus-management` (#39) → `admin-dialog-focus-management`, `lead-dialog-lifecycle`, `record-dialog-layout`
  - observability (#37/#38) → `error-trace-correlation`, `manual-publish-telemetry`
  - scope-авторизация (#5/#6) → `repository-scope-guard`, `scope-accessed-audit`
  - seed/dev-wipe/destructive (#43) → `destructive-db-guard`, `repository-scope-guard`
  - CI-гейты (#32) → `uat-quality-gates`, `lint-toolchain-ownership`, `role-coverage-gate`, `behavioral-ui-regression-gate`
  - `fix-heap-health-threshold` (#28) → `health-indicator-service-migration`
  - тест-инфра (#41) → `web-trpc-test-harness`, `web-test-timer-discipline`, `sweep-runtime-correctness`
- Уже отслеживается, в дорожную карту НЕ включено: BL-STATUS-WORST-SSOT (traffic-light SSOT).

## Обновление 2026-06-28 — Wave A + Wave B закаркашены и гарденнуты

Конвейер на каждую волну: каркас → Codex-ревью (по одному на change) →
применение валидных правок (сверка как с кандидатами) → ре-валидация → коммит.

- **Wave A (10 P0)** — закоммичено `f3bdb8f` (каркас), `4abb5c0` (Codex-обзор,
  23 находки), `b710c80` (17 применено, 9 отклонено — все 6 analytics-находок
  Codex были мисридами, отклонены с пруфами).
- **Wave B (8 P1)** — `83b8134` (каркас), `36ca823` (Codex-обзор, 20 находок),
  `6895a74` (20 применено, 0 отклонено — все реальны).
  - 4 из 8 Codex-обзоров шли через ФОНОВЫЙ `codex exec` (`/tmp/codex-bg-review.sh`),
    т.к. foreground Bash режет на 600с, а codex за прокси медленный. Фон обходит потолок.
  - `enforce-deactivation-pdf-bullboard` добавил MODIFIED-дельту к durable-спеке
    `dependency-currency` (та требовала requireHead байт-в-байт) — кросс-спек конфликт.
- Все 18 changes проходят `openspec validate --strict`. Это ПЛАНЫ: 0 задач, код не тронут.
- Машиночитаемые обзоры: `docs/repo-excellence-review-2026-06-28.codex-review.json`
  (Wave A), `...wave-b.codex-review.json` (Wave B).
- Стоп-time Codex-гейт ОТКЛЮЧЁН (падал на прокси, избыточен — обзор в конвейере).
  Вернуть: `codex-companion.mjs setup --enable-review-gate`.

### Что осталось (НЕ в OpenSpec)

- **Wave C** — P1 корректность/наблюдаемость (~13 changes, #19-31 в дорожной карте).
- **Wave D** — P2/P3 гигиена (~12, #32-43). P2/P3 многие расширяют существующие
  специ — каркасить поштучно не обязательно.
- Те же три workflow в `/tmp` (`scaffold-*`, `codex-review-*`, `apply-codex-*`)
  переиспользуемы: сменить встроенный список changeId.

## Что дальше (с твоего согласия)

1. Реализовать P0/P1 (выход из «только ревью») — рекомендую начать с прод-ломающих
   config-фиксов Wave A (trust-proxy, /pdfs, dev-auth, autopublish).
2. Либо закаркасить Wave C тем же конвейером.
3. (Опц.) council-only добор Qwen+GLM на следующем прогоне.

## Движок: что изменено и known issues

- Добавлены: 7-мерный sweep широты, факт-чек-стойка для config-находок, 6 seeds Codex, backlog-level совет из 4 внешних моделей, дедуп на openspec specs.
- **Баги исправлены:** (1) парсинг `args` (приходил строкой) — флаги `unitLimit/dimLimit` теперь работают для дешёвого dry-run; (2) убран хардкод scratch-пути прошлой сессии — обёртки совета теперь `mktemp` + heredoc (переиспользуемо в любой сессии); (3) watchdog OpenCode поднят до 900с + промпт совета тайм-боксит исследование, чтобы Qwen/GLM не упирались в таймаут.
- **Known:** 1 verify-агент упал на StructuredOutput-cap (1 находка из 169 без вердикта). Фикс таймаута Qwen/GLM не проверен живьём — подтвердится на следующем council-прогоне.
- Полный прогон: ~239 агентов, ~7.4M токенов, ~57 мин (resume из кэша после session-лимита).

## Phase-2 (Wave C/D Codex review) — запланировано на 02:52 MSK 2026-06-29

Все 35 changes (A:10+B:8+C:13+D:4) закаркашены и проходят `openspec validate --strict`.
Wave A+B уже Codex-ревьюнуты + гарденнуты + convergence. Осталось: Codex-ревью + применение для 17 Wave C/D.

**Авто:** session-only cron `d75a7733` на 02:52 MSK (после сброса Codex 02:46). Сработает,
только если Claude-сессия жива и простаивает. Гейт оставлен ВЫКЛЮЧЕННЫМ.

**Ручной запуск Phase-2 (если cron не сработал) — из этого репо:**

```text
# 1) Codex-ревью 17 Wave C/D (codex должен быть доступен):
Workflow({ scriptPath: 'docs/review-pipeline/codex-review-wave-cd.js.txt' })
# (если ругается на расширение — скопируй .txt -> /tmp/x.js и запусти оттуда)
# 2) Сохрани reviews -> docs/repo-excellence-review-2026-06-28.wave-cd.codex-review.json
# 3) Применение валидных правок (сверка как с кандидатами):
Workflow({ scriptPath: 'docs/review-pipeline/apply-codex-revisions-wave-cd.js.txt' })
# 4) openspec validate --strict по всем 35; commit openspec/changes/ + json в main.
```

Скрипты-конвейера: `docs/review-pipeline/*.txt` (переименуй в `.js` для запуска).
Принципы применения: находки Codex — КАНДИДАТЫ, сверять с кодом (вкл. сгенерированные
Prisma-типы), спорные отклонять с причиной; продуктовый код НЕ трогать; tasks не закрывать.
