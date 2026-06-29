# Implementation Roadmap — repo-excellence backlog

**START HERE для фазы реализации.** Ревью завершено; это единственный актуальный
план действий. Подробные находки — в `repo-excellence-review-2026-06-28.md`,
данные — в `repo-excellence-review-2026-06-28.data.json`, дашборд —
в `repo-excellence-review-status-2026-06-29.html`.

## Состояние

- Здоровье репозитория: **КРАСНОЕ**, к продакшену не готов.
- **35 OpenSpec-changes** готовы в `openspec/changes/` — каждый прошёл
  каркас → Codex-ревью → применение правок → `validate --strict`.
- Это **планы**: продуктовый код ещё НЕ менялся. Твоя задача — реализация.
- A+B прошли convergence round-2; C/D — single-pass (опц. догнать тем же
  `docs/review-pipeline/`).

## Как реализовать один change

1. Прочитай `openspec/changes/<name>/` — `proposal.md` (зачем), `design.md`
   (как), `specs/**/spec.md` (требования + сценарии), `tasks.md` (чек-лист).
2. Реализуй по `tasks.md` (можно через скилл `opsx:apply`).
3. Прогони гейты: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
4. Закрой change: `openspec archive <name>`.

Принципы: без оверинженеринга, модульно, понятно джуну; находки Codex уже учтены
в спеках. Для DB-изменений — решейп `schema.prisma` + правка init-миграции (MVP),
не инкрементальные alter-table.

## Порядок реализации (по волнам)

### Волна A — P0 (прод-блокеры, делать первой)

1. `set-express-trust-proxy` — trust proxy за Caddy (rate-limit/audit-IP).
2. `route-pdfs-and-authz` — `/pdfs` на API + авторизованная отдача PDF.
3. `fix-prod-web-build-args` — prod web-образ: SSO вместо dev-логина.
4. `guard-autopublish-archived` — не воскрешать архивный период.
5. `fix-carryover-persistence` — потеря данных carry-over.
6. `add-section-optimistic-lock` — потеря правок при save секции.
7. `scope-analytics-to-group` — утечка аналитики между группами.
8. `scope-leadform-revoke-authz` — BOLA в revoke.
9. `fix-open-redirect-next-param` — open redirect на `next`.
10. `escape-org-data-script` — stored XSS в inline-script.

### Волна B — P1 (авторизация и целостность)

11. `scope-period-lifecycle-authz` 12. `scope-reminder-authz`
12. `enforce-deactivation-pdf-bullboard` 14. `make-publish-atomic`
13. `transactional-snapshot-restore` 16. `period-uniqueness-db-constraint`
14. `scope-leadform-getbyperiod` 18. `map-domain-errors`

### Волна C — P1 (корректность и наблюдаемость)

19. `fix-analytics-date-matching` 20. `fix-reminders-escalation-dedupe`
20. `harden-web-vitals-endpoint` 22. `protect-metrics-endpoint`
21. `guard-metrics-scrape-db-failure` 24. `fix-period-datetime-tz`
22. `fix-risk-stage-integrity-impl` 26. `key-charts-by-id`
23. `fix-dashboard-nan-pending` 28. `fix-heap-health-threshold`
24. `enforce-smtp-config` 30. `serialize-autosave` 31. `observe-prisma-pool`

### Волна D — P2/P3 (гигиена, после прод-готовности; сгруппировано)

32. `ci-deploy-supplychain-hardening` 33. `observability-and-perf-hardening`
33. `code-health-and-test-cleanup` 35. `input-and-error-hardening`

## Инструменты ревью (переиспользуемые)

`docs/review-pipeline/*.txt` — скрипты конвейера (каркас / Codex-ревью /
применение / convergence). Переименуй копию в `.js` и запусти через `Workflow`.
Codex стоп-гейт сейчас ВЫКЛЮЧЕН — вернуть: `codex-companion.mjs setup --enable-review-gate`.

## Дополнения после ревью (2026-06-29)

- **`tighten-code-quality-ratchet`** (новый change) — затягивает `lint-max-strictness-standard`:
  max-lines 300→250, `no-magic-numbers` + `sonarjs/no-duplicate-string`→error, ratchet-план.
  Реализуй в конце Волны D (после прод-готовности).
- **6 net-new находок** (из таргет-ре-ревью, закрывшего микро-дыру 1/169) **вплетены**
  в существующие changes (не новые): null/deleted-user fail-open → `enforce-deactivation-pdf-bullboard`;
  carry-over без guard состояния периода → `fix-carryover-persistence`; updatePeriodManual
  правит published-даты → `scope-period-lifecycle-authz`; hardcoded cookie-name + destructive-guard
  docstring → `input-and-error-hardening`; single-group comment drift → `code-health-and-test-cleanup`.
- **`bull-board.module.ts:45`** (6-й сайт хардкода cookie) теперь УЧТЁН в `input-and-error-hardening` (требование расширено на оба сайта + общий резолвер).
- **Чужие changes (параллельная сессия, НЕ из этого ревью):** `harden-jwt-verify-algorithms`,
  `refactor-auth-exemplary-layering` — в `openspec/changes/`, но созданы другим агентом; их
  статус уточняй отдельно.
- **C/D ревью:** прошли Codex-ревью + convergence round-2 (как A/B). Все changes `validate --strict` зелёные.
