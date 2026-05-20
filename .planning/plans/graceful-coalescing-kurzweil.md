# Plan: graceful-coalescing-kurzweil

> Branch: `fix/PRJ-2/shiny-eagle` · Jira: `PRJ-2` · Status: planned · Date: 2026-05-20

## 0. TL;DR

Четыре связанных доработки на странице `/lead/report/[id]` по результатам
plannotator-фидбэка пользователя. Lead-роль — эталон. Базовые компоненты
адаптируем под Lead, Head выравниваем потом как отдельную фазу.

### Было

```text
┌─ now ────────────────────────────────────────────────────────┐
│ Priorities      │ отдельная таблица + секция; cross-author   │
│                 │ требует ручного merge в weekly-report.ts   │
│ Stage chip      │ locked → status="empty" → серая, теряем    │
│  (locked)       │ цвет реального риска другого автора        │
│ Version save    │ Saved → версия дёргается ≤60 с позже;      │
│ Version viewer  │ перелистывание v# показывает draft, а не   │
│                 │ snapshot; StageStatus вообще не в snapshot │
│ Head menu       │ status / dashboard / slides / history —    │
│                 │ четыре пункта, дублирование, не выровнен   │
│                 │ с Lead-эталоном                            │
└──────────────────────────────────────────────────────────────┘
```

### Проблема

```text
[Priority — отдельная сущность] → [cross-author aggregation хрупкий]
                                → [приоритеты живут вне action items]

[locked → status=empty]        → [серый чип съедает риск]
                                → [Lead не видит что у Бориса blocker]

[snapshot 1× per 60s + StageStatus вне snapshot]
                                → [version v# desync с Saved]
                                → [viewer показывает draft, не history]

[Head: 4 пункта меню]          → [Dashboard / Status+Slides / History
                                  должны быть 3 равнозначных вкладки]
```

### Станет

```text
┌─ target ─────────────────────────────────────────────────────┐
│ Priority        │ Item.priorityRank: Int? на item; отдельная │
│                 │ таблица Priority дроп; report сортирует    │
│                 │ items по rank; cross-author бесплатно      │
│ Stage chip      │ API возвращает реальный status для locked; │
│  (locked)       │ chip красит по риску + рисует замочек      │
│ Version         │ debounced snapshot 5 с после saveDraft;    │
│                 │ leadForm.getVersion(v) → полный data;      │
│                 │ viewer = read-only render snapshot;        │
│                 │ snapshot включает StageStatus per project  │
│ Head menu       │ Dashboard / Status / History (3 пункта);   │
│                 │ Status = текущий status + slides toggle;   │
│                 │ History = архив + переключалки = Lead      │
└──────────────────────────────────────────────────────────────┘
```

### Пайплайн фаз

```text
[F0 cleanup]──[F1 priorities]──[F2 locked]──[F3 snapshot]──[F4 head]──[F5 merge]
   git state    schema+UI       API status   sync+viewer    плана      MR в main
   ~0 LoC       ~700 LoC        ~200 LoC     ~500 LoC       ~600 LoC   review
   sanity       срочно          быстрый      важный баг     набросок   shipping
```

---

## 1. Context

Пользователь дал четыре блока plannotator-фидбэка на странице
`/lead/report/a0000000-0000-4000-8000-000000000001`. После уточнений:

- Lead-роль уже доработана и считается эталоном. Базовые компоненты подгоняем
  под Lead-форму, не наоборот.
- Сначала **приоритеты** — структурный рефактор модели данных.
- Затем — два UI/API бага (**stage-chip color** и **version snapshot**).
- В конце — **Head alignment**: меню Head = три равнозначных вкладки
  (Dashboard / Status / History), копирующих Lead toolbar там, где имеет смысл.
  Head оставляем как набросок плана, реализация — отдельная сессия.

Решения по архитектурным развилкам (получены через AskUserQuestion):

| Развилка          | Решение                                                                      |
| ----------------- | ---------------------------------------------------------------------------- |
| Priority model    | `Item.priorityRank: Int?` (свободное число, без потолка)                     |
| Migration         | Drop + reseed (Priority это mock/dev, прода нет)                             |
| Stage chip locked | API возвращает реальный `StageStatus` для locked-стадии в `stage.status`     |
| Snapshot scope    | Полный: debounce sync + `getVersion(v)` API + viewer read-only + StageStatus |

---

## 2. Сейчас

```text
branch:   fix/PRJ-2/shiny-eagle
commits:  38fa2e7..f05499e (6 × W15)
dirty:    .planning/memory/*.md (pre-existing, не in-scope)
tests:    485/485 passing
ledger:   .planning/plans/page-feedback-lead-report-a0000000-0000-shiny-eagle.md
          (closed) и -twinkly-milner.md (untracked, новый раунд)
```

Предыдущая сессия закрыла W15 (lock-icon, tooltip-accessibility, Dev↔Development
alias). Эта сессия открывает W16+ для новых фидбэков.

---

## 3. Recovered intent

Из фидбэка пользователя в этой сессии:

1. **Приоритеты — атрибут action item**, не отдельная сущность. Cross-author
   агрегация должна работать «бесплатно» через `Item.projectId`. Опционально:
   item может не иметь приоритета вовсе.
2. **Locked stage с риском другого автора** должен показывать его цвет, а не
   серый-empty. Серый остаётся только для реально пустых стадий.
3. **Версия в `VersionHistoryNav`** должна обновляться синхронно с Saved-state
   и показывать реальный snapshot этой версии, а не текущий draft. Snapshot —
   полный слепок всей формы, включая StageStatus каждой стадии.
4. **Head должен иметь панель Lead-уровня**: три вкладки — Dashboard, Status,
   History; show-archive ближе к period-selector; slides можно группировать
   по продуктам или по лидам.

---

## 4. Skill routing

| Skill / source            | Зачем                                                   |
| ------------------------- | ------------------------------------------------------- |
| `Demo-plan` (этот файл)    | Pipeline планирования; visual TL;DR; subagent roadmap   |
| Explore × 3 (Phase 1)     | Карта файлов: priorities / panel-parity / chip+snapshot |
| `gsd-execute-phase`       | Исполнение F1 → F2 → F3 параллельно по subagent-волнам  |
| `Demo-plan verify`         | Перед merge каждой фазы (rubric 0-100)                  |
| `react-best-practices`    | F2/F3 UI — read-only viewer pattern, derived state      |
| `typescript-expert`       | Zod-схема расширения, миграция типов на cross-author    |
| `postgresql-optimization` | Partial index `(reportSectionId) WHERE priorityRank`    |

Сознательно пропущено: `gsd-ai-integration-phase` (нет AI), `Demo-confluence`
(не документация для публикации), `security-audit` (правки не трогают auth/RLS).

---

## 5. Boundaries

| Слой                    | Что трогаем                                                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma schema           | `Item`, `VersionSnapshot.data` payload; drop Priority                                                                                                                             |
| Zod (`packages/shared`) | `itemInputSchema`, `versionSnapshotSchema`, submit-guards                                                                                                                         |
| API (`apps/api`)        | `lead-form.prisma-repository.ts`, `lead-form.service.ts`, `report-sections.*`, `weekly-report` aggregation, `sdlc-pipeline` status resolver                                       |
| Web (`apps/web`)        | `stage-chip.tsx`, `sdlc-pipeline.tsx`, `priorities-section.tsx`, `item-card.tsx`, `item-edit-dialog.tsx`, `version-history-nav.tsx`, `lead-form.tsx`, `use-lead-form-autosave.ts` |
| Slides                  | `lead-unified-slide.tsx`, `status-slide-deck.tsx`, `section-slide-utils.ts` (rank sort)                                                                                           |
| Tests                   | unit + snapshot + e2e regression (см. §10)                                                                                                                                        |
| Seeds                   | `prisma/seed.ts`, `prisma/seed-simple.ts`                                                                                                                                         |

**Не трогаем:**

- `apps/web/src/app/(app)/head/**` — F4 только проектируется; реализация
  отдельной сессией.
- `apps/api/src/modules/publication/**` — published reports (UAT не покрывает,
  отложено в F1 dual-read fallback внутри reader).
- `.planning/memory/*.md` dirty pre-existing — оставляем.
- Production Keycloak/auth flow.

---

## 5a. Phase F0 — Git state cleanup (preflight)

Ветка `fix/PRJ-2/shiny-eagle` накопила хвосты от W11..W15:

```text
┌─ git state ──────────────────────────────────────────────────┐
│ staged:    .planning/session-retros/NEXT-ACTIONS.md           │
│ modified:  21 × .planning/memory/*.md (12+/44- mass normalize)│
│ untracked: .planning/plans/...-twinkly-milner.md              │
│            .planning/screenshots/W15_*.png × 5                │
│            .planning/screenshots/slide_*.png × 11             │
│ stash:     stash@{0} lint-staged automatic backup             │
│ ahead:     30+ commits ahead of origin/main                   │
└──────────────────────────────────────────────────────────────┘
```

### F0.1 Stash inspection + drop

```bash
git stash show stash@{0} --stat
# если только формат-правки на уже-зафиксированных файлах:
git stash drop stash@{0}
# если внутри что-то полезное:
git stash show stash@{0} -p > /tmp/stash-review.diff
# и эскалирую решение пользователю.
```

Default: drop (это lint-staged auto-backup; pre-commit hook сохраняет копию до
prettier-pass; после успешного коммита backup безопасно удалить).

### F0.2 Memory + planning normalize commit

`.planning/memory/*.md` — mass normalize (12 insertions / 44 deletions на 21
файл = мелкая авто-нормализация маркеров/whitespace, не фактическое изменение
смысла). Закоммитить одним housekeeping-коммитом:

```bash
git add .planning/memory/*.md \
        .planning/plans/page-feedback-lead-report-a0000000-0000-shiny-eagle.md \
        .planning/session-retros/NEXT-ACTIONS.md
git commit -m "chore(planning): normalize memory + close shiny-eagle ledger"
```

### F0.3 Untracked plan commit

```bash
git add .planning/plans/page-feedback-lead-report-a0000000-0000-twinkly-milner.md \
        .planning/plans/graceful-coalescing-kurzweil.md
git commit -m "docs(planning): add twinkly-milner feedback round + kurzweil plan"
```

### F0.4 Screenshots — закоммитить как evidence

W15 screenshots — это UAT evidence для предыдущей сессии. Согласно недавней
конвенции (observation #225 от 2026-05-20) W14 artifacts уже коммитили
с pre-commit hooks. То же для W15 + slide\_\* серии:

```bash
git add .planning/screenshots/W15_*.png .planning/screenshots/slide_*.png
git commit -m "docs(planning): W15 + slides UAT screenshots evidence"
```

Альтернатива (если выберешь не коммитить): добавить
`.planning/screenshots/` в `.gitignore` и удалить локально.

### F0.5 Push hooks + rebase check

```bash
git push origin fix/PRJ-2/shiny-eagle           # сначала только это
git fetch origin main
git log --oneline origin/main..HEAD | wc -l     # ahead count sanity
git log --oneline HEAD..origin/main             # 0 lines ожидается; если нет — rebase
```

Если main продвинулся (расхождение > 0 строк): `git rebase origin/main` перед F1.

### F0.6 Done F0 ⇔

- `git status --short` пуст.
- `git stash list` пуст.
- `git log --oneline origin/main..HEAD` совпадает с локальным log.
- Ветка готова к F1 (clean working tree).

---

## 6. Phase F1 — Priorities как атрибут Item

### F1.1 Schema + migration

**Файлы:**

- `prisma/schema.prisma:291-312` — добавить `priorityRank Int?` в `Item`.
- `prisma/schema.prisma:358-373` — удалить модель `Priority` и обратную связь.
- `prisma/migrations/<timestamp>_drop_priority_add_item_rank/migration.sql` —
  новая миграция.

**SQL:**

```sql
ALTER TABLE "Item" ADD COLUMN "priorityRank" INTEGER;
CREATE INDEX "Item_section_priority_idx"
  ON "Item"("reportSectionId", "priorityRank")
  WHERE "priorityRank" IS NOT NULL;
DROP TABLE "Priority";
```

Никакой partial-unique-constraint — ранг свободный, может повторяться
(подтверждено решением пользователя).

### F1.2 Zod-схема

**Файл:** `packages/shared/src/schemas/report.ts`

- Расширить `itemInputSchema:88-98`: добавить
  `priorityRank: z.number().int().min(1).nullable().optional()`.
- Снять обязательность `priorities` в `submitSectionSchema:149-158`.
- Удалить `priorityInputSchema:121-127` и все ссылки на него.
- Удалить блокер `MISSING_PRIORITIES` (`report.ts:1038-1048`) — переформулировать
  если нужно как «items с priorityRank ≥ 1» (решение по новому правилу — см.
  §11 open questions, default: блокер убираем полностью).
- `activityLiveRowSchema.priorityCount:246` →
  `count(items.filter(i => i.priorityRank != null))`.
- `versionSnapshotSchema:892` — расширяется в F3 (см. §8.2).

### F1.3 API write/read

**Файлы:**

- `apps/api/src/modules/report-sections/lead-form.prisma-repository.ts`
  - `245-311, 392, 646, 674` — удалить delete-then-create логику Priority.
  - В `upsertItem` пробрасывать `priorityRank` из payload.
  - `345-427` (createVersionSnapshot payload) — убрать ключ `priorities`.
- `apps/api/src/modules/report-sections/lead-form.service.ts:60, 102` — снять
  поле `priorities` из return shape.
- `apps/api/src/modules/report-sections/report-sections.prisma-repository.ts:44,
107, 248, 337, 411-416` — убрать generic Priority include/write.
- `apps/web/src/lib/mappers/weekly-report.ts:251-301` — `groupByProduct`
  собирает items с `priorityRank != null` вместо `priorities[]`, сортирует
  по `priorityRank ASC, createdAt ASC`.
- `apps/api/src/modules/carry-over/**` — copy-priorities path упрощается: при
  переносе item на следующий период `priorityRank` сбрасывается в `null`
  (default: «новая неделя — новые приоритеты»). См. §11 open questions.

### F1.4 UI

**Файлы:**

- `apps/web/src/components/lead/priorities-section.tsx` (TODO PRIORITY-REDESIGN-01)
  - Превращается в read-only агрегат: рендерит items текущей секции с
    `priorityRank != null`, сгруппированные по продукту, сортированные по rank.
  - Заголовок «Priorities» оставляем, но это derived view, без edit.
  - Cross-author items добавляются через тот же mapper, что и в weekly-report.
- `apps/web/src/components/lead/priority-edit-dialog.tsx` — **удалить**.
- `apps/web/src/components/lead/item-edit-dialog.tsx` — добавить inline-поле
  `priorityRank` (number input, optional, без потолка).
- `apps/web/src/components/lead/item-card.tsx` — добавить chip-маркер «P{N}»
  слева от tag, если `priorityRank != null`.
- `apps/web/src/components/lead/lead-form.tsx` — снять валидацию `priorities`
  на submit guard если она там осталась.

### F1.5 Slides

- `apps/web/src/components/slides/section-slide-utils.ts` — при разбиении на
  слайды сортировать items внутри страницы по `priorityRank ASC` (null в конец).
- `apps/web/src/components/slides/lead-unified-slide.tsx` — рендерить chip «P{N}»
  рядом с item bullet, если есть.

### F1.6 Seed/mock

- `prisma/seed.ts`, `prisma/seed-simple.ts` — заменить `priorities.create`
  на `items.update` с `priorityRank: 1|2|3` для 2-3 items на seed-секцию.
- `apps/web/src/components/lead/mock-data.ts` — `KanbanItem` получает
  `priorityRank?`; `PriorityEntry` удаляется.

### F1.7 Tests F1

- `apps/web/src/components/lead/priorities-section.snapshot.test.tsx` —
  переписать snapshot под новый derived rendering.
- `apps/web/src/components/lead/priorities-section.test.tsx` — переписать unit
  под read-only behaviour.
- `apps/web/src/components/lead/priority-edit-dialog.test.tsx` — **удалить**.
- `apps/web/src/components/lead/item-edit-dialog.test.tsx` — добавить кейс
  set/unset priorityRank.
- `apps/web/e2e/regression/lead-priorities.spec.ts` — новый e2e.
- `apps/api/src/modules/report-sections/report-sections.contract.test.ts` —
  обновить shape без priorities.

---

## 7. Phase F2 — Stage chip locked color

### F2.1 Backend status resolver

**Файлы:**

- `apps/api/src/modules/report-sections/sdlc-pipeline.*` (resolver, см. backend
  карту в Phase 1 explore — `crossAuthorForStage` matching).
- При построении stage list для locked-стадии (`isLocked === true`) подставлять
  не `"empty"`, а реальный агрегированный статус другого автора. Логика:
  - если у другого автора есть items с `severity === blocker` → `"blocked"`
  - если есть risks или items с tag risk → `"at-risk"`
  - если есть любые items с workflowStatus done → `"on-track"`
  - иначе → `"empty"` (реально пусто и у другого автора)
- Применить Dev↔Development alias через утилиту `resolveStageName` из
  `apps/web/src/lib/mappers/lead-form.ts` (уже есть, использован в W15.4).

### F2.2 Frontend chip

**Файлы:**

- `apps/web/src/components/lead/stage-chip.tsx`
  - Никаких изменений в `STATUS_CONFIG` или палитре.
  - Замочек уже рисуется (W15.A). Оставляем.
  - Tooltip уже показывает crossAuthor itemCount/riskCount (W15.A). Оставляем.
  - Единственное изменение: тест-fixture теперь приходит с реальным
    `stage.status`, и `chipClasses` красит чип «как есть». Никакого if-branch
    для isLocked в цвете.
- `apps/web/src/components/lead/sdlc-pipeline.tsx:8` (`CrossAuthorEntry`) —
  оставляем как есть; `foreignStatus` не нужен, потому что API теперь даёт
  реальный `stage.status`.

### F2.3 Tests F2

- `apps/web/src/components/lead/stage-chip.test.tsx` — новые кейсы:
  «locked + at-risk → orange + lock», «locked + blocked → red + lock»,
  «locked + empty → gray + lock».
- `apps/web/e2e/regression/lead-locked-stage-color.spec.ts` — e2e: mock
  cross-author data с risk, проверить computed style locked-чипа.

---

## 8. Phase F3 — Version snapshot integrity

### F3.1 Debounced snapshot после saveDraft

**Файлы:**

- `apps/web/src/hooks/use-lead-form-autosave.ts`
  - После `onSuccess` saveDraft: тригерить отдельный debounced snapshot
    через `5_000ms` (вместо текущего `setInterval(60_000)` в lead-form.tsx).
  - Эмиттить событие `onSnapshotCommitted` после `createSnapshot.onSuccess`,
    чтобы UI знал когда обновить v# pill.
- `apps/web/src/components/lead/lead-form.tsx:751-760` — удалить
  `setInterval(60_000)`; вместо него использовать onSnapshotCommitted callback
  для прокидывания нового номера версии в `VersionHistoryNav`.
- Optimistic v#-bump: после `saveDraft.onSuccess` → optimistic increment
  локального `displayedVersion` (`v + 1`); по факту `createSnapshot.onSuccess`
  сверить с серверным `version` (consistency check, rollback если расхождение).

### F3.2 API getVersion(v) с полным data

**Файлы:**

- `apps/api/src/modules/report-sections/lead-form.prisma-repository.ts:179-202`
  - `listVersions` оставляем (метаданные для nav).
  - Новая процедура `getVersion(reportSectionId, version): Promise<VersionData>`
    — вытаскивает `VersionSnapshot.data` (full JSON) для конкретной версии.
- `apps/api/src/modules/report-sections/lead-form.service.ts` — обернуть
  `getVersion` в service-метод с проверкой доступа.
- `apps/api/src/infrastructure/trpc/trpc.router.ts:1978` — добавить tRPC
  procedure `leadForm.getVersion` рядом с `createSnapshot`.

### F3.3 Snapshot включает StageStatus

**Файлы:**

- `apps/api/src/modules/report-sections/lead-form.prisma-repository.ts:345-427`
  - В `createVersionSnapshot` payload добавить ключ `stageStatuses`:
    результат `prisma.stageStatus.findMany({ where: { reportSectionId } })`,
    сериализованный массив `{ projectId, stageName, status, ... }`.
- `packages/shared/src/schemas/report.ts:892` (`versionSnapshotSchema`) —
  расширить ключом `stageStatuses` array.
- `restoreVersion` (там же, строки 204+) — восстанавливать `StageStatus`
  обратно: `deleteMany` + `createMany` по сохранённому массиву.
- `prisma/schema.prisma:493` (`StageStatus`) — без изменений, схема уже есть.

### F3.4 Viewer как read-only render snapshot

**Файлы:**

- `apps/web/src/components/lead/version-history-nav.tsx:114-218`
  - При `currentIndex > 0` (т.е. выбрана историческая версия): пуллить
    `leadForm.getVersion(v)`, держать в локальном state как `snapshotData`.
  - Прокидывать `snapshotData` через новый context `ViewedSnapshotContext`
    (или prop drilling из `lead-form.tsx`) в дочерние секции.
- `apps/web/src/components/lead/lead-form.tsx`
  - Когда `viewedSnapshot != null`: переключить форму в read-only режим
    (re-use existing `isReadOnly` path); все секции рендерят данные из
    snapshot вместо `draftSection`.
  - Все edit-кнопки/inputs disabled. Submit/Save kept hidden.
- `apps/web/src/lib/mappers/lead-form.ts:515-535` — добавить
  `mapSnapshotToDraftPayload` mapper для derived rendering.

### F3.5 Tests F3

- `apps/web/src/components/lead/version-history-nav.test.tsx` — добавить
  кейсы: «v1 пуллит snapshot и рендерит DevOps-статус того момента»,
  «v# обновляется в пределах 5 с после Saved».
- `apps/api/src/modules/report-sections/lead-form.service.test.ts` — кейсы
  для `getVersion` и StageStatus restore.
- `apps/web/e2e/regression/version-history-snapshot.spec.ts` — full e2e
  под жалобу пользователя: правлю DevOps → жду 6 с → v# вырос → перелистываю
  на предыдущую → DevOps показывает старый статус.

---

## 9. Phase F4 — Head alignment (набросок плана)

> Эта фаза только проектируется. Реализация — отдельная сессия после F1-F3
> shipped.

### F4.1 Target menu

```text
┌─ Head top menu (target) ────────────────────────────────────┐
│  Dashboard │ Status │ History                                │
│  ────────  │ ──────  │ ─────                                  │
│  пульс       единый    архивы +                              │
│  команды,    отчёт +    переключалки                         │
│  пинги       slides     по периодам                          │
│              toggle                                          │
└──────────────────────────────────────────────────────────────┘
```

Сейчас (`apps/web/src/components/navigation/nav-bar.tsx:41-74`):
History / Dashboard / Status / Slides — четыре пункта. Slides — alias-редирект,
History и Status имеют почти одинаковую панель. Цель: убрать Slides из меню,
оставить три равнозначных раздела.

### F4.2 Shared toolbar (`components/report-shell/`)

Новый компонент `report-shell/report-toolbar.tsx` — выровненная панель из
`lead-form.tsx:1462-1490` и `head-history-client.tsx:94-104`. Children по роли.

```text
┌─ report-toolbar (shared) ───────────────────────────────────┐
│ [PeriodNavigator] │ [ArchiveToggle] │ ──slot── │ [extras…]   │
└──────────────────────────────────────────────────────────────┘
```

- Lead extras: `FillFromButton`, `VersionHistoryNav`.
- Head extras: `PublishLockButton`, `ExportPdfButton`.

### F4.3 Scope toggle 3-way

`components/report-shell/scope-toggle.tsx` — расширить
`slides/lead-scope-toggle.tsx` с 2-way (`own|product`) до 3-way
(`own|product|lead`). Head использует `product|lead`, Lead — `own|product`.

### F4.4 Dashboard сурфейс

Новый раздел Dashboard для Head — пульс команды:

- Кто из лидов какие секции не отправил.
- Активность за последние сутки.
- Quick-ping кнопка (placeholder в F4 plan, реализация — отдельный milestone).

Используется существующий `activity.live` tRPC procedure + новый
`apps/api/src/modules/dashboard/` модуль.

### F4.5 Show-archive ближе к period selector

Уже сейчас они стоят рядом в `report-toolbar` — после §F4.2 это естественно
получается. Lead-form (1462-1490) уже имеет такой порядок; Head-history тоже.
После extraction shared toolbar — единый порядок гарантирован.

### F4.6 Tests F4 (план)

- e2e: Head-меню содержит ровно 3 пункта Dashboard/Status/History.
- e2e: Head Status тоггл Edit↔Slides работает в обе стороны.
- e2e: Head Status scope toggle product↔lead меняет группировку слайдов.

> F4 — не для этой PR. Это документ для следующей сессии.

---

## 9a. Phase F5 — Merge в main (closeout)

После F1+F2+F3 merged в ветку и зелёных UAT smoke:

### F5.1 Pre-merge gates

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts
pnpm lint:md
# /codex:review на полный diff origin/main..HEAD
# /Demo-plan verify graceful-coalescing-kurzweil → ≥80
```

### F5.2 Squash decision

Ветка содержит 30+ коммитов от W5 до W16. Решения:

```text
вариант                       │ когда
──────────────────────────────│────────────────────────────────
squash в 1 fix(lead): PRJ-2   │ если main быстро двигается и
                              │ ревьюверу нужен один атомарный
                              │ обзор всего PRJ-2 milestone
──────────────────────────────│────────────────────────────────
preserve commit history       │ если важна git bisect-ability
(merge --no-ff)               │ и каждый W## должен оставаться
                              │ восстановимым
──────────────────────────────│────────────────────────────────
range squash по фазам         │ если есть W## с большими LoC,
(rebase -i, squash W1..W7,    │ а остальные — мелкие. Сохраняет
W8..W12, W13..W16)            │ читаемую историю milestone-level
```

Default: **preserve commit history через `--no-ff` merge** (бitstet-ability важна
для PRJ-2 traceability; W##-tagging уже сделан). Эскалирую если ревьювер
скажет «squash».

### F5.3 GitLab MR

Использовать `Demo-gitlab` skill:

```bash
# создать MR
/Demo-gitlab create-mr \
  --source fix/PRJ-2/shiny-eagle \
  --target main \
  --title "PRJ-2: lead-report UI round (priorities, locked color, snapshot)" \
  --description "<<EOF
## Summary

Three-phase refactor on /lead/report:
- F1: Priorities — атрибут Item (drop Priority table)
- F2: Locked stage chip — реальный цвет риска другого автора
- F3: Version snapshot — sync + viewer + StageStatus

F4 (Head alignment) — отдельный milestone, набросок в .planning/plans/.

## Plan
.planning/plans/graceful-coalescing-kurzweil.md

## Test plan
- pnpm typecheck, pnpm lint, pnpm test green
- Playwright regression suite green
- Manual UAT smoke по §10 (3 фазы × 4-6 шагов)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF"
```

### F5.4 Post-merge

```bash
git checkout main
git pull origin main
git branch -d fix/PRJ-2/shiny-eagle
git push origin --delete fix/PRJ-2/shiny-eagle   # только после approve
/Demo-jira transition PRJ-2 done
```

### F5.5 Done F5 ⇔

MR создан → review approved → merge в main → ветка удалена локально и на
origin → Jira PRJ-2 в статусе done или next-милестон.

---

## 10. Verification

### F1

```bash
pnpm --filter @customreport/api prisma migrate dev --name drop_priority_add_item_rank
pnpm typecheck
pnpm lint
pnpm test
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts \
  --grep "priorities"
```

Smoke:

1. Открыть `/lead/report/<id>` → секция Priorities видна как derived view.
2. Открыть item edit dialog → поле «Priority rank» доступно.
3. Поставить rank=1 → save → секция Priorities обновляется (item появляется).
4. Cross-author: открыть лид-секцию с продуктом, где другой лид поставил
   приоритет → этот item виден в derived secition с пометкой автора.

### F2

```bash
pnpm typecheck && pnpm test
pnpm --filter @customreport/web exec playwright test \
  --grep "locked-stage-color"
```

Smoke:

1. Открыть `/lead/report/<id>` где Борис — контрибьютор Development
   и поставил блокер.
2. Стадия Development → красный/оранжевый цвет + замочек.
3. Стадия Testing где никто ничего не делал → серый + замочек (если locked)
   или серый без замочка (если current lead).

### F3

```bash
pnpm typecheck && pnpm test
pnpm --filter @customreport/web exec playwright test \
  --grep "version-history-snapshot"
```

Smoke:

1. Открыть `/lead/report/<id>` v=N.
2. Поставить статус DevOps → подождать 6 с → v=N+1.
3. Saved индикатор пропадает раньше или одновременно с v# update — лимит 1 с.
4. Перелистнуть на v=N через ‹ → форма read-only, DevOps статус = пустой
   (то что было в N).
5. Перелистнуть на v=N+1 → DevOps статус = только что выставленный.
6. Restore v=N → DevOps статус снова пустой в активном draft.

### F4

Не верифицируем в этой PR. План добавляется в .planning/plans/ как
self-contained документ для следующей сессии.

---

## 11. Open questions (с дефолтами)

| #   | Вопрос                                                          | Default                                                    | Когда эскалирую                    |
| --- | --------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------- |
| Q1  | Carry-over: priorityRank переносится или сбрасывается?          | сбрасывается в null (новая неделя — новые приоритеты)      | если пользователь скажет «keep»    |
| Q2  | Submit-guard «хотя бы 1 приоритет»?                             | убираем полностью (приоритеты — опциональны)               | если приоритет станет обязательным |
| Q3  | StageStatus в restoreVersion: deleteMany+createMany или upsert? | deleteMany+createMany (atomic, проще)                      | если у юзера live другие сессии    |
| Q4  | Optimistic v#-bump или wait-snapshot?                           | optimistic (immediate) + rollback по серверному факту      | если flicker станет заметен        |
| Q5  | Snapshot debounce delay                                         | 5 с после saveDraft                                        | если пользователь жалуется         |
| Q6  | MAX_SNAPSHOTS оставлять 50?                                     | расширить до 100 — debounced snapshot будет создавать чаще | если БД-роль ограничит             |

Я применяю дефолты автономно и пишу их выбор в коде. Эскалирую только если
живой ответ пользователя сменит default.

---

## 12. Subagent roadmap

```text
Stage 0: Orchestrator (Claude Opus 4.7 — этот сеанс)
  -> live repo truth, evidence, intake, plan-write

Stage 1: Research (DONE в этой сессии)
  -> Explore × 3, Haiku-equivalent: priorities / panel / chip+snapshot

Stage 2: Synthesis (этот файл)
  -> Sonnet, no writes (Plan только что был, я его пропустил т.к. Explore
     дал достаточно — token economy)

Stage 3: Scoped workers (execution wave — следующая сессия)
  Wave A — параллельно:
    A1: F1.1+F1.2 (schema + zod) — Sonnet, write, files §6.1-6.2
    A2: F2.1 (backend status resolver) — Sonnet, write, files §7.1
    A3: F3.3 (snapshot StageStatus payload) — Sonnet, write, files §8.3
  Wave B — после A merge:
    B1: F1.3+F1.4 (API + UI items) — Sonnet, write, files §6.3-6.4
    B2: F1.5+F1.6 (slides + seed) — Sonnet, write, files §6.5-6.6
    B3: F2.2+F2.3 (chip tests) — Sonnet, write, files §7.2-7.3
    B4: F3.1+F3.2+F3.4 (sync + getVersion + viewer) — Sonnet, write, §8.1, 8.2, 8.4
  Wave C — после B merge:
    C1: F1.7 tests — Sonnet, write, files §6.7
    C2: F3.5 tests — Sonnet, write, files §8.5

Stage 4: Review (post-implementation)
  -> /codex:review on diff before commit
  -> /Demo-plan review --domain typescript,react,tests

Stage 5: Verify / commit / push (orchestrator)
  -> /Demo-plan verify graceful-coalescing-kurzweil → 0-100 rubric
  -> git commit (одна fixup commit per Wave для bisect)
  -> git push origin fix/PRJ-2/shiny-eagle
```

---

## 13. Token economy

| Work                       | Model                         | Writes        |
| -------------------------- | ----------------------------- | ------------- |
| Repo scan (этот сеанс)     | Haiku (Explore × 3)           | no            |
| Plan synthesis (этот файл) | Opus 4.7 orchestrator         | only plan.md  |
| Wave A/B/C implementation  | Sonnet 4.6 per worker         | yes, scoped   |
| `/codex:review`            | Codex (GPT)                   | no            |
| `/Demo-plan verify` final   | Sonnet 4.6                    | verify report |
| Deep model                 | Opus, only if Wave B conflict | no by default |

Iteration reserve: ≈15% контекста зарезервирован под Wave-B review-fix
и Wave-C test gaps.

---

## 14. Agent does / Human does

```text
─────────────────────────────────────
✓ Я ДЕЛАЮ САМ (тебе ничего не нужно)
─────────────────────────────────────
  ├── F0: git cleanup — stash drop, normalize-коммит, screenshots,
  │       untracked plans, push в origin (ветка не protected)
  ├── F1: schema/zod/api/ui/slides/seed/tests (~700 LoC)
  ├── F2: backend status resolver + chip tests (~200 LoC)
  ├── F3: sync + getVersion + viewer + StageStatus (~500 LoC)
  ├── F4: design-only documentation (плана), реализация не в этой PR
  ├── prisma migrate dev локально, прогон тестов
  ├── /codex:review до commit, /Demo-plan verify после
  ├── F5: создание GitLab MR fix/PRJ-2/shiny-eagle → main
  └── обновление .planning/STATE.md и ledger-mirror

─────────────────────────────────────
▲ ОТ ТЕБЯ
─────────────────────────────────────
  ├── ручной UAT smoke по §10 (3 фазы × 4-6 шагов)
  ├── решение по Q1-Q6 только если default неприемлем
  ├── approve MR в GitLab UI (последний шаг F5)
  └── F4 — отдельная сессия, начинать когда сам захочешь
```

---

## 15. Iteration reserve

- **Plan hardening:** после первого Wave A — повторно проверить evidence-claim
  про aggregation (если backend test упадёт по Dev↔Development alias на
  cross-author).
- **Self-review:** перед ExitPlanMode — проверить что F1 schema не сломает
  publication snapshot reader (старые published reports содержат `priorities`
  в JSON — нужен дефенсивный reader, см. §11 Q-default).
- **Feedback loop:** если пользователь скажет «приоритеты-rank свободные —
  это слишком фривольно» → откатиться к 1/2/3 enum за один Wave.
- **Evidence refresh:** перед Wave A — `git pull origin fix/PRJ-2/shiny-eagle`,
  убедиться что W15 коммиты не перетёрты.
- **Token reserve:** Wave C tests держим в отдельном subagent — не съедают
  контекст implementation workers.

---

## 16. Done definition

```text
F1 done  ⇔ pnpm test green; priority — атрибут Item;
           таблица Priority дропнута; UI rank-маркер виден;
           cross-author derived view без ручного merge.

F2 done  ⇔ locked stage chip с риском у Бориса — оранжевый/красный + замок;
           серый только когда реально пусто.

F3 done  ⇔ v# обновляется ≤1 с после Saved;
           getVersion(v) возвращает полный data;
           viewer показывает snapshot, не draft;
           StageStatus в snapshot и restore.

F4 done  ⇔ план обновлён в этом файле; реализации в этой PR НЕТ.

Whole plan done ⇔ F1+F2+F3 shipped, branch pushed, ручной UAT smoke зелёный.
```

---

## 17. Файлы (полный список to-modify)

```text
prisma/
  schema.prisma                                                            edit
  migrations/<ts>_drop_priority_add_item_rank/migration.sql               new
  seed.ts                                                                  edit
  seed-simple.ts                                                           edit

packages/shared/src/schemas/
  report.ts                                                                edit (itemInputSchema, versionSnapshotSchema, drop priorityInputSchema)

apps/api/src/modules/report-sections/
  lead-form.prisma-repository.ts                                           edit
  lead-form.service.ts                                                     edit
  lead-form.service.test.ts                                                edit
  report-sections.prisma-repository.ts                                     edit
  report-sections.contract.test.ts                                         edit
  sdlc-pipeline.*                                                          edit (locked-status resolver)
apps/api/src/modules/carry-over/                                           edit (priority carry-over upd)
apps/api/src/infrastructure/trpc/trpc.router.ts                            edit (+ leadForm.getVersion)

apps/web/src/components/lead/
  stage-chip.tsx                                                           edit (только тесты — поведение fix через API)
  stage-chip.test.tsx                                                      edit
  sdlc-pipeline.tsx                                                        edit (CrossAuthorEntry — без изменений; чистка)
  priorities-section.tsx                                                   rewrite (read-only derived)
  priorities-section.test.tsx                                              rewrite
  priorities-section.snapshot.test.tsx                                     update snapshot
  priority-edit-dialog.tsx                                                 delete
  priority-edit-dialog.test.tsx                                            delete
  item-edit-dialog.tsx                                                     edit (+ priorityRank)
  item-edit-dialog.test.tsx                                                edit
  item-card.tsx                                                            edit (+ P{N} chip)
  lead-form.tsx                                                            edit (snapshot interval → callback; viewedSnapshot context)
  version-history-nav.tsx                                                  edit (getVersion + read-only viewer)
  version-history-nav.test.tsx                                             edit
  mock-data.ts                                                             edit

apps/web/src/components/slides/
  lead-unified-slide.tsx                                                   edit (P{N} chip)
  section-slide-utils.ts                                                   edit (rank sort)
  status-slide-deck.tsx                                                    edit (если затрагивает)

apps/web/src/hooks/
  use-lead-form-autosave.ts                                                edit (debounced snapshot trigger)

apps/web/src/lib/mappers/
  lead-form.ts                                                             edit (mapSnapshotToDraftPayload)
  weekly-report.ts                                                         edit (items aggregation)
  lead-history.ts                                                          edit (если затрагивает)

apps/web/e2e/regression/
  lead-priorities.spec.ts                                                  new
  lead-locked-stage-color.spec.ts                                          new
  version-history-snapshot.spec.ts                                         new

.planning/
  STATE.md                                                                 update (after merge)
  plans/graceful-coalescing-kurzweil.md                                    THIS file
```

---

## 18. Global CLAUDE.md compliance audit

Этот раздел — обязательный self-check плана против глобального
`~/.claude/CLAUDE.md` и связанных rule-файлов. Каждое правило → проверка →
вердикт. Если найден gap — план правится до ExitPlanMode.

### 18.1 Current reality vs model memory (Epistemic verification)

Правило: «verify the installed version and current official docs before
acting». Проверка через package.json репозитория:

```text
┌─ verified package versions (2026-05-20) ─────────────────────┐
│ next            16.2.3                                        │
│ react           19.2.5                                        │
│ @nestjs/core    11.1.0                                        │
│ prisma          7.0.0      ◀── major bump от 5/6              │
│ zod             4.1.0      ◀── major bump от 3                │
│ @trpc/server    11.16.0                                       │
│ typescript      5.8.3                                         │
│ @playwright/test 1.55.0                                       │
│ @types/node     24.9.1     ◀── Node 24                        │
└──────────────────────────────────────────────────────────────┘
```

**Action items для F1/F3 перед написанием кода:**

- Context7 `prisma@7` — verify `migrate dev` CLI / schema field syntax не
  изменился; проверить `Int?` nullable column и `@@index … WHERE` partial
  index синтаксис.
- Context7 `zod@4` — verify `.nullable()`, `.optional()`, `z.union([])`,
  `z.literal()` сигнатуры; Zod 4 имеет breaking changes от Zod 3 в error
  formatting и некоторых helpers.
- Context7 `next@16` + `react@19` — verify Server Component / Client Boundary
  patterns не изменились для viewer read-only context.
- Context7 `@nestjs/core@11` — verify `Module` / `Service` / `Repository`
  pattern для нового `getVersion` endpoint.

Если какой-то из API-вызовов отклоняется от текущего synтакса — план
обновляется в F1.2 / F3.2 / F3.3 до начала coding. Не полагаюсь на training
memory.

### 18.2 Wheel reinvention gate

Правило: «WebSearch / Context7 / package registry перед любым custom feature».
Проверка по фазам:

| Фаза | Существующее решение оценено?                                                                                                                                        | Вердикт                               |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| F1   | priority как item-attribute — нет OSS-«priority field»; это domain-specific schema refactor поверх существующих Prisma+Zod                                           | custom obligatory, no wheel exists    |
| F2   | locked + colored chip — composition existing tailwind tokens + Lock icon (lucide-react уже в repo)                                                                   | reuse existing patterns               |
| F3   | snapshot/version system — рассмотреть `@tanstack/query` cache hooks для optimistic update (уже есть в repo); pgvector / event-sourcing — overkill для weekly reports | reuse + extend existing autosave hook |
| F4   | report-toolbar component — есть в `report-shell/`; scope-toggle есть в `slides/`; нужна generalization, не новый component                                           | extend existing                       |

**Action:** нет gap — все четыре фазы либо custom-domain (обязательно),
либо extending existing patterns. Никакой новый external package в этой PR
не вводится.

### 18.3 Source-first edits + drift awareness

Правило: «edit catalog source, не runtime». Проверка:

- Я НЕ правлю `~/.claude/*`, `~/.codex/*`, `~/.config/opencode/*`.
- Все правки — в `apps/`, `packages/`, `prisma/`, `.planning/`.
- Если потребуется добавить skill (см. §19.10 ниже) — он создаётся в
  `~/.claude/skills/<name>/` или в `core-principles/skills/<name>/` через
  `skill-creator` skill, не runtime-патч.

Вердикт: ✓ соответствует.

### 18.4 Eleven Pillars

| #   | Pillar               | Применение к плану                                                                                                 |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | TDD First            | F1.7/F2.3/F3.5 — failing tests перед impl каждой фазы                                                              |
| 2   | Always Ask           | 4 AskUserQuestion заданы перед написанием плана                                                                    |
| 3   | Socratic Review      | §15 iteration reserve, §19 этот audit                                                                              |
| 4   | Surgical Changes     | F2 — изменение цвета через backend resolver, без UI refactor; F1 — не трогаем publication snapshot reader в эту PR |
| 5   | Task Tracking        | §12 subagent roadmap с явным S-prefixed waves                                                                      |
| 6   | Memory               | session memory mirror в F0.2                                                                                       |
| 7   | Plan Before Code     | этот файл                                                                                                          |
| 8   | Rule Evolution       | §19.10 — proposed new skill `Demo-claude-md-audit`                                                                  |
| 9   | Config-First Skills  | использую `Demo-gitlab`, `Demo-plan`, `Demo-jira`                                                                     |
| 10  | Depersonalized Docs  | план не содержит имён людей, кроме демо-данных Boris/Vasily в фидбэке                                              |
| 11  | Subagent Parallelism | §12 waves A/B/C с параллельными Sonnet-workers                                                                     |

Вердикт: ✓ все 11 pillars применены.

### 18.5 Visuals (mandatory)

Правило: «structure → visual». Проверка по моему плану:

| Структура                   | Визуал в плане                           |
| --------------------------- | ---------------------------------------- |
| Sequence (5 phases)         | §0 «Пайплайн фаз» ASCII arrow chain      |
| Before/after                | §0 Было / Проблема / Станет ASCII frames |
| Hierarchy (files)           | §17 ASCII tree                           |
| Comparison (squash options) | §F5.2 ASCII table                        |
| Status (git state)          | §F0 ASCII frame                          |
| Priority                    | §4 dev-questions table                   |
| Parallel vs serial          | §12 Wave A/B/C                           |

Вердикт: ✓ все структуры имеют визуалы.

### 18.6 Caveman / Russian-English split

Правило: чат — Russian, code/paths/commands — English. Проверка плана:

- Чат-проза в плане — Russian.
- Все Latin tokens — в back-ticks (`Item`, `priorityRank`, `getVersion`),
  пути (`apps/web/src/...`), или config keys (`MAX_SNAPSHOTS`).
- Никакой Runglish-фрагментации типа «делаем refactor schema».
- Пользователь не подавал caveman-signal в этой сессии.

Вердикт: ✓ соответствует.

### 18.7 Behavior triggers (selected)

- «Task ≥3 steps → delegate to subagent» — §12 subagent roadmap ✓
- «Multi-file edit → typecheck + lint» — §10 verification ✓
- «Phase complete → write MEMORY» — F5.4 + post-merge memory mirror ✓
- «Before commit → all hooks green» — F5.1 gates ✓
- «Project-level CLAUDE.md» — repo `CLAUDE.md` Boundaries проверены в §5 ✓
- «Pre-propose self-check: can the agent do this itself?» — §14 split ✓
- «Two-block response format» — §14 двух-блочный split ✓
- «Recommend one option with rationale» — все 4 AskUserQuestion имели
  рекомендации, но не помечал явно «← рекомендую». Gap → правлю в будущих
  сессиях.
- «4-source fork resolution» — для priority-model развилки я использовал
  только user-answer (AskUserQuestion), не 4 parallel sources. Justification:
  это domain-design выбор, не technical fork; user — единственный source of
  truth для бизнес-логики. Acceptable deviation.

### 18.8 Repo overlay rules (CustomReport CLAUDE.md)

- «UI strings: production EN, RU только в data/seeds/tests» — все мои UI
  строки в F1.4 (chip `P{N}`, label «Priority rank») будут EN. ✓
- «Docker DB names: \_uat/\_dev/\_test suffix» — план НЕ трогает Docker
  config. ✓
- «Visual / theme work: research-only» — план не вводит dark-mode/theme.
  Цвет stage-chip — bug-fix, не theme refactor. ✓
- «Deferred features: TODO + loud stub» — F4 plan документирован, в коде
  никаких F4 stub-функций в этой PR. ✓
- «Director scope: не добавлять runtime director» — план не трогает
  director path. ✓
- «.planning/screenshots/ — не в gitignore» — verified, можно коммитить
  в F0.4. ✓
- «pnpm, не npm/Yarn» — все команды в §10/F5 используют pnpm. ✓

### 18.9 Planning template mandatory sections (rules/planning.md)

| Секция                     | Где в плане                          |
| -------------------------- | ------------------------------------ |
| TLDR (before/after + flow) | §0                                   |
| Architecture context       | §3 + §5 boundaries                   |
| Review state               | §2 (W15 closed, twinkly-milner open) |
| Стратегия выполнения       | §12 subagent + §13 token economy     |
| От человека                | §14                                  |
| Open questions             | §11 с дефолтами                      |
| Files to modify            | §17                                  |
| Verification               | §10                                  |
| Side deliverables          | §19.10 new skill proposal            |

Вердикт: ✓ все 9 секций есть.

### 18.10 Proposed new skill: `Demo-claude-md-audit`

Side deliverable из этой сессии — пользователь попросил автоматизировать
compliance-audit. Скилл должен:

```text
┌─ skill contract ─────────────────────────────────────────────┐
│ Name:     Demo-claude-md-audit                                 │
│ Path:     ~/.claude/skills/Demo-claude-md-audit/SKILL.md       │
│ Trigger:  /Demo-claude-md-audit <plan-file-or-diff>            │
│ Purpose:  пройтись по каждому правилу глобального CLAUDE.md   │
│           и сопутствующих rules/*.md, проверить план или      │
│           diff на соответствие, выдать REPORT.md              │
│ Input:    путь к плану .md / git diff range                   │
│ Output:   PASS / WARN / FAIL по каждому правилу + список      │
│           конкретных gap'ов и предложений как закрыть         │
│ Routing:  расширяет Demo-plan; альтернатива — режим            │
│           /Demo-plan audit-claude (как четвёртый режим к       │
│           plan/review/verify)                                 │
└──────────────────────────────────────────────────────────────┘
```

Реализационный подход:

1. Парсинг markdown глобального `~/.claude/CLAUDE.md` + всех
   `~/.claude/rules/*.md` на список нумерованных правил.
2. Для каждого правила — heuristic check (grep + structural assertion) или
   prompt-based LLM check.
3. Output — таблица «rule → verdict → evidence (file:line)».
4. Intergration с pre-commit hook (optional) и `/Demo-plan verify`.

**Реализация — в отдельном PR в `core-principles`**, не в этой
CustomReport-сессии. Создаётся через `skill-creator` skill.

Создание этого skill — TODO для следующего sweep по `core-principles`. В
этой PR ничего runtime-related не меняется.

### 18.11 Self-check итог

```text
┌─ compliance verdict ─────────────────────────────────────────┐
│ Epistemic verification   ✓ (versions verified from pkg.json) │
│ Wheel reinvention gate   ✓ (no new ext deps, reuse existing) │
│ Source-first edits       ✓ (no runtime patches)              │
│ Eleven Pillars           ✓ (all 11 applied)                  │
│ Visuals mandatory        ✓ (all structures rendered)         │
│ Russian/English split    ✓                                   │
│ Behavior triggers        ✓ (1 small gap on «← рекомендую»)   │
│ Repo overlay (CR)        ✓                                   │
│ Planning template        ✓ (all 9 sections)                  │
│ Side deliverable         ✓ (new skill proposal в §19.10)     │
└──────────────────────────────────────────────────────────────┘
```

Действия по результатам audit перед coding (Wave A pre-flight):

1. Context7 → `prisma@7`, `zod@4` для F1/F3 синтаксиса.
2. Context7 → `next@16`, `react@19` для viewer pattern в F3.4.
3. Mark «← рекомендую» в любых будущих AskUserQuestion в этой сессии.
4. После shipping этой PR — открыть отдельный issue в core-principles
   на создание `Demo-claude-md-audit` skill (§19.10).

---

## 19. См. также

- `.planning/plans/page-feedback-lead-report-a0000000-0000-shiny-eagle.md` —
  предыдущий round (closed).
- `.planning/plans/page-feedback-lead-report-a0000000-0000-twinkly-milner.md` —
  параллельный untracked раунд (untracked, проверить overlap перед Wave A).
- `apps/web/src/components/lead/priorities-section.tsx:87-92` —
  TODO PRIORITY-REDESIGN-01 sketch (готовая формулировка).
- `apps/web/src/lib/mappers/lead-form.ts` — Dev↔Development alias utility.
- `CLAUDE.md` repo — Boundaries, Deferred Features rules.
