# План — доделать всё machine-doable на `fix/PRJ-2/shiny-eagle`

## 0. Контекст (зачем это)

Сессия 3 закрыла большой UAT-бэклог. Сейчас на ветке есть остатки, которые
можно завершить без участия пользователя и без внешних блокеров (SSL на
`ghe.example.org`, manual UAT в браузере, замороженные направления). Цель —
один проход: закрыть code-TODO, зафиксировать рабочее дерево, подтвердить
гейты, и не лезть туда, где нужен человек/UI sign-off.

Что НЕ берём в работу (явно, чтобы не было соблазна):

```text
┌─ frozen / human-only / external ──────────────────────────────────────┐
│ next/font migration (TODO(VERCEL-FONT))    — нужен visual sign-off    │
│ dark theme / rebrand / backgrounds         — research-only            │
│ AI/RAG / Telegram / Holidays / Director    — заморожено               │
│ task #265 manual UAT status pill reset     — нужен живой UAT          │
│ push origin/main                           — SSL заблокирован         │
│ goals/accumulated-work-audit/              — рабочая зона пользователя│
└────────────────────────────────────────────────────────────────────────┘
```

## 1. TL;DR

### Было (сейчас на ветке)

```text
┌─ working tree ─────────────────────────────────────────────────────────┐
│ ?? .planning/audits/uat-*.png            (14 файлов UAT evidence)      │
│ ?? .planning/audits/sweep2-*.png         (2 файла sweep evidence)      │
│ ?? .planning/memory/2026-05-22-lead-uat-handoff.md                     │
│ ?? .planning/memory/2026-05-22-session2-final-handoff.md               │
│ ?? .planning/memory/project_session3_2026_05_22.md                     │
│ ?? .planning/plans/unified-baking-allen.md   (этот план)               │
│ ?? goals/accumulated-work-audit/         ← НЕ ТРОГАЕМ                  │
└────────────────────────────────────────────────────────────────────────┘

┌─ code TODO, который реально можно закрыть ────────────────────────────┐
│ TODO(STAGE-COLOR-SNAPSHOT)  apps/web/src/components/lead/lead-form.tsx│
│                             line 834                                  │
│ snapshot-режим: цвет чипа берётся ТОЛЬКО из stageStatuses,            │
│ риски и blocked-items снимка игнорируются. Кросс-автор и live-mine    │
│ уже идут через deriveEffectiveStageStatus — snapshot отстал.          │
└────────────────────────────────────────────────────────────────────────┘

┌─ verification gaps ────────────────────────────────────────────────────┐
│ CLS dashboard после 3f4cb01 (skeleton heights)  — baseline 0.0817      │
│   live re-trace не сделан                                              │
│ pnpm test/lint/build после d7085c9/fd0affd      — typecheck done       │
└────────────────────────────────────────────────────────────────────────┘
```

### Станет (после плана)

```text
┌─ working tree чистый ──────────────────────────────────────────────────┐
│ commit 1: UAT png + memory + audit findings                            │
│ commit 2: TODO(STAGE-COLOR-SNAPSHOT) closed                            │
│ commit 3: (опционально) этот план + CLS-trace результат                │
│ goals/accumulated-work-audit/  — остаётся untracked, не трогаем        │
└────────────────────────────────────────────────────────────────────────┘

┌─ code ────────────────────────────────────────────────────────────────┐
│ lead-form.tsx :838-873                                                 │
│ snapshotStageMap → теперь хранит risks + items per (productId, stage),│
│ displayProducts → deriveEffectiveStageStatus(traffic, risks, items)   │
│ → исторический снимок показывает цвет, который пользователь видел     │
│ в момент submit-а (а не «зелёный потому что блокирующих рисков нет     │
│ в текущей версии»)                                                     │
└────────────────────────────────────────────────────────────────────────┘

┌─ gates green ─────────────────────────────────────────────────────────┐
│ pnpm typecheck   0 errors                                              │
│ pnpm lint        4/4                                                   │
│ pnpm test        508+/508+ (новые snapshot unit-тесты добавляются)     │
│ pnpm lint:md     0 errors                                              │
│ pnpm build       OK                                                    │
│ CLS dashboard    <0.0817 (если живой замер показывает деградацию —     │
│                  оставляем TODO, не разбрасываемся скоупом)            │
└────────────────────────────────────────────────────────────────────────┘
```

### От человека

Ничего. Все шаги — machine-doable, без UI sign-off и без внешних систем.

## 2. Архитектурный контекст

```text
mine path (live):                              snapshot path (historic):
┌─ buildStageGrid ──────────┐                  ┌─ snapshotStageMap ───────┐
│ stageStatuses + risks +   │                  │ stageStatuses ONLY       │
│ items → derive helper      │                  │ → trafficToStageStatus   │
│ → правильный цвет          │                  │ → теряем риски/items    │
└────────────────────────────┘                  └──────────────────────────┘
        ✓ Phase C done                                  ← gap (этот план)

cross-author (locked):
┌─ enrichedCrossAuthors + caSection ─────────────────────────┐
│ stageRisks (severity) + stageItems (workflowStatus)        │
│ → deriveEffectiveStageStatus → цвет                        │
└────────────────────────────────────────────────────────────┘
        ✓ Phase A done

Helper:
  apps/web/src/lib/stage-status.ts
  deriveEffectiveStageStatus(explicit, risks[{severity}], items[{workflowStatus}])
  → max(explicit, severity→blocked|at-risk, workflowStatus==="blocked"→blocked)
```

Snapshot-payload уже несёт всё необходимое (см. SnapPayload at lead-form.tsx:879):

- `risks[]` имеет `projectId, stageName, severity`
- `items[]` имеет `projectId, stageName, workflowStatus`

Меняем только структуру `snapshotStageMap` (хранить риски + items per stage),
и в `displayProducts` применяем derive helper по образцу cross-author цикла.

## 3. Что меняем (3 файла, ~50 LoC + опционально CLS-trace)

```text
┌─ файл ──────────────────────────────────────┬─ изменение ────────────────┐
│ apps/web/src/components/lead/lead-form.tsx  │ snapshotStageMap расширить:│
│   :838-873                                  │ хранить {traffic, risks[], │
│                                             │ items[]}; displayProducts  │
│                                             │ через deriveEffectiveStage │
│                                             │ Status; TODO маркер убрать │
├─────────────────────────────────────────────┼────────────────────────────┤
│ apps/web/src/lib/stage-status.test.ts       │ +1-2 unit-теста на         │
│   (или новый файл если нет)                 │ snapshot-сценарий          │
│                                             │ (traffic=green но risk=    │
│                                             │ blocked → blocked)         │
├─────────────────────────────────────────────┼────────────────────────────┤
│ (untracked → tracked):                      │ commit 1 — UAT artifacts:  │
│ .planning/audits/uat-*.png (14)             │ evidence + memory files;   │
│ .planning/audits/sweep2-*.png (2)           │ goals/accumulated-work-    │
│ .planning/memory/2026-05-22-*.md (2)        │ audit/ НЕ stage-им         │
│ .planning/memory/project_session3_*.md      │                            │
└─────────────────────────────────────────────┴────────────────────────────┘
```

### Шаг 1 — snapshot derive (commit 2, основной code-change)

Раньше `snapshotStageMap` хранил `Map<productId, Map<stageName, string>>` с
сырым TrafficLight значением. Расширяем хранение до
`Map<productId, Map<stageName, {traffic, risks[], items[]}>>` и наполняем из
`raw.stageStatuses`, `raw.risks` и `raw.items` snapshot payload-а. В
`displayProducts` для каждого нелокированного stage:

```ts
const explicit = trafficToStageStatus(
  snap.traffic as TrafficLightStatus | null,
);
const status = deriveEffectiveStageStatus(explicit, snap.risks, snap.items);
```

И убрать `TODO(STAGE-COLOR-SNAPSHOT)` маркер.

Нюанс: используем уже существующий `normalizeStageName(...)` для алиаса
`dev ↔ development` (тот же приём что в cross-author цикле lead-form.tsx:801).

### Шаг 2 — test coverage (тот же commit 2)

Сверено с `apps/web/src/lib/stage-status.test.ts:1-26`: 6 существующих тестов
helper-а уже полностью покрывают все три derive-сценария (empty+severity,
empty+workflowStatus, on-track+at-risk precedence, blocked-explicit). Логика
derive не меняется — этот change только **проводка** новых аргументов в
существующий вызов.

Новые helper unit-тесты НЕ добавляем (избегаем дубликации).

Wiring (IIFE внутри `displayProducts`) не имеет чистого unit-seam — но он
покрыт косвенно: типизация при `pnpm typecheck`, e2e LSC-suite
(9 passed + 1 skipped on previous run), и ручной visual diff snapshot-режима
в браузере (опциональный шаг 4). Это сознательная брешь — не пишем
component-level тест ради него (overkill для wiring-only change).

Дополнительно используем существующий тип `SnapPayload` (lead-form.tsx:879-892,
уже содержит `risks[].severity` и `items[].workflowStatus`) — НЕ дублируем
inline cast; расширяем тип на `stageStatuses[]` field, если его там ещё нет.

### Шаг 3 — UAT artifacts commit (commit 1, до code-change)

Stage и закоммитить:

```text
.planning/audits/uat-admin.png
.planning/audits/uat-admin-reopen.png
.planning/audits/uat-admin-users.png
.planning/audits/uat-head-dashboard.png
.planning/audits/uat-head-history.png
.planning/audits/uat-head-report.png
.planning/audits/uat-lead-edit-dialog.png
.planning/audits/uat-lead-report.png
.planning/audits/uat-lead-slides.png
.planning/audits/uat-priority-rank-after-reload.png
.planning/audits/uat-viewer-report-detail.png
.planning/audits/uat-viewer-reports.png
.planning/audits/sweep2-lead-edit-dialog.png
.planning/audits/sweep2-lead-product-status.png
.planning/memory/2026-05-22-lead-uat-handoff.md
.planning/memory/2026-05-22-session2-final-handoff.md
.planning/memory/project_session3_2026_05_22.md
```

НЕ stage-им:

- `goals/accumulated-work-audit/` — рабочая зона пользователя.
- `.planning/plans/unified-baking-allen.md` — этот план; commit-им в commit 3
  вместе с CLS-trace результатом.

### Шаг 4 — CLS live re-trace (commit 3, опционально)

После всех code-commits — Playwright headless PerformanceObserver скрипт (тот
же паттерн что в session 2 `.planning/audits/uat-findings-2026-05-22.md`
строки 116-129). Записать результат в тот же файл отдельной секцией
«CLS re-trace 2026-05-23». Если CLS опустился — отметить. Если не опустился —
оставить TODO, НЕ менять `DashboardSkeleton` геометрию в этот проход
(scope creep).

### Шаг 5 — финальные гейты

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm lint:md && pnpm build
```

Все должны быть зелёные. Без зелёных гейтов — не коммитим.

## 4. Skill routing

| Intent                    | Skill / source      | Use / skip            |
| ------------------------- | ------------------- | --------------------- |
| code change snapshot path | inline edit         | ~30 LoC в одном файле |
| unit test snapshot derive | inline edit         | ~30 LoC test-only     |
| CLS measurement           | playwright headless | существующий паттерн  |
| commit hygiene            | git CLI             | 3 атомарных коммита   |

Пропущено: subagent fan-out (≤50 LoC реальных правок, дешевле inline);
chrome-devtools MCP (нет необходимости открывать живой браузер — CLS
измеряется headless через Playwright); next/font (фрозен).

## 5. Execution

```text
[1 commit untracked UAT artifacts]
   → [2 apply STAGE-COLOR-SNAPSHOT fix + tests + commit]
   → [3 gates: typecheck + lint + test + lint:md + build]
   → [4 (optional) CLS live re-trace + append findings]
   → [5 commit план + CLS-trace результат]
   → [6 git status clean кроме goals/accumulated-work-audit/]
```

Последовательно. Каждый шаг — атомарный коммит. Если шаг 3 падает — откат
шага 2, разбираемся с regression, потом повторно.

## 6. Open questions с дефолтами

| #   | Вопрос                                   | Дефолт                                                           | Эскалирую когда                        |
| --- | ---------------------------------------- | ---------------------------------------------------------------- | -------------------------------------- |
| 1   | snapshot payload точно несёт severity?   | проверяю через `git grep severity` в backend snapshot serialiser | если поле не пишется — TODO, отступить |
| 2   | CLS re-trace upgrade dashboard skeleton? | НЕТ в этом проходе — measure-only; если деградация → TODO        | если деградация >0.10                  |
| 3   | task #322 e2e добавляем?                 | НЕТ — выходит за «cleanup machine-doable», требует submit-flow   | если пользователь подтвердит           |
| 4   | commit .planning/plans/\* или нет?       | ДА, отдельным коммитом 3 (как historic context этой сессии)      | если pre-commit hook ругнётся          |

Вопрос 3 важен: автоматизация submit-flow для #322 — это +50-80 LoC e2e
spec-а, новый seed-вариант, etc. Это полноценная задача, не «остаток». Если
пользователь хочет — отдельный план.

## 7. Verification (acceptance gate)

```bash
# (a) gates after code change
pnpm typecheck                          # 0 errors
pnpm lint                               # 4/4 clean
pnpm test                               # 508+/508+ pass
pnpm lint:md                            # 0 errors
pnpm build                              # OK

# (b) TODO marker reduced
grep -n "TODO(STAGE-COLOR-SNAPSHOT)" apps/web/src/components/lead/lead-form.tsx
# → empty (marker removed)

# (c) working tree clean кроме известного
git status --short
# → должно показывать ТОЛЬКО:
#   ?? goals/accumulated-work-audit/
```

Сценарии:

```text
#   (d) snapshot-режим: чип Planning, traffic=green но риск severity=blocked →
#       deriveEffectiveStageStatus возвращает blocked → чип красный, lock-иконка
#       НЕТ (own author), не «зелёный потому что traffic green»
#   (e) snapshot-режим: чип DevOps, traffic=null, item workflowStatus=blocked →
#       чип красный (precedence blocked > empty)
#   (f) live-режим (snapshotStageMap=null) — behaviour без изменений
#   (g) cross-author path не тронут — Phase A работает как и раньше
#   (h) CLS dashboard < 0.0817 ИЛИ запись «не улучшилось, TODO оставлен»
```

## 8. Done definition

- [ ] commit 1: untracked UAT png (14+2) + 3 memory files закоммичены на
      `fix/PRJ-2/shiny-eagle`; `goals/accumulated-work-audit/` НЕ тронут.
- [ ] commit 2: `apps/web/src/components/lead/lead-form.tsx` snapshotStageMap
      расширен (risks + items), displayProducts через
      `deriveEffectiveStageStatus`, `TODO(STAGE-COLOR-SNAPSHOT)` маркер удалён.
- [ ] unit tests покрывают snapshot-сценарии (3 кейса — green+risk, null+item,
      yellow+at-risk precedence); существующие 6 тестов helper-а остаются
      зелёными.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm lint:md`, `pnpm build`
      все зелёные.
- [ ] CLS live re-trace выполнен; результат дописан в
      `.planning/audits/uat-findings-2026-05-22.md` секцией
      «CLS re-trace 2026-05-23» (improvement или TODO оставлен).
- [ ] commit 3: план `.planning/plans/unified-baking-allen.md` + CLS-trace
      запись закоммичены.
- [ ] `git status --short` показывает только
      `?? goals/accumulated-work-audit/` — больше ничего untracked/modified.
- [ ] tRPC `dev.wipeAndReseed` процедура НЕ тронута, прочие 14 спек НЕ тронуты,
      замороженные направления (AI/RAG, Telegram, dark theme, i18n, holidays,
      Director) НЕ тронуты, `apps/web/src/app/layout.tsx`/`pulse.css`/
      `globals.css` `--font-*` НЕ тронуты.
- [ ] Push в `origin/main` НЕ делаем (SSL заблокирован — внешнее, не цель).
