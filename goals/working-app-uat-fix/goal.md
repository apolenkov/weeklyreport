# Goal — Working-app UAT + fix (all roles, one goal)

Довести веб-приложение customreport до проверенно-рабочего состояния: прокликать
все роли (lead / head / admin / viewer) через Playwright MCP, найти все
визуальные и алгоритмические проблемы, починить ВСЁ найденное до зелёного
(strict, ничего не откладывать), достроить split-view (лид: edit+slides рядом;
хед: сборный статус + слайд с переключением группировки продукт↔лид), и прогнать
code-quality + Vercel best-practice проходы. Исполнение максимально параллельное
(Haiku — скан, Sonnet — фиксы), Opus только где реально оправдан.

## Shared understanding

- **Facts:** [`facts.md`](./facts.md) — 11 outcome-фактов + process-факты
  (check-first, code-simplifier/modernization/review, ESLint/Prettier до
  стандартов, Vercel-аудит, параллельность).

## Execution plan

- **Plan:** [`plan.md`](./plan.md) — 8 шагов (bootstrap → sweep → verify →
  split-view → fix-waves → code-quality → Vercel → gates), approved через
  Plannotator gate.

## Done condition

Считается завершённым когда:

1. Все 4 роли (lead/head/admin/viewer) — 0 console-ошибок на свежем билде (Playwright re-sweep).
2. Лид: priorityRank персистится + edit/slides split-view работает (единый источник).
3. Хед: split-view сборного статуса + слайд-форма; переключение группировки продукт↔лид; Revoke/Revoke All работают при сданном лиде.
4. На ключевых экранах нет layout-jump (CLS≈0), скелетоны совпадают с контентом.
   SDLC-стадии показывают реальный цвет статуса даже для cross-author (не серый),
   замок = только read-only индикатор; ячейка окрашивается при ≥1 стадии/риске/блоке.
5. КАЖДАЯ найденная UAT-проблема (▲ и ▼) починена до зелёного — `.planning/audits/uat-findings-<date>.md` без открытых пунктов.
6. code-simplifier + code-modernization + code review прогнаны; ESLint/Prettier до стандартов; зависимости подтянуты; Vercel best-practice аудит выполнен.
7. Замороженные направления не тронуты (AI/RAG, тёмная тема, i18n, holidays, Telegram, Director) — проверяется по `git diff`.
8. Гейты зелёные: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm lint:md`.
   8b. Логирование покрывает ключевые пути (запросы/tRPC/БД-тайминги/медленные/ошибки); по логам UAT составлен список cache/index-возможностей, evidence-backed выигрыши применены.
9. Атомарные коммиты на `fix/PRJ-2/shiny-eagle`; рабочее дерево чистое.
10. Паритет lead↔head по экрану отчёта (добавлено по UAT-фидбеку 2026-05-22):
    - кнопка «Show archived periods» (`ArchiveToggle`) стоит рядом с выбором периода — и у лида, и у хеда;
    - всё, что сделано для лида, есть и у хеда; по layout между ними принципиально нет разницы;
    - выбор/сборка слайдов одинаковые; строка действий у хеда такая же, как у лида, но вместо Submit — submit-export / log; различие только в версии;
    - хед остаётся read-only (без редактирования секций).

## Starting base (already done this session)

Корень починен (протухший dev-сервер), priorityRank (write+read), revoke P6/P7,
поверхностный свип (4 роли = 0 ошибок), `lead-ui-fix-roadmap-2026-05-22.md` +
`uat-findings-2026-05-22.md`. Не переделывать — верифицировать и достроить.
