# План доработки — 2026-07-01 (verified triage)

Источник: read-only триаж-воркфлоу `wqo99tb53` (11 агентов, git+code cross-ref) +
inline tech-debt sweep. Ветка `impl/backlog-2026-06-30`. Решения зафиксированы в
`docs/feedback/decisions-locked-2026-06-30.md` — **открытых продуктовых развилок нет.**

## Что УЖЕ сделано (verify/archive-only, не переделывать)

- **35 backend/infra changes** — DONE-in-code, у каждого landing-commit (карта в триаже). Archive-ready.
- **C4 fix-slide-priority-ordering** — полностью влит `0b1e3882`. Archive-only.
- **C1 review — SERVER** — 100% влит `49083c1f` (schema, authz, все `review.*`, verdict→auto-un-submit, comment-aware saveSection, ADR 0009/0010, api-тесты). Остался ТОЛЬКО клиент.
- **C6 lead-form stage-access** — server-guard `dd7552f2` + клиент уже scoped (product→owned-stage, lock одной стадии, dead-end при нуле, mine-only по умолчанию). Готово.
- **6 из 9 заметок** — уже починены на исходниках (перефлагнуты на устаревшем docker-бандле): Submit-copy, ComingSoon один стиль, слайды (dup-header/toolbar-top/readiness), head toolbar (Present убран/ScopeToggle), C6 scoping, sticky lead toolbar.

## Что реально ОСТАЛОСЬ

| #         | Фича                       | Что                                                                                                                         | Ставки                            |
| --------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| C3        | project-activity-reporting | НОВОЕ. Схема (ProjectActivity + M:M + ActivityStatus) + admin `projectActivity.*` + write-path + read/snapshot + UI + тесты | HIGH (schema)                     |
| C2        | unified-activity-entry     | НОВОЕ. AppSettings-флаг + quick-add + bucket-проекция + move-in-place + delete-lock + uncarried-work + UI + тесты           | HIGH (schema, мутирует lifecycle) |
| C1-клиент | review surface             | Greenfield UI: ack / per-record comment / verdict / submitted-all toggle / lead-surfacing / тесты                           | HIGH                              |
| C7        | head-surface-declutter     | KPI slim (единств. net-new код) + verify-first (почти всё moot на свежем билде) + spec-deltas                               | LOW                               |
| C5        | responsive-compact         | dashboard reflow + touch-floor + density trim + R6 review-surface (зависит от C1-клиента)                                   | LOW                               |

Ещё живые заметки: #5 dashboard (→C7), #7a C1 reviewer surface (→C1-клиент), #7b seed one-lead-reported (→C1-клиент).

## Техдолг — вердикт: ЧИСТО

- 25 source-маркеров — почти все отложенные фичи (`ComingSoon`/`versions-v2`/`lead-pdf-export`/`Phase-55/59`/`i18n-future`). Осознанные traces, не долг.
- eslint per-file exempts — **JUSTIFIED PERMANENT**; R3a-4 grandfather ПУСТ («ratchet complete»).
- `env.schema` — без `.default()` по дизайну (no-fallback соблюдён).
- Опционально-косметика: несколько `TODO(Phase-NN)`/`TODO(UFB-074)` несут phase/ticket-рефы — по comment-hygiene их можно переписать без префикса. Низкая ценность.

## Требуют ТЕБЯ (человек-gated, автономно нельзя) — из #32 ci-deploy

1. CSP `Report-Only`→`enforce` flip — нужна in-browser валидация на 4 ролях.
2. base-image `sha256` digest-пины — нужен доступ к registry.
3. docker-build + `curl` prod-приёмка.

На диске стоят TODO-маркеры. Оставляю тебе.

## Волны (gate-serialized; два schema-wave строго последовательны)

- **W1** archive-bookkeeping (35 + C4 + ratchet-spec) — openspec-only, 0 кода.
- **W2** C3 server+schema (additive, schema-gate #1).
- **W3** C2 server+schema (mutation-heavy, schema-gate #2, после W2).
- **W4** C1 review-клиент (greenfield build → ai-ui-driver verify; folds заметки 7a/7b).
- **W5** C2+C3 клиентские поверхности (build → verify; после W4).
- **W6** C7 declutter + C5 responsive (low-stakes web; folds заметку #5).

Порядок доставки ценности — на согласовании (feedback-first vs технический). Harness:
waveb-autorun для high-stakes server/schema; ai-ui-driver-then-fix для UI-верификации.
