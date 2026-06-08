# Backlog Autonomous Execution Plan — handoff for a clean session

> **Transient run-book.** Дата: 2026-06-08. Ветка: `feat/behavioral-ui-sweep`.
> Этот файл — стартовая инструкция для **чистой сессии**: открыть его, поднять
> армию (Workflow) и прогнать автономный батч бэклога. Карта зависимостей и
> per-change анализ — в `docs/openspec-roadmap.md` (источник истины по задачам —
> `openspec/changes/*`). Удалить/обновить после того, как батч приземлится.

## 0. Чистая сессия: старт здесь

1. Модель главной сессии — **Opus** (она оркестрирует, синтезирует, ревьюит;
   качество первым). Агентов внутри Workflow назначать по §3.
2. Подтвердить контекст:
   ```bash
   git status --short --branch        # ждём: feat/behavioral-ui-sweep, чисто (кроме agentation-наследия — НЕ трогать)
   openspec list                      # свериться с прогрессом
   pnpm typecheck && pnpm lint && pnpm test && pnpm build   # baseline (2026-06-08 был зелёный: 582 test ✓)
   ```
3. Прочитать `docs/openspec-roadmap.md` (раскладка) и этот файл (батч).
4. Запускать треки §2 по порядку, каждый — отдельный Workflow; между треками
   читать результат и сверяться (оставаться в петле). НЕ запускать §4/§5.

## 1. Снимок состояния (что уже сделано)

- **Заархивировано 2026-06-08:** `fix-sweep-ui-findings` (дефекты свипа 621→41),
  `behavioral-ui-regression-gate` (движок свипа: 4 per-role YAML-каталога +
  swappable Driver + автоматический `e2e/sweep/catalog-sweep.spec.ts`; спека
  продвинута в `openspec/specs/behavioral-ui-regression-gate/`).
- **Создан:** `extend-driver-remaining-roles` (0/9) — отложенный AI-Driver
  fan-out для head/admin/viewer (дорого, нужен живой app).
- **Гейты:** зелёные на каждом push (pre-push гонит весь тест-сьют).
- **Не трогать:** untracked agentation-наследие (`.agents/`, `.codex/`,
  `opencode.json`, `skills-lock.json`, `.claude/skills/agentation*`, `.mcp.json`)
  — пользователь оставил как есть.

## 2. Автономный батч (армия; без живого app, без решений пользователя)

Порядок — по возрастанию риска. После каждого трека: `pnpm typecheck && pnpm
lint && pnpm test`, затем commit + push (ветка та же).

### Трек A — `final-gates-resweep` close-out (дёшево, БЕЗ армии)

- Прямой bash (агенты не нужны): `pnpm typecheck && pnpm lint && pnpm test &&
pnpm build` (FGR-G1..G4,G6) + `pnpm test:uat` (FGR-S1..S5, автоматический
  свип 4 ролей; этой сессией был зелёный — 0 console/pageerror; остаток =
  отложенный color-contrast + benign `/api/client-logs` ERR_ABORTED).
- Записать результаты в `tasks.md` (FGR-X1), `openspec validate --strict`,
  затем **archive** (FGR-X3). Архив этого change также трогает родителя
  `defer-uat` (Wave 5) — это ок, пользователь пред-авторизовал закрытие
  final-gates на зелёном. Если что-то красное (FGR-X2) — НЕ чинить вслепую,
  остановиться и спросить.
- Модель: Sonnet для записи архив-ноты (или прямо в главной сессии). Дёшево.

### Трек B — `verify-a11y-recommended-flip` VA-0a/0b: ~322 теста (ГЛАВНАЯ армия)

- Источник списка тестов — **`openspec/changes/verify-a11y-recommended-flip/design.md`**
  (266 unit-rtl + 56 snapshot). Нет тест-файлов для `groups-tab`, `products-tab`,
  `users-tab`; `status-slide-deck.test.tsx` и `periods-tab.test.tsx` расширить
  (Escape/keyboard/aria/dialog-assertions).
- Оркестровка (Workflow): сначала **inline-discover** — прочитать design.md,
  собрать work-list (компонент → требуемые тест-кейсы). Затем `pipeline` по
  компонентам: стадия 1 — агент пишет тест-файл компонента; стадия 2 — запускает
  `pnpm --filter @customreport/web test <file>` и чинит до зелёного; (опц.)
  стадия 3 — adversarial-verify, что ассерты проверяют ПОВЕДЕНИЕ (Escape реально
  закрывает диалог), а не просто render.
- Модель: **Sonnet** на написание RTL-тестов (нужна судьба про queries/ассерты);
  **Haiku** допустимо на чисто механические snapshot-тесты (decorative-SVG
  aria-hidden churn); verify-стадия — Sonnet, эскалация на Opus только при
  спорном кейсе. Не дробить мельче — качество важнее экономии.
- Done: VA-0a/0b/0d отмечены, весь `pnpm test` зелёный (был 582 → станет ~900).
- ВНИМАНИЕ: VA-1..VA-4/VA-7/VA-8 — НЕ здесь (живой браузер/Driver, см. §5).

### Трек C — `ratchet-lint-to-strict` автономные куски

- **R2c (Opus, close-out):** adversarial-review кластера `no-unnecessary-condition`
  (commits 61dfa215+459bebe9) — единственный незаписанный Opus-review. Один агент,
  модель **Opus** (это явно Opus-уровневое ревью риска). Записать вывод в tasks.md.
- **R3a free-кластер (Sonnet+Haiku):** установить плагины `simple-import-sort` и
  `unicorn`, включить `simple-import-sort` (автофикс) и `unicorn/filename-case`
  (репо уже 100% kebab — 0 нарушений). Применить автофикс, прогнать гейт. Модель:
  Sonnet (конфиг + проверка), Haiku — массовое применение автофикса. Установка
  пакетов — `pnpm add -D ... --network-concurrency=1` (см. грабли).
- **R3b JSDoc (Sonnet):** JSDoc на public-экспорты `packages/shared` + `packages/ui`
  (только публичные). Fan-out по модулям, Sonnet.
- НЕ здесь: остальной R3 (sonarjs cognitive-complexity, max-lines/complexity,
  import-boundaries) — по-кластерно нужны softening-решения (§4).

### Трек D — `establish-scenario-catalog` bookkeeping + ре-хоум (дёшево)

- **Галочки (Haiku):** SC-1..SC-5, SC-12 (см. `findings/RECONCILIATION.md`),
  O2 (UI уже зовёт `saveProject`/`deleteProject`, `products-tab.tsx:87-101`),
  отметить суперсед SC-P3/SC-9/SC-10/SC-13 с причиной.
- **Ре-хоум (Sonnet):** добавить O3/O4 в `ratchet-lint-to-strict/tasks.md`
  (Opus-review DI import-type + аудит lazy import-type), O6 в
  `verify-a11y-recommended-flip/tasks.md` (coming-soon cards per role); O1
  (устаревший комментарий `WorkingDays`, `prisma/schema.prisma:671`) — нужен дом
  (§4) или однострочный фикс прямо здесь, если пользователь разрешит.
- Судьба drift-gate SC-6/SC-7 — решение пользователя (§4). Если «строить» —
  это код-трек (Sonnet строит `catalog:check`, Opus ревьюит дизайн гейта).

## 3. Политика моделей (оптимизация, но качество первым)

| Уровень    | Когда                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------- |
| **Haiku**  | механика: галочки в tasks.md, массовый автофикс, snapshot-болванки, переименования          |
| **Sonnet** | рабочая лошадь: написание тестов, JSDoc, конфиг, ре-хоум, discover-чтение, средние ревью    |
| **Opus**   | R2c adversarial-review, дизайн drift-gate, спорные verify-кейсы, главная сессия-оркестратор |

Правило «не борщить»: не дробить один трек на 10 микро-агентов ради экономии;
один агент на компонент/модуль — нормальная гранулярность. Если выбор между
Haiku и Sonnet неочевиден — берём Sonnet.

## 4. Требует решения пользователя (НЕ делать автономно)

- `establish-scenario-catalog`: строить drift-gate SC-6/SC-7 (против чего чекать
  — per-role YAML и/или entry-point census) или оставить отложенным.
- `ratchet` R3: softening-выборы по кластерам (sonarjs complexity ≤?, max-lines
  exempt-dirs, unicorn pruning, import-boundary carve-outs).
- `defer-uat` Wave 1 (живой UAT) / Wave 3 (code-quality агенты) — давать «вперёд».
- O1 home (если не чинить однострочно в треке D).
- Visual/theme/dark-mode/color-contrast — research-only, пока не выбрано направление.

## 5. Требует живого app / Driver (отложено, нужно присутствие)

- `verify-a11y` VA-1..VA-4 (keyboard per-role), VA-7 (runtime guard sign-off),
  VA-8 (репро hydration).
- `extend-driver-remaining-roles` (AI-Driver fan-out head/admin/viewer).
- `defer-uat` Wave 1 live-UAT.
- Запускать только с поднятым app (`pnpm dev:fresh`, AUTH_DEV_MODE=true) и
  Playwright MCP; перед этим — фикс прокси уже на месте (`e2e/no-proxy-localhost.ts`).

## 6. Грабли / guardrails (проверять, не доверять памяти)

- **pnpm install hazard:** `pnpm add` может стереть `node_modules`; ставить с
  `--network-concurrency=1`. `npm install` тут падал — только pnpm.
- **e2e/** eslint-ignored И не под tsc-гейтом: валидировать `playwright test
--list` / `node --check`, а НЕ обычными гейтами.
- **Playwright webServer 502** на loopback = корпоративный прокси, не деградация
  машины; фикс durable в `e2e/no-proxy-localhost.ts`.
- **Prisma reset** в non-prod — рутина, разрешено (передать
  `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION`); прод не трогать.
- **UI-строки** в `apps/web/src/**/*.tsx` — английские (русский только данные/
  комментарии/тесты).
- **Хуки активны:** pre-commit (lint-staged: eslint+prettier) переформатит;
  pre-push гонит весь тест-сьют. Markdown с `+`/`-`/`*` в начале строки prettier
  превратит в bullet — не начинать абзац с этих символов.
- **Push-only**, без PR, пока не попросят.

## 7. Close-out каждого change

Для каждого: довести задачи → `pnpm typecheck && lint && test` зелёные →
`openspec validate <change> --strict` → `openspec-verify-change` →
`openspec archive <change> --yes` (deferred non-goals остаются непомеченными,
это ок) → commit (rename-архив) → push. Спека change-а с `## ADDED/MODIFIED`
синкается в `openspec/specs/` при архиве.
