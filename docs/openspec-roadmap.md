# OpenSpec backlog roadmap

Координирующий обзор активных OpenSpec-change-ей: порядок, зависимости и что
делать с каждым. Источник истины по задачам — сами `openspec/changes/*`; этот
файл лишь связывает их в один план. Обновлять при смене состава бэклога.

> Обновлено: 2026-06-08. Запусти `openspec list`, если прогресс устарел.

## Ключевая идея (РЕАЛИЗОВАНА)

Три change-а независимо описывали одно и то же — **per-role Playwright-свип на
console-ошибки**. Дублирование снято: `behavioral-ui-regression-gate` построил
единый движок свипа (Scenario Catalog из per-role YAML + swappable Driver +
автоматический `catalog-sweep.spec.ts`) и **заархивирован 2026-06-08** (его
спека продвинута в `openspec/specs/behavioral-ui-regression-gate/`). Остальные
два — его потребители, а не отдельные харнессы.

## Карта зависимостей

```
behavioral-ui-regression-gate   ✅ ARCHIVED 2026-06-08 — движок свипа (4 YAML-каталога,
        │                          Driver, автоматический catalog-sweep). Спека продвинута.
        ├── fix-sweep-ui-findings        ✅ ARCHIVED 2026-06-08 (дефекты свипа: 621→41)
        ├── extend-driver-remaining-roles ← НОВЫЙ, DEFERRED: AI-Driver fan-out
        │                                    head/admin/viewer (дорого, нужен живой app)
        ├── verify-a11y-recommended-flip   (потребитель: a11y-проверки через Driver)
        ├── ratchet-lint-to-strict         (Driver = страховка от origin-класса бага)
        └── final-gates-resweep            (его «re-sweep 4 ролей» = прогон свипа)

establish-scenario-catalog      ← SCOPE СЖАТ до drift-gate (см. ниже); ядро суперсед-нуто
defer-uat-codequality-vercel    ← DEFERRED родитель (Wave 1–5; final-gates = Wave 5)
```

## Порядок и действие по каждому активному change

| #   | Change                                    | Состояние / действие                                                                                                                                                                                                                                                                                                                         |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `final-gates-resweep`                     | **Почти закрыт.** Гейты зелёные 2026-06-08 (`typecheck`/`lint`/`test` 582 passed/`build` ✓); автоматический свип зелёный этой сессией (4 роли, 0 console/pageerror; остаток — отложенный color-contrast + benign network). Осталось: записать результаты (FGR-X1) + твой sign-off на архив (FGR-X3).                                         |
| 2   | `ratchet-lint-to-strict`                  | R0–R2b ВСЁ сделано (подтверждено git log). Открыто: **R2c** — Opus adversarial-review кластера `no-unnecessary-condition` (close-out, автономно); **R3** (sonarjs/unicorn/jsdoc/import-boundaries) — крупная свежая поверхность, по-кластерно нужны твои решения о softening. R3a free-кластер (import-sort, filename-case) можно автономно. |
| 3   | `verify-a11y-recommended-flip`            | VA-0a/0b: ~322 unit-rtl/snapshot теста — **автономно, но крупно**. VA-1..VA-4/VA-7/VA-8: живой браузер per-role → **через Driver** (= `extend-driver-remaining-roles`, отложен). VA-7 (preview-guard) код уже есть — нужен runtime sign-off.                                                                                                 |
| 4   | `extend-driver-remaining-roles`           | DEFERRED намеренно. AI-Driver fan-out head/admin/viewer (~171 MCP-вызов/роль на lead). Разблокирует runtime-часть #3. Запускать по явному «вперёд» + поднятый app.                                                                                                                                                                           |
| 5   | `establish-scenario-catalog`              | **SCOPE СЖАТ** (см. след. раздел). Ядро (.feature-каталог) суперсед-нуто per-role YAML из #engine. Выживает только **drift-gate SC-6/SC-7** (его официальный дом по NOTE behavioral-change). Остальное — суперсед/ре-хоум.                                                                                                                   |
| 6   | `defer-uat-codequality-vercel-2026-05-26` | DEFERRED родитель. Wave-3 дети уже в архиве. Единственная конкретная незакрытая поставка = final-gates (#1). Wave 1 (живой UAT) и Wave 3 (code-quality агенты) — по явному «вперёд».                                                                                                                                                         |

## Пересмотр scope: `establish-scenario-catalog` (2026-06-08)

Change задумывался как `file:line` .feature-каталог (389 сценариев, SC-1..SC-5)
плюс UX-tier. Этот подход был признан преждевременным для нестабильного MVP, а
движок свипа стал `behavioral-ui-regression-gate` (per-role YAML, архив). Поэтому
бо́льшая часть задач суперсед-нута. Позадачно:

- **ВЫЖИВАЕТ (единственная реальная работа):** `SC-6` + `SC-7` — CI-гейт дрейфа
  каталога (`catalog:check`: ре-деривация entry-point-поверхности, exit≠0 при
  surface вне каталога). Behavioral-change явно оставил drift-gate здесь
  (его NOTE 6.1). **Нужно решение:** против чего теперь чекать — per-role YAML
  каталоги и/или entry-point census, а не мёртвые `.feature`-файлы.
- **СУПЕРСЕД-НУТО движком свипа:** `SC-P3` (MCP reachable), `SC-9`
  (консолидированный per-role runtime sweep — это и есть `catalog-sweep.spec.ts`),
  `SC-10` (manual top-risk pass → Driver scope), `SC-13` (оркестрация архива
  других change-ей — теперь каждый закрывается своим треком).
- **УЖЕ СДЕЛАНО, осталось проставить галочку:** `SC-12` (period-dual-state ↔
  carry-over — разрешено, см. `findings/RECONCILIATION.md` + спин-офф
  `fix-period-dual-state-writers`); `O2` (products→projects naming — UI уже зовёт
  `saveProject`/`deleteProject`, `products-tab.tsx:87-101`); `O5` (ветка удалена).
- **РЕ-ХОУМ (перенести в живой дом):** `O3`/`O4` (Opus-review DI import-type +
  аудит lazy import-type) → `ratchet-lint-to-strict`; `O6` (coming-soon cards
  per role) → `verify-a11y-recommended-flip`; `O1` (устаревший комментарий
  `WorkingDays` в `prisma/schema.prisma:671`) → **нужен дом** (старый
  `cleanup-dead-enum-states` в архиве; однострочный фикс).
- **ОСТАЁТСЯ ЗАМЕТКОЙ:** `SC-11` (любой провал → отдельный change), `SC-14`
  (ratchet R3/R4 + defer-uat Waves 3–4 = явный бэклог) — процессные, не работа.

→ Итог: change схлопывается до **«drift-gate SC-6/SC-7 (ре-скоуп) + close-out
bookkeeping»**. Решение по судьбе: построить drift-gate (армия, код, без живого
app) ИЛИ оставить отложенным, а bookkeeping/ре-хоум провести отдельно.

## Что можно автономно (без твоих решений, без живого app)

- `final-gates-resweep`: гейты+свип уже зелёные → запись + sign-off на архив.
- `ratchet-lint-to-strict` **R2c**: Opus-review (close-out), и R3a free-кластер.
- `establish-scenario-catalog` bookkeeping: проставить SC-12/O2/SC-1..5; ре-хоум
  O3/O4/O6.

## Что требует ТВОЕГО решения

- Объём автономного прогона за сессию (дешёвые закрытия vs + крупная работа).
- Судьба `establish-scenario-catalog` (строить drift-gate vs оставить отложенным).
- `defer-uat` Wave 1 / Wave 3 — давать «вперёд» или держать замороженным.
- `ratchet` R3 — softening-выборы по каждому кластеру (sonarjs/unicorn/max-lines).

## Что требует живого app / Driver (отложено)

- `verify-a11y` VA-1..VA-4/VA-7/VA-8, `extend-driver-remaining-roles` fan-out,
  `defer-uat` Wave 1 live-UAT.

## Что НЕ делаем

- Не строим свип отдельно — движок уже есть (архив behavioral-change).
- Не реактивируем `.feature` Coverage Catalog; от #5 выживает только drift-gate.
- Не запускаем дорогой AI-Driver и Wave 3 code-quality агентов без явного «вперёд».
- Visual/theme/dark-mode/color-contrast — research-only, пока не выбрано направление.
