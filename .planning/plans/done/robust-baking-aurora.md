# Head Status Pages — Mirror Lead's Report+History+Slides Architecture

**Slug:** `robust-baking-aurora`
**Дата:** 2026-05-17
**Ветка-источник:** `fix/PRJ-2/uat-v7-2026-05-12` (рабочая, ahead 27 коммитов)
**Целевая ветка фазы:** `feat/head-report-history-slides` (отделить после Pre-flight)
**Статус:** draft (plan-mode, требует ExitPlanMode-approve)

---

## 0. Короткий TL;DR Для Человека

### Было

```text
роль head (она же «груп-лид»)
├── /head/dashboard       KPI + lead-summary
├── /head/report/[id]     read-only weekly (агрегат секций)
├── /head/slides          линейная колода слайдов (только current)
├── /head/report/[id]/present  full-screen presentation
└── (нет /head/history)
└── (нет переключателя form ↔ slides на одной странице)
```

Коротко: head имеет фрагментированный UX из четырёх отдельных страниц. Лид недавно получил консолидированный паттерн — одна страница `/lead/report/[id]?mode=edit|slides` (коммит `6ecfe82`). Head такого нет.

### Проблема

```text
[фрагментация UX]
        ↓
[нет mode-toggle] ─→ [нет history с режимами] ─→ [inline-код дублирован в lead-form.tsx]
        ↓
[head продублирует тот же inline-код]
        ↓
[через 2 итерации синхронно править в двух местах]
```

Коротко: без extract в shared head скопирует inline-pills/MetaRow/AccordionSection и закрепит технический долг. Поэтому extract — часть scope, не «потом».

### Станет

```text
роль head
├── /head/dashboard           (без изменений)
├── /head/report/[id]?mode=form|slides
│     ├── form  → WeeklyReportPage (read-only агрегат)
│     └── slides → HeadSlidesClient (chrome="content")
├── /head/history?period=&mode=form|slides
│     ├── period-навигатор (generic PeriodNavigator с urlBuilder)
│     ├── form  → WeeklyReportPage (за выбранный период)
│     └── slides → HeadSlidesClient (за выбранный период)
└── /head/report/[id]/present (kept)

shared/
└── components/report-shell/
      ├── view-mode-toggle.tsx
      ├── meta-row.tsx
      ├── accordion-section.tsx
      └── archive-toggle.tsx
```

Коротко: head получает два mode-toggle страницы (status-report + status-history), переиспользует shared-компоненты с лидом. Никаких новых DB-таблиц — всё на существующих tRPC `weeklyReport.get` + `reports.compiledHistory`.

---

## 1. Текущий State И Цель

**Сейчас:**

- Ветка: `fix/PRJ-2/uat-v7-2026-05-12`, ahead 27 коммитов от `origin`. Push блокирует SSL `forge.example.org` (см. `HANDOFF.json`).
- **▲ Внимание:** dirty files в репо — `apps/web/src/components/head/head-present-client.tsx`, `lead-form.tsx`, `lead-slides-client.tsx`, `status-slide-deck.tsx`, plus untracked `slides/slide-header.tsx` и план `image-1-velvet-pixel.md`. Это **параллельная незакоммиченная работа** над слайдами. Перед стартом Wave 0 — выяснить, чей это контекст (твой предыдущий заход или другая сессия) и либо закоммитить, либо stash, либо включить в scope.
- Milestone GSD: v8.1 «Closure & Recovery», 24/24 фаз, `blocked_by_ci`. Новая фаза-кандидат: **Phase 61** (post-v8.1).
- HANDOFF: 7 tasks `done` (PRJ-2 UAT v7 — Lead UX), все коммиты на ветке.

**Уже сделано (релевантное к нашему scope):**

- `6ecfe82` — inline slides view-mode toggle в `lead-form.tsx`.
- `3a0fe01`, `7b4f588`, `fa4ad65` — лид-тулбар реорганизация (archive toggle, submit/reopen, meta-row).
- `c10e086` — request-reopen dialog test coverage восстановлен.

**Цель (один проверяемый результат):**
Head может на одной странице `/head/report/[reportId]?mode=...` переключаться между read-only weekly report и slide-колодой, и так же на `/head/history?period=&mode=...` листать исторические периоды в обоих режимах — используя shared компоненты с лидом, без новых DB-сущностей.

**Не цель (границы):**

- ✗ Не добавляем head'у собственный editable отчёт (опция №3 в discuss отвергнута).
- ✗ Не создаём роль `group_lead` отдельно (используем существующую `head`).
- ✗ Не трогаем `prisma/schema.prisma` (нет миграций).
- ✗ Не редизайним `/head/dashboard` и `/head/report/[id]/present` (kept as-is).
- ✗ Не делаем head-snapshots внутри периода (опция отвергнута в discuss).

---

## 2. Skill Routing

| Intent                               | Skill/source                | Output             | Use / skip reason                                                  |
| ------------------------------------ | --------------------------- | ------------------ | ------------------------------------------------------------------ |
| Phase plan template                  | `Demo-plan`                  | this file          | primary skill, применён                                            |
| Pre-commit review substantive change | `/codex:review`             | findings           | mandatory gate перед commit Wave 5                                 |
| Adversarial architecture critique    | `/codex:adversarial-review` | contrarian read    | для решения `HeadReportShell` wrapper vs alt                       |
| TODO marker tracking                 | `Demo-todo-metrix`           | repo markers       | для `TODO(HEAD-CONSOLIDATE-01)` в Wave 5                           |
| Session retro/handoff                | `Demo-retro`                 | DONE/FRAGILE/LEFT  | в самом конце фазы для handoff                                     |
| GSD phase accounting                 | `/gsd-plan-phase`           | phase artifact     | НЕ применяем — это план под существующим slug, не GSD-phase ритуал |
| Confluence publish                   | `Demo-confluence`            | doc mapping        | skip — нет Confluence-доставки                                     |
| Jira tracking                        | `Demo-jira`                  | issue context      | skip — задача под PRJ-2 уже есть, нового тикета не надо            |
| Design audit                         | `Demo-design`                | UI gates           | skip — это refactor + новые routes, не design-driven               |
| graphify                             | `graphify update .`         | architecture graph | run ОДИН раз после Wave 3 для обновления `graphify-out/`           |

Skills/sources skipped: `Demo-confluence`, `Demo-jira`, `Demo-design`, `gsd-new-milestone` — задача repo-local, не cross-tool, не дизайн-первичная.

---

## 3. Главный Deliverable

> [!IMPORTANT]
> Head получает зеркало лидовского UX-паттерна: одна страница `/head/report/[id]` с inline-переключателем `?mode=form|slides` и одна страница `/head/history` с тем же переключателем и period-навигатором. Условие приёмки — оба mode корректно рендерят данные через существующие `weeklyReport.get` / `reports.compiledHistory`, без новых DB-таблиц и без новых tRPC procedures. Все вспомогательные правки (extract в `components/report-shell/`, generic `PeriodNavigator`) служат этой цели и переиспользуются лидом без регрессии.

---

## 4. Что Меняем

- **`apps/web/src/components/report-shell/` (new):** четыре shared компонента — `ViewModeToggle`, `MetaRow`, `AccordionSection`, `ArchiveToggle`. Извлекаются из inline-кода `lead-form.tsx` и трёх section-файлов.
- **`apps/web/src/components/slides/period-toolbar.tsx` (new):** extract `SlidePeriodToolbar` из `lead-slides-client.tsx:48-171`.
- **`apps/web/src/components/lead/period-navigator.tsx` (edit):** добавить prop `urlBuilder: (periodId) => string` с default-поведением для лида (backward-compat).
- **`apps/web/src/app/(app)/head/report/[reportId]/page.tsx` (edit):** парсить `?mode=`, валидировать, пробрасывать в новую обёртку.
- **`apps/web/src/components/head/head-report-shell.tsx` (new):** wrapper-компонент, который условно рендерит либо `<WeeklyReportPage>` (form), либо `<HeadSlidesClient chrome="content">` (slides), плюс `<ViewModeToggle>` сверху.
- **`apps/web/src/app/(app)/head/history/page.tsx` (new) + `apps/web/src/components/head/head-history-client.tsx` (new):** route + client с period-selector и mode-toggle.
- **`apps/web/src/components/navigation/nav-bar.tsx` (edit):** добавить History-пункт для роли `head`.
- **Tests (new):** vitest specs на 4 shared компонента + 2 playwright spec'a (`10-head-mode-toggle.spec.ts`, `11-head-history.spec.ts`) + pre-extract snapshots (Wave 0).
- **`prisma/schema.prisma`, `apps/api/**`, `packages/shared/**`:** **не трогаем**.
- **CLAUDE.md / overlay / runtime configs:** **не трогаем**.

---

## 5. Roadmap Субагентов

```text
[Wave 0: pre-extract snapshots — 1 Haiku]
       ↓
[Wave 1: extract presentational primitives — 3 parallel Haiku]
       ↓
[Wave 2: generic-ify reusable primitives — 3 parallel Haiku]
       ↓
[Wave 3: head pages new code — Sonnet, C1→C2→{C3‖C4‖C5}]
       ↓
[Wave 4: tests — Haiku ‖ Sonnet]
       ↓
[Wave 5: review + ship — /codex:review + /codex:adversarial-review]
       ↓
[final verify + commit + push + open PR + .planning/STATE.md bump]
```

| Stage | Agent             | Model tier          | Scope                                                                                   | Writes   | Output contract                      |
| ----- | ----------------- | ------------------- | --------------------------------------------------------------------------------------- | -------- | ------------------------------------ |
| 0     | Orchestrator      | strong (Sonnet)     | git/HANDOFF/STATE pre-flight                                                            | no       | список dirty-conflict, sync-точки    |
| Z1    | snapshot-author   | Haiku               | 4 файла `*.snapshot.test.tsx` (risks/decisions/priorities-section + lead-form viewmode) | yes      | 4 new test files, baseline snapshots |
| A1    | extract-1         | Haiku               | `ViewModeToggle`+`AccordionSection` из `lead-form.tsx` + replace в 2 файлах             | yes      | 2 new shared files + 2 edits         |
| A2    | extract-2         | Haiku               | `MetaRow` из 3 section-файлов                                                           | yes      | 1 new shared file + 3 edits          |
| A3    | extract-3         | Haiku               | `SlidePeriodToolbar` из `lead-slides-client.tsx`                                        | yes      | 1 new shared file + 1 edit           |
| B1    | generic-1         | Haiku               | `PeriodNavigator` add `urlBuilder` prop                                                 | yes      | 1 edit + test case                   |
| B2    | generic-2         | Haiku               | verify `VersionHistoryNav` уже generic                                                  | no       | report «as-is OK» / 1 edit           |
| B3    | generic-3         | Haiku               | extract `ArchiveToggle` из `lead-form.tsx`                                              | yes      | 1 new shared file + 1 edit           |
| C1    | route-author      | Sonnet              | `/head/report/[reportId]/page.tsx` parse `?mode=`                                       | yes      | 1 edit                               |
| C2    | wrapper-author    | Sonnet              | new `head-report-shell.tsx`                                                             | yes      | 1 new file                           |
| C3    | history-author    | Sonnet              | new `/head/history/page.tsx` + `head-history-client.tsx`                                | yes      | 2 new files                          |
| C4    | nav-author        | Sonnet              | `nav-bar.tsx` + `nav-bar.test.tsx`                                                      | yes      | 1-2 edits                            |
| C5    | layout-checker    | Haiku               | grep + read `head/layout.tsx`; правка только если нужна                                 | no/maybe | report                               |
| D1    | unit-test-author  | Haiku               | vitest для 4 shared компонентов                                                         | yes      | 4 new test files                     |
| D2    | e2e-test-author   | Sonnet              | playwright 2 spec'a                                                                     | yes      | 2 new test files                     |
| E1    | codex-review      | Codex (review)      | substantive uncommitted change                                                          | no       | PASS/findings                        |
| E2    | codex-adversarial | Codex (adversarial) | архитектура `HeadReportShell` wrapper                                                   | no       | second opinion                       |
| F     | Orchestrator      | strong (Sonnet)     | commit/push/PR/STATE bump                                                               | yes      | commits + PR URL                     |

**Не запускаем всё одной волной.** Между волнами sync-checkpoint: `pnpm typecheck`, `pnpm --filter @customreport/web test -- --run`, `pnpm lint`. На фейле останавливаемся.

**Conflict-guard:** A1+A3 оба правят `lead-form.tsx` — поэтому склеены в один Haiku-таск A1 (не запускаем параллельно). A2/A3 трогают разные файлы → безопасно параллельно.

---

## 6. Token Economy

- **Haiku** (Wave 0, 1, 2, B-stage, C5, D1): pre-extract snapshots, extract-refactor, generic-ify props, grep+read layout, vitest unit specs. Imperative I/O — классифицируется и проверяется.
- **Sonnet** (Wave 3 C1-C4, D2): новые routes, новый wrapper-компонент, новый history-client, playwright spec'ы — требуют синтеза с extracted блоками и существующим `WeeklyReportPage`/`HeadSlidesClient`.
- **Opus / deep model:** **не используется по умолчанию.** Эскалация только если codex-adversarial поднимает архитектурный риск (например, `HeadReportShell` оказывается неверной декомпозицией).
- **Codex (E1, E2):** обязательная gate перед commit; deep-tier не нужен — diff в пределах 1500 LoC.
- **Raw sessions / context:** не читать `.claude/projects/**/sessions/*.jsonl`; brief из `STATE.md`+`HANDOFF.json` достаточно.

**Бюджет: ≥60% токенов на Haiku в Wave 0-2-4; Sonnet/Opus только на Wave 3 и финальный синтез.**

---

## 7. Iteration Reserve

- **Plan hardening:** ещё одна итерация после ExitPlanMode-approve, если пользователь даст feedback на ASCII-схемы или decomposition. До старта Wave 0 — обновить план in-place.
- **Self-review:** §11 чеклист — gate перед стартом Wave 0.
- **Feedback loop:** между Wave 3 и Wave 4 короткий sync с пользователем («Wave 1-3 готово, диффы тут — go/no-go на тесты?»).
- **Evidence refresh:** перед Wave 0 проверить, что dirty files (head-present-client, lead-form, lead-slides-client, status-slide-deck) либо закоммичены, либо включены в scope — без этого extract сломается о merge-конфликты.
- **Token reserve:** держать ≥20% контекста на review/integration (Wave 5). Не сжигать на повторное чтение крупных файлов — использовать grep + line-ranges.

Default reserve: 15-20% времени/контекста фазы.

---

## 8. Visual Elements

Легенда: ✓ done · ✗ blocked · → next · ▲ risk · ? open

- `[!IMPORTANT]` в §3 — главный deliverable, без декорации.
- `[!WARNING]` отсутствует, но риски трекаются в §10 (open questions).
- `[!TIP]` отсутствует — нет «дешёвого default-пути» в этой фазе.
- ASCII-деревья в §0 (Было/Станет) и ASCII-flow в §0 (Проблема) — вместо mermaid, потому что план потребляется и в Plannotator, и в обычном markdown view.
- Все таблицы в §2, §5, §10, §13 — короткие cells, читаются в 100-char терминале.

---

## 9. Agent Does / Human Does

**Agent does (всё по умолчанию):**

- Pre-flight git/HANDOFF audit, классификация dirty files.
- Все 16+ subagent-волн (Haiku + Sonnet).
- Sync-checkpoint между волнами (`pnpm typecheck && pnpm lint && pnpm test`).
- `/codex:review` + `/codex:adversarial-review` + применение findings.
- Финальная регрессия (`pnpm test`, `pnpm --filter @customreport/web exec playwright test`).
- `graphify update .` после Wave 3.
- Atomic commits по wave-boundary, ветка `feat/head-report-history-slides`, push (если SSL на `forge.example.org` доступен).
- Открытие PR против `main` с описанием и test-plan чеклистом.
- Обновление `.planning/STATE.md` (новая запись Phase 61).
- Сохранение TODO-маркеров: `TODO(HEAD-CONSOLIDATE-01)` в `/head/slides/page.tsx`.
- После merge — `Demo-retro` для handoff и memory-update.

**Human does (только реально-нельзя-агентом):**

- Финальный approve PR в GitHub UI после зелёного CI.
- Если SSL на `forge.example.org` упадёт при push — дать команду «push через HTTPS workaround» или подождать.

Human не нужен по ходу разработки.

---

## 10. Open Questions With Defaults

| #   | Question                                                                                      | Default                                                                                                             | Ask human when                                                |
| --- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Принимает ли `weeklyReport.get` period как 1st-class arg?                                     | grep сигнатуру в `trpc.router.ts:1864+`, если нет — добавить optional `period?` параметр в Wave 3 C3 (no migration) | если потребует DB-migration или service-side refactor >50 LoC |
| 2   | Есть ли `invalidateWeeklyReport(period)` в `lib/cache-keys.ts`?                               | read файл; добавить если нет (5 строк)                                                                              | никогда — это автономно                                       |
| 3   | `/head/slides` legacy route — оставить или 307→`?mode=slides`?                                | оставить как есть, добавить `TODO(HEAD-CONSOLIDATE-01)` для отдельной фазы                                          | если у product-owner есть мнение «один-source-only»           |
| 4   | Head-strings в `HeadSlidesClient` — все English?                                              | grep `[а-я]` в файлах, ноль hits = OK; новые тоже English                                                           | никогда — правило UI-strings из `CLAUDE.md`                   |
| 5   | Конфликт `?mode=slides` с под-роутом `/present`?                                              | `/present` — отдельный page, не зависит от query; явный e2e-кейс в D2                                               | если e2e-падает                                               |
| 6   | History для head: dedicated `/head/history` или расширить общий `/reports`?                   | dedicated — параллельная страница, общий `/reports` не трогаем (viewer не сломаем)                                  | если есть требование «единая history для всех ролей»          |
| 7   | Dirty files в репо (head-present-client, lead-form, lead-slides-client) — чей контекст?       | в Pre-flight — `git diff` посмотреть; либо stash, либо включить в Wave 0 как baseline                               | если diff неопознаваем                                        |
| 8   | Создавать GSD Phase 61 артефакты (CONTEXT/PLAN/SUMMARY) или жить только в `.planning/plans/`? | жить в `.planning/plans/robust-baking-aurora.md`, в `STATE.md` короткая ссылка                                      | если milestone v8.2 явно запущен через `/gsd-new-milestone`   |

Блокеров (когда human обязателен) нет.

---

## 11. Self-Check

- [x] TL;DR (§0) понятен без чтения остального — три ASCII-блока Было/Проблема/Станет.
- [x] Skill routing (§2) с used и skipped.
- [x] Три «диаграммы» (ASCII-trees + flow) есть и читаются вертикально.
- [x] Subagent roadmap (§5) с model tier, scope, writes, output.
- [x] Haiku/Sonnet/Codex использование явное, deep model conditional.
- [x] Iteration reserve (§7) явный, 15-20%.
- [x] Visual elements — callouts только meaningful.
- [x] Open questions (§10) все с defaults.
- [x] Human не назначен на agent-doable работу.
- [x] Acceptance commands (§14) конкретные.
- [x] Pre-flight предупреждение о dirty files есть (§1).

---

## 12. Review Gate

**Pre-fix review (до Wave 0):**

- Strategy: read-only — Plan agent уже прошёл (см. exploration отчёт, 8 правок учтены).
- Output: PASS — план переоформлен под Demo-plan канон.

**Mid-fix review (после Wave 3 перед Wave 4):**

- Strategy: orchestrator читает diff'ы Wave 1-3, проверяет sync-checkpoints зелёные.
- Output: PASS → старт Wave 4, BLOCK → фикс перед e2e.

**Post-fix review (после Wave 4 перед commit Wave 5):**

- [ ] Source-of-truth alignment — extracted компоненты в `components/report-shell/`, не в случайных местах.
- [ ] Snapshot tests из Wave 0 после refactor дают нулевой diff.
- [ ] Тесты покрывают bug class — view-mode toggle, period navigation, role-gate.
- [ ] No unrelated dirty files touched — только из §4 списка.
- [ ] No hidden fallback zeros — нет `?? 0` без причины в head-history.
- [ ] Stale comments — комментарии в `lead-form.tsx` про inline view-mode toggle обновить.
- [ ] `/codex:review` PASS, findings либо применены, либо явно accepted в commit message.
- [ ] `/codex:adversarial-review` — нет архитектурного BLOCK.

**BLOCK handling:** resolve каждый BLOCK до Done Definition, или записать verified blocker в `.planning/STATE.md` с обоснованием «вне scope этой фазы».

---

## 13. Pillar Review

| Pillar          | Gate                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| Workflow        | соответствует `Demo-plan` + `~/.claude/rules/planning.md`                                                  |
| Git/branching   | новая ветка `feat/head-report-history-slides`, **не master/main**, не detached                            |
| Source of truth | tracked source first — extracted компоненты в `apps/web/src/components/report-shell/`, не runtime         |
| Tests           | pre-extract snapshots (Wave 0), unit tests (D1), playwright (D2) — конкретные команды в §14               |
| Skills/docs     | `pnpm lint:md` для `.planning/plans/*.md`; CLAUDE.md и overlay не трогаем                                 |
| Token economy   | Haiku для extract+grep, Sonnet для синтеза, Opus НЕ используется по умолчанию                             |
| Visual quality  | TL;DR в §0 в трёх отдельных ASCII-блоках, не одной широкой полосой                                        |
| Iteration       | self-review (§11) пройден до ExitPlanMode                                                                 |
| UI-strings      | новые head-strings — English (правило `CLAUDE.md`); grep `[а-я]` на изменённых production-файлах = 0 hits |
| Docker DB       | не трогаем — никакие destructive operations не требуются                                                  |
| Surgical        | scope ровно §4 — никакой адъяцент-refactor `WeeklyReportPage` или `HeadSlidesClient` без основания        |

---

## 14. Acceptance Gate

Sync-checkpoint после каждой волны (быстрый):

```bash
pnpm typecheck
pnpm --filter @customreport/web test -- --run --reporter=dot
pnpm lint
```

После Wave 1 specifically (snapshot diff должен быть пустой):

```bash
pnpm --filter @customreport/web test -- --run snapshot.test.tsx
```

Финальная регрессия после Wave 4 (перед codex review):

```bash
pnpm test
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts
pnpm lint:md
pnpm build
pnpm docker:local:verify
```

Manual e2e сценарии (e2e D2 покрывают, но локально пройти ещё раз):

- (a) login as head → `/head/report/<id>` → toggle Edit → verify weekly text → toggle Slides → verify deck navigates
- (b) login as head → `/head/history` → period prev/next 3 раза → mode toggle на каждом → no flicker, data correct
- (c) login as head → `/head/report/<id>/present` → ещё работает, под-роут не сломан
- (d) login as lead → `/lead/report/<id>` → toggle Edit/Slides → ничего не сломалось после extract
- (e) login as lead → `/lead/report/<id>` → submit / reopen → SectionStateActions работает после B3

Codex review gate перед commit:

```bash
/codex:review
/codex:adversarial-review
```

Git/state:

```bash
git status --short --branch
git log --oneline -5
```

---

## 15. Done Definition

Done только когда:

- ✓ Все файлы из §4 созданы / отредактированы.
- ✓ Sync-checkpoint после каждой волны зелёный (typecheck / lint / vitest).
- ✓ Pre-extract snapshots (Wave 0) после Wave 1 дают нулевой diff.
- ✓ Финальная регрессия зелёная: `pnpm test`, playwright regression, `pnpm build`, `pnpm docker:local:verify`.
- ✓ `pnpm lint:md` зелёный для `.planning/plans/robust-baking-aurora.md`.
- ✓ `/codex:review` PASS либо findings применены / явно accepted.
- ✓ `/codex:adversarial-review` — нет архитектурного BLOCK.
- ✓ Atomic commits сгруппированы по wave-boundary, на ветке `feat/head-report-history-slides`.
- ✓ Push прошёл (или зафиксирован verified-blocker «SSL forge.example.org»).
- ✓ PR против `main` открыт, с TL;DR-описанием и test-plan чеклистом.
- ✓ `.planning/STATE.md` обновлён — Phase 61 entry со ссылкой на этот план.
- ✓ TODO-маркер `TODO(HEAD-CONSOLIDATE-01)` сохранён в `/head/slides/page.tsx`.
- ✓ Никакой manual human step не остаётся, кроме approve PR в GitHub UI после зелёного CI.

---

## Pre-flight Checklist (перед стартом Wave 0)

- [ ] `git status --short --branch` — классифицировать dirty files (head-present-client, lead-form, lead-slides-client, status-slide-deck, prisma/seed-simple, slide-header.tsx, image-1-velvet-pixel.md). Каждый — либо stash, либо commit, либо явный baseline для Wave 0.
- [ ] `.planning/STATE.md` — добавить запись Phase 61 со ссылкой на этот план.
- [ ] `pnpm typecheck && pnpm lint && pnpm test` baseline зелёный.
- [ ] ExitPlanMode-approve пользователем подтверждён.
- [ ] Snapshot ветки на случай отката: `git tag pre-phase-61-snapshot`.
- [ ] Открытые вопросы 1-2 (cache-keys, weeklyReport.get signature) — быстрая 2-минутная проверка перед Wave 3, не блокирует Wave 0-2.
