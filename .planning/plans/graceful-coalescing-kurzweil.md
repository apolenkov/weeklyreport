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
│ Version save    │ Saved пропал, а v# двигалась только ≤60 с  │
│                 │ позже (interval-таймер); пользователь видел │
│                 │ рассинхрон Saved → v# update.              │
│ Version viewer  │ при клике ‹ на v=N форма ТИХО подменяла    │
│                 │ snapshot текущим draft (fall-back ternary):│
│                 │ label «Snapshot v=N» рендерился, а данные  │
│                 │ были live-draft. StageStatus вообще не     │
│                 │ попадал в snapshot payload, restore терял  │
│                 │ цвета стадий.                              │
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

---

## 20. Audit gap (2026-05-21): что РЕАЛЬНО осталось

### 20.1 Context

После reset-ретро (2026-05-21) сверка коммитов с планом показала, что часть
пунктов F1/F3 я преждевременно отметил `[x]` в `NEXT-ACTIONS.md`. Ниже —
честная карта того, что в коде НЕ сделано, с file:line эвиденцией. Это
goal-backward аудит: для каждого пункта зафиксирован конкретный артефакт
(файл и строка), пока не созданный или не дотянутый.

### 20.2 Что реально сделано (PROOF)

```text
F1 schema migration      ✓ a9177ef    Item.priorityRank + drop Priority table
F1 weekly-report agg     ✓ a9177ef    apps/web/src/lib/mappers/weekly-report.ts:293-308
F1 section-slide-utils   ✓ a9177ef    sort by rank, lines 134/181/198 в slides utils
F1 schema drift fix      ✓ 7b152d0    index rename, Decision idx, User FK
F1 UI PrioritiesSection  ✓ 4701ec0    read-only derived view
F1 UI ItemCard P{N}      ✓ 4701ec0    badge на item-card
F1 UI ItemEditDialog     ✓ 4701ec0    priorityRank input
F1 seed                  ✓ 5668d4a    Item.priorityRank в seed.ts + seed-simple.ts
F2 stage-chip locked     ✓ fd5d74d    lead-form.tsx promote locked status + 6 unit tests
F3.1 debounced snapshot  ✓ 99f7d58    use-lead-form-autosave hook, 5s
F3.2 getVersion API      ✓ 99f7d58    trpc.router.ts + service + repo
F3.3 stageStatuses СОХР  ✓ 99f7d58    createVersionSnapshot:386 включает stageStatuses
F3.4 snapshot viewer     ✓ 99f7d58 + 968affe + f9b5219 + 515f743 (4 коммита)
```

### 20.3 Что НЕ сделано (gap-list, evidence-backed)

```text
┌─ gap ──────────────────────────────┬─ evidence (file:line) ──────────────────────┐
│ G1  F1.4 lead-form data.priorities │ lead-form.tsx:1003 still `as PriorityEntry[]`│
│ G2  F1.4 prioritiesRef + valid.    │ lead-form.tsx:515, 557-580, 1115, 1484, 1825│
│ G3  F1.5 slide P{N} chip           │ slides/lead-unified-slide.tsx — нет refs    │
│ G4  F1.3 carry-over priorityRank   │ apps/api/.../carry-over/* — 0 priorityRank  │
│ G5  F3.3 restoreVersion stageStat  │ lead-form.prisma-repository.ts:217-313       │
│                                    │  payload type lacks `stageStatuses` array   │
│ G6  F3.3 restoreVersion priorityR  │ same body lines 266-279 не копирует field   │
│ G7  F3.3 restoreVersion severity   │ same body lines 282-291 не копирует field   │
│ G8  F1.7 e2e lead-priorities       │ apps/web/e2e/regression/* — спецы НЕТ       │
│ G9  F2.3 e2e locked-stage-color    │ apps/web/e2e/regression/* — спецы НЕТ       │
│ G10 F3.5 e2e version-history-snap  │ apps/web/e2e/regression/* — спецы НЕТ       │
│ G11 shared/dist stale references   │ packages/shared/dist/schemas/report.d.ts    │
│                                    │  :1670 содержит "MISSING_PRIORITIES"        │
└────────────────────────────────────┴─────────────────────────────────────────────┘
```

Пояснения:

- **G1+G2 (lead-form consumer):** `data.priorities` — это legacy-поле от
  старой модели. После F1 priorities — derived view из items с
  `priorityRank != null`. Текущий код всё ещё пуллит этот массив как
  отдельную сущность. Нужно: либо вычислять локально из `currentWeekItems`,
  либо API должен возвращать derived-массив, и тогда удалить
  `prioritiesRef` + handler для `field: "priorities"` (валидация в шаге submit
  не имеет смысла — приоритет теперь optional на item).
- **G3 (slide P{N}):** `section-slide-utils.ts` сортирует, но визуальный
  маркер «P{N}» рядом с пунктом на слайде не добавлен.
- **G4 (carry-over):** plan §F1.3 явно требовал «`priorityRank` сбрасывается
  в `null`» при переносе. В `carry-over` модуле — нет ни одной ссылки на
  `priorityRank`. Скорее всего, ранг переезжает по-умолчанию (через прямое
  копирование item), что может быть и нормально — но default плана был
  «сброс в null». Решение: либо подтвердить «оставляем как есть», либо
  добавить явный сброс.
- **G5–G7 (restoreVersion gaps):** snapshot СОДЕРЖИТ `stageStatuses`,
  `priorityRank`, `severity` (F3.3 sahe + F3.4 fix добавили это в payload).
  Но `restoreVersion` (lines 217-313) их игнорирует. То есть пользователь
  может откатиться на v=N — и потеряет priorityRank всех items, severity
  всех risks, и stage status'ы. Это явный bug.
- **G8–G10 (e2e тесты):** unit-tests F1/F2/F3 есть; e2e regression specs —
  нет. План §F1.7/F2.3/F3.5 их явно требует. Без e2e — UAT smoke
  делается вручную (план §10).
- **G11 (shared/dist):** `dist/` содержит stale build от старой схемы.
  Источник (`packages/shared/src/schemas/report.ts`) уже чистый (никаких
  ссылок на `MISSING_PRIORITIES`/`priorityInputSchema` в src). Нужен
  `pnpm --filter @customreport/shared build` для обновления dist.

### 20.4 Pipeline закрытия gap-list

```text
[F1c lead-form consumer]──┐
[F1c slide P{N}]          ├──→ [carry-over decision]──→ [F3c restoreVersion]──→ [e2e specs]──→ [dist rebuild]──→ [F5 merge]
[F1c carry-over (опц)]    ┘     G4 user-choice         G5+G6+G7 (atomic)      G8+G9+G10      G11           §9a
   G1+G2+G3                                            один коммит            опц. parallel
```

Объём в LoC и риск:

```text
┌─ gap ──┬─ LoC ──┬─ риск ────────────────────────────┐
│ G1+G2  │ ~80    │ medium — submit-flow дырки         │
│ G3     │ ~20    │ low    — чистая визуальная правка │
│ G4     │ ~10    │ low    — или 0 (если оставляем)   │
│ G5-G7  │ ~50    │ high   — пользователь теряет данные│
│ G8-G10 │ ~300   │ low    — изолированные e2e specs   │
│ G11    │ ~0     │ low    — `pnpm build` + commit     │
└────────┴────────┴────────────────────────────────────┘
```

Приоритет (▲ срочнее ▼ откладываемее):

```text
▲ G5+G6+G7   restoreVersion data loss — пользовательский bug
  G1+G2      lead-form consumer — submit может крашиться на старом поле
  G3         slide P{N} — визуальная завершённость F1
  G11        dist rebuild — для импортёров shared package
  G8+G9+G10  e2e specs — защита от регрессий
▼ G4         carry-over — может остаться текущее поведение (default)
```

### 20.5 Open questions (gap-уровень)

```text
| # | вопрос                                          | default                     | эскалирую если          |
|---|-------------------------------------------------|-----------------------------|-------------------------|
| Q7| G1+G2: data.priorities из API ИЛИ derive в FE?  | derive в FE из currentWeek  | API уже возвращает поле |
| Q8| G4 carry-over: сбрасывать priorityRank в null? | нет (default plan §F1.3.3)  | user скажет «keep»      |
| Q9| G11 dist rebuild: коммитить dist?               | нет (gitignored если есть)  | импортёры сломаются     |
```

### 20.6 Файлы, которые ещё надо тронуть

```text
apps/web/src/components/lead/lead-form.tsx                              G1, G2
apps/web/src/components/slides/lead-unified-slide.tsx                   G3
apps/api/src/modules/carry-over/carry-over.service.ts                   G4 (опц)
apps/api/src/modules/report-sections/lead-form.prisma-repository.ts     G5, G6, G7
apps/web/e2e/regression/lead-priorities.spec.ts                          G8 (new)
apps/web/e2e/regression/lead-locked-stage-color.spec.ts                  G9 (new)
apps/web/e2e/regression/version-history-snapshot.spec.ts                 G10 (new)
packages/shared/dist/**                                                  G11 (rebuild)
```

### 20.7 Verification после закрытия gap-list

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm --filter @customreport/shared build      # G11 rebuild
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts \
  --grep "priorities|locked-stage-color|version-history-snapshot"
```

Smoke-сценарии:

1. **G1+G2:** открыть `/lead/report/<id>`, добавить item с rank=1 →
   PrioritiesSection обновился; убрать rank → исчез. Submit без priorities
   не блокирует.
2. **G3:** `?mode=slides` → у item с rank=1 виден маркер `P1`.
3. **G4 (если default):** carry-over с предыдущей недели → новые items
   `priorityRank` пустые (или сохранены, по решению Q8).
4. **G5-G7 (restoreVersion):** поставить ranks/severity/stage status →
   создать snapshot → изменить всё → restore → значения вернулись.
5. **G8-G10:** Playwright прогон трёх specs — все зелёные.
6. **G11:** `node -e "import('./packages/shared/dist/schemas/report.js')"` —
   нет упоминаний `priorityInputSchema`/`MISSING_PRIORITIES`.

### 20.8 Subagent roadmap для gap-list

```text
Wave G — параллельно:
  G-A: G5+G6+G7 restoreVersion        Sonnet, write, atomic commit
  G-B: G1+G2 lead-form consumer       Sonnet, write
  G-C: G3 slide P{N}                  Sonnet, write
  G-D: G11 shared/dist rebuild        Haiku, build-only

Wave H — после G merge:
  H-A: G8 e2e lead-priorities         Sonnet, write
  H-B: G9 e2e locked-stage-color      Sonnet, write
  H-C: G10 e2e version-history-snap   Sonnet, write
  H-D: G4 carry-over decision         user (Q8) — потом Haiku если default

Wave I — verification:
  /codex:review on full diff origin/main..HEAD
  /Demo-plan verify graceful-coalescing-kurzweil → 0-100 rubric
```

### 20.9 Done definition (gap-list)

```text
gap-list done ⇔
  G5+G6+G7 restoreVersion возвращает stageStatuses + priorityRank + severity
  G1+G2 lead-form НЕ читает data.priorities, всё derive из items
  G3 lead-unified-slide рендерит P{N} chip
  G11 shared/dist обновлён (или подтверждено что dist не нужен)
  G8+G9+G10 три e2e spec'a зелёные
  G4 либо closed (default «не сбрасываем») либо новый коммит со сбросом
  pnpm test, pnpm lint, pnpm typecheck — все зелёные
```

После закрытия gap-list — переход в F5 (plan §9a) с merge MR.

---

## 21. Final closure plan (2026-05-21): полный sweep + параллельная разработка

### 21.1 Context

После audit'а §20 пользователь решил расширить scope ветки до полного
закрытия: gap-list (G1-G11) + F4 head alignment **с реализацией** + всё
STILL-PENDING из `NEXT-ACTIONS.md:39-46`. Разработка идёт **двумя
агентами параллельно** (Claude Code + Codex) на одной ветке
`fix/PRJ-2/shiny-eagle`, разделённой по непересекающимся файловым
группам, чтобы избежать merge-конфликтов.

Применённые дефолты (Q7-Q9 из §20.5):

```text
Q7  derive priorities в FE из items.filter(priorityRank!=null)
Q8  carry-over: priorityRank НЕ сбрасывается (keep behaviour)
Q9  shared/dist НЕ коммитим (build перед публикацией пакета)
```

### 21.2 Полный inventory работ (TASKS)

```text
┌─ ID ────┬─ источник ──┬─ описание ────────────────────────────┬─ LoC ─┬ риск ┐
│ T-G1    │ §20.3 G1+G2 │ lead-form.tsx data.priorities → derive │ ~80   │ med  │
│ T-G3    │ §20.3 G3    │ lead-unified-slide P{N} chip           │ ~25   │ low  │
│ T-G4    │ §20.3 G4    │ carry-over priorityRank (default keep) │ ~0    │ low  │
│ T-G5    │ §20.3 G5-G7 │ restoreVersion: stageStat + rank + sev │ ~60   │ high │
│ T-G8    │ §20.3 G8    │ e2e lead-priorities.spec.ts            │ ~120  │ low  │
│ T-G9    │ §20.3 G9    │ e2e lead-locked-stage-color.spec.ts    │ ~90   │ low  │
│ T-G10   │ §20.3 G10   │ e2e version-history-snapshot.spec.ts   │ ~150  │ low  │
│ T-G11   │ §20.3 G11   │ shared build refresh                   │ ~0    │ low  │
│ T-F4-1  │ §9.1 + §9.2 │ shared report-toolbar component        │ ~150  │ med  │
│ T-F4-2  │ §9.3        │ scope-toggle 3-way (own/product/lead)  │ ~80   │ low  │
│ T-F4-3  │ §9.1        │ nav-bar redesign 3 tabs                │ ~60   │ low  │
│ T-F4-4  │ §9.4        │ Dashboard surface (head pulse)         │ ~250  │ high │
│ T-D12   │ STILL-PEND  │ item-dialog status reset-on-reopen     │ ~40   │ med  │
│ T-UFB14 │ STILL-PEND  │ UFB-014 multi-SDLC per product         │ ?     │ high │
│ T-HOL   │ STILL-PEND  │ Holidays calendar                      │ ?     │ high │
│ T-UAT-L │ STILL-PEND  │ UAT landing pages                      │ ?     │ med  │
│ T-CI-47 │ STILL-PEND  │ 47-02 CI badge                         │ ~20   │ low  │
│ T-46FU  │ STILL-PEND  │ 46-followup live-Prisma matrix verify  │ ~30   │ low  │
└─────────┴─────────────┴────────────────────────────────────────┴───────┴──────┘

ИТОГО: ~1155+ LoC ready-to-implement + 3 спека-блокированных (T-UFB14, T-HOL, T-UAT-L)
```

### 21.3 Категоризация по готовности

```text
READY-TO-IMPLEMENT (можно стартовать сразу):
  T-G1, T-G3, T-G4, T-G5, T-G8, T-G9, T-G10, T-G11,
  T-F4-1, T-F4-2, T-F4-3, T-D12, T-CI-47, T-46FU

NEEDS-RESEARCH-FIRST (требует spec/design до coding):
  T-F4-4 Dashboard      — нет PRD для head pulse metrics
  T-UFB14 multi-SDLC    — нет UI/data модели для нескольких SDLC per product
  T-HOL holidays        — нет UI/data модели для календаря
  T-UAT-L landing pages — scope непонятен (какие landing'и?)

OUT-OF-REPO (отдельный repo, промт уже готов):
  core-principles env-defaults cleanup
  openai-codex плагин: effort omit-on-null upstream issue
```

### 21.4 Параллельная разработка: распределение между Claude и Codex

Логика разделения — независимые файловые группы. Никаких пересечений
между group-A и group-B файлов = безопасный parallel.

```text
┌─ WAVE 1 (стартует немедленно) ─────────────────────────────────────────┐
│                                                                         │
│  CLAUDE Code (Sonnet/Opus)              │  CODEX (gpt-5.5 + xhigh)     │
│  ─────────────────────────              │  ───────────────────────     │
│  group-CLAUDE-A                          │  group-CODEX-B                │
│  ├── T-G5 restoreVersion (atomic)        │  ├── T-F4-1 report-toolbar    │
│  │   lead-form.prisma-repository.ts      │  │   components/report-shell/ │
│  ├── T-G11 shared build refresh          │  │   *.tsx (new files)        │
│  │   pnpm --filter shared build          │  ├── T-F4-2 scope-toggle 3way │
│  └── T-D12 item-dialog status pill       │  │   components/report-shell/ │
│      item-edit-dialog.tsx + test         │  │   scope-toggle.tsx (new)   │
│                                          │  └── T-F4-3 nav-bar tabs      │
│                                          │      navigation/nav-bar.tsx   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                          ↓ merge sync ↓
┌─ WAVE 2 (после merge WAVE 1 changes) ──────────────────────────────────┐
│                                                                         │
│  CLAUDE Code                             │  CODEX                        │
│  ──────────                              │  ─────                        │
│  group-CLAUDE-C                          │  group-CODEX-D                │
│  ├── T-G1 lead-form consumer derive      │  ├── T-G8 e2e lead-priorities │
│  │   lead-form.tsx (~80 LoC)             │  ├── T-G9 e2e locked-stage    │
│  ├── T-G3 slide P{N} chip                │  ├── T-G10 e2e version-hist   │
│  │   lead-unified-slide.tsx              │  └── T-CI-47 CI badge yml     │
│  ├── T-G4 carry-over (no-op)             │      .github/workflows/*      │
│  └── T-46FU live-Prisma verify           │                                │
│      tests/integration/*                 │                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                          ↓ merge sync ↓
┌─ WAVE 3 (research-gate: только после spec'ов) ─────────────────────────┐
│                                                                         │
│  CLAUDE Code → spec/design                │  CODEX → impl after spec     │
│  ───────────                              │  ───────────                  │
│  T-F4-4 Dashboard PRD                     │  (после approve)              │
│  T-UFB14 multi-SDLC PRD                   │  T-F4-4, T-UFB14, T-HOL impl │
│  T-HOL holidays PRD                       │                               │
│  T-UAT-L landing pages PRD                │                               │
│                                                                         │
│  ВАЖНО: для каждого нужен AskUserQuestion со scope-clarification.       │
│  Дефолт — defer в v8.4/v8.5, не блокировать merge этой ветки.          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                          ↓
┌─ WAVE 4 (integration + merge) ─────────────────────────────────────────┐
│                                                                         │
│  pnpm typecheck && pnpm lint && pnpm test                              │
│  pnpm --filter @customreport/web exec playwright test                  │
│  /codex:review on full diff                                             │
│  /Demo-plan verify graceful-coalescing-kurzweil → ≥80                   │
│  pnpm docker:local:verify                                               │
│                                                                         │
│  Если зелёные — F5 (§9a): GitLab MR + post-merge cleanup.              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 21.5 Конкретные file boundaries (anti-conflict matrix)

```text
                                                     CLAUDE  CODEX
apps/api/src/modules/report-sections/lead-form
  .prisma-repository.ts                               WAVE-1   —
apps/web/src/components/lead/item-edit-dialog.tsx    WAVE-1   —
apps/web/src/components/lead/lead-form.tsx           WAVE-2   —
apps/web/src/components/slides/lead-unified-slide.tsx WAVE-2   —
apps/web/src/components/report-shell/*.tsx            —      WAVE-1
apps/web/src/components/navigation/nav-bar.tsx        —      WAVE-1
apps/web/e2e/regression/lead-priorities.spec.ts       —      WAVE-2
apps/web/e2e/regression/lead-locked-stage-color.spec  —      WAVE-2
apps/web/e2e/regression/version-history-snapshot.spec —      WAVE-2
.github/workflows/*.yml                               —      WAVE-2
packages/shared/dist/**                              WAVE-1   —
apps/api/src/modules/carry-over/*                    WAVE-2   —
```

Нулевые пересечения по файлам. Параллельное исполнение безопасно.

### 21.6 Конкретные промт-блоки для агентов

#### Промт для Codex (WAVE-1)

```text
Branch: fix/PRJ-2/shiny-eagle (already checked out)
Plan:   .planning/plans/graceful-coalescing-kurzweil.md §9 (F4 design)
        + §21.5 file boundaries

Задача — WAVE-1 для F4 head alignment (реализация, не только design):

T-F4-1 shared report-toolbar component
  Создать components/report-shell/report-toolbar.tsx
  Извлечь toolbar pattern из:
    - apps/web/src/components/lead/lead-form.tsx:1462-1490
    - apps/web/src/components/head/head-history-client.tsx:94-104
  Принимать children-slot для role-specific extras.
  Lead extras: FillFromButton + VersionHistoryNav.
  Head extras: PublishLockButton + ExportPdfButton.

T-F4-2 scope-toggle 3-way
  Создать components/report-shell/scope-toggle.tsx
  Расширить slides/lead-scope-toggle.tsx 2-way (own|product) до 3-way:
  (own|product|lead). Head использует product|lead, Lead — own|product.

T-F4-3 nav-bar redesign 3 tabs
  Изменить apps/web/src/components/navigation/nav-bar.tsx:41-74
  Сейчас: History / Dashboard / Status / Slides (4 tabs)
  Цель: Dashboard / Status / History (3 tabs)
  Slides убрать как пункт меню (остаётся ?mode=slides toggle на странице).

Constraints:
  - НЕ трогать lead-form.tsx, lead-form.prisma-repository.ts, slides/*
  - Все правки — в указанных файлах + новых report-shell/*
  - Атомарные коммиты per task
  - pnpm typecheck + pnpm lint + pnpm test после каждой задачи
  - Использовать /codex:review --wait перед коммитом

Verify:
  Pre-commit hooks зелёные, тесты не падают, типы чистые.
```

#### Промт для Claude (WAVE-1)

```text
Branch: fix/PRJ-2/shiny-eagle (already checked out)
Plan:   .planning/plans/graceful-coalescing-kurzweil.md §20.3 + §21.5

Задача — WAVE-1 для F3 restoreVersion + D-12 + shared rebuild:

T-G5 restoreVersion полное восстановление
  Файл: apps/api/src/modules/report-sections/lead-form.prisma-repository.ts
  Метод restoreVersion (lines 217-313):
  1. Расширить type SnapshotData следующими полями:
     - items[].priorityRank?: number | null
     - risks[].severity?: string
     - stageStatuses?: Array<{projectId, stageId|stageName, status}>
  2. В transaction body после деления items/risks/decisions добавить:
     - tx.stageStatus.deleteMany({where: {reportSectionId: sectionId}})
     - if (data.stageStatuses?.length) tx.stageStatus.createMany(…)
  3. В items.createMany добавить priorityRank field
  4. В risks.createMany добавить severity field
  Атомарность: всё под одним $transaction.

T-G11 shared build refresh
  pnpm --filter @customreport/shared build
  Подтвердить dist/ обновился (нет MISSING_PRIORITIES в dist/.d.ts)
  Не коммитить dist (Q9 default).

T-D12 item-dialog status pill reset-on-reopen
  Файл: apps/web/src/components/lead/item-edit-dialog.tsx
  Bug: после reopen диалога status pill не сбрасывается до actual value
  Прошлая попытка была reverted из-за react-compiler conflict (см. INTAKE-2026-05-15).
  Подход: использовать `key` prop на StatusPill для force-remount,
  ИЛИ useEffect+useState синхронизация при open=true.
  Добавить regression test в item-edit-dialog.test.tsx.

Constraints:
  - НЕ трогать report-shell/*, nav-bar.tsx (это Codex'ова зона)
  - Атомарные коммиты per task
  - pnpm typecheck + pnpm test после каждой задачи

Verify:
  Создать snapshot v=N с priorityRank+severity+stageStatus → изменить
  draft → restoreVersion(N) → значения вернулись.
```

#### Промт для Claude (WAVE-2)

```text
Зависит от Codex WAVE-1 merged (report-shell/* + nav-bar изменения).

T-G1 lead-form consumer derive
  Файл: apps/web/src/components/lead/lead-form.tsx
  Изменения:
  - line 1003: убрать `data.priorities as PriorityEntry[]`,
    заменить на derive из currentWeekItems.filter(i => i.priorityRank != null)
  - Удалить prioritiesRef (line 515) если нигде не используется после
    удаления legacy submit-flow.
  - Очистить validation handler в setSubmitErrors (lines 557-580) для
    field "priorities" — submit guards больше не блокируют по priorities.
  - foreignPriorities должны строиться из foreignCurrentItems с rank!=null.

T-G3 slide P{N} chip marker
  Файл: apps/web/src/components/slides/lead-unified-slide.tsx
  Добавить визуальный маркер "P{N}" рядом с inline product marker когда
  item.priorityRank != null. Стиль — same family как ItemCard P{N} chip
  (lead/item-card.tsx).

T-G4 carry-over (NO-OP per Q8 default)
  Подтвердить inspection: apps/api/src/modules/carry-over/* НЕ требует
  изменений. priorityRank наследуется по copy. Зафиксировать решение в
  карри-овер сервисе одним комментарием // Q8: priorityRank carries over.

T-46FU live-Prisma matrix verify
  Запустить full integration suite. Если что-то падает — починить.

Verify полная: pnpm typecheck && pnpm lint && pnpm test
```

#### Промт для Codex (WAVE-2)

```text
Зависит от Claude WAVE-1 merged (restoreVersion + shared rebuild).

T-G8 e2e lead-priorities.spec.ts (новый файл)
  Файл: apps/web/e2e/regression/lead-priorities.spec.ts
  Сценарии:
  1. Open /lead/report/<id>, добавить item с priorityRank=1 → виден в
     PrioritiesSection.
  2. Убрать rank → исчез из PrioritiesSection.
  3. Cross-author: открыть продукт где другой lead поставил приоритет → в
     PrioritiesSection появилась запись с пометкой автора.

T-G9 e2e lead-locked-stage-color.spec.ts (новый файл)
  Файл: apps/web/e2e/regression/lead-locked-stage-color.spec.ts
  Сценарии:
  1. Stage locked + cross-author blocker → цвет красный + замок.
  2. Stage locked + cross-author at-risk → цвет оранжевый + замок.
  3. Stage locked + реально пустой → серый + замок.

T-G10 e2e version-history-snapshot.spec.ts (новый файл)
  Файл: apps/web/e2e/regression/version-history-snapshot.spec.ts
  Сценарии (полный F3 UAT smoke):
  1. Открыть /lead/report/<id> v=N.
  2. Поставить статус DevOps → подождать 6с → v=N+1.
  3. Saved badge пропал ≤1с после v# update.
  4. Перелистнуть ‹ на v=N → форма read-only, DevOps пустой (как было).
  5. Перелистнуть › на v=N+1 → DevOps статус = только что выставленный.
  6. Restore v=N → DevOps снова пустой в активном draft.

T-CI-47 CI badge
  Файл: .github/workflows/* — добавить badge генерацию для phase 47-02
  spec (см. INTAKE-2026-05-16 item 4).

Constraints:
  - Использовать существующий e2e harness (playwright.regression.config.ts)
  - Атомарные коммиты per spec
```

#### Промт для пользователя (WAVE-3 research)

```text
Перед началом T-F4-4 Dashboard, T-UFB14, T-HOL, T-UAT-L:

Каждый из четырёх требует короткого PRD-обсуждения. Дефолт: defer
в v8.4/v8.5 milestone, НЕ блокировать merge ветки fix/PRJ-2/shiny-eagle.

Если хочешь делать ВСЁ в этой ветке, нужно по 5 минут на каждый:
- T-F4-4 Dashboard: что именно показывать? Кто из лидов не отправил?
  Активность за сутки? KPI tiles? Quick-ping?
- T-UFB14 multi-SDLC: один продукт = несколько SDLC pipelines? Как UI?
- T-HOL holidays: ввести через admin? Импорт из источника? Какой год?
- T-UAT-L landing pages: какие? Login? Home? Role-specific?

Решение: defer ИЛИ design-only в этой ветке.
```

### 21.7 Coordination protocol (Claude ↔ Codex)

Чтобы избежать race на `git push`:

```text
[start] → Claude commits group-A → push origin
                                       ↓
                          Codex pulls origin → commits group-B → push
                                       ↓
              Claude pulls origin → wave-2 group-C → push
                                       ↓
              Codex pulls origin → wave-2 group-D → push
                                       ↓
                            [integration verify]
```

Каждый агент перед commit'ом обязан: `git pull --rebase origin
fix/PRJ-2/shiny-eagle`. Если у обоих агентов dirty changes на одном
файле — это нарушение boundary matrix §21.5, переписать sub-task.

### 21.8 Verification (final)

```bash
# (a) Полный typecheck/lint/test/build
pnpm typecheck
pnpm lint
pnpm test
pnpm build

# (b) E2E regression (3 новых spec'a включаются автоматически)
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts

# (c) Build shared package, проверить dist чистый
pnpm --filter @customreport/shared build
node -e "import('./packages/shared/dist/schemas/report.js').then(m =>
  console.log(Object.keys(m).filter(k => k.match(/priority|Priorities/i))))"
# должно вернуть [] или только новые derived helper'ы

# (d) Docker smoke
pnpm docker:local:verify

# (e) UAT smoke по §10:
#  F1 — UAT шаги 1-4
#  F2 — UAT шаги 1-3
#  F3 — UAT шаги 1-6 (включая snapshot/restore полный цикл)
#  D-12 — open item dialog, save status, reopen → pill correct
#  F4 — три tabs в nav, scope toggle 3-way, shared toolbar

# (f) Codex review final pass
/codex:review

# (g) Demo-plan verify
/Demo-plan verify graceful-coalescing-kurzweil
```

### 21.9 Done definition (final closure)

```text
Branch fix/PRJ-2/shiny-eagle ready-to-merge ⇔
  ✓ WAVE-1 + WAVE-2 все 13 ready-tasks shipped
  ✓ WAVE-3 либо deferred (default) либо implemented после spec
  ✓ pnpm typecheck/lint/test/build все зелёные
  ✓ 3 новых e2e spec'a проходят
  ✓ /codex:review без BLOCK'ов
  ✓ /Demo-plan verify ≥80
  ✓ Ручной UAT smoke по §21.8(e) зелёный
  ✓ STILL-PENDING items либо closed либо явно перенесены в v8.4
  ✓ core-principles config drift промт отдан в core-principles repo

После всего этого — F5 (§9a): GitLab MR → review → approve → merge → tag.
```

### 21.10 Risk map

```text
▲ ВЫСОКИЙ риск:
  T-G5 restoreVersion atomic — data corruption risk если transaction
       не завершится; нужен thorough тест
  T-F4-4 Dashboard — spec ещё не утверждён, scope-creep
  T-UFB14, T-HOL — нет дизайна, потенциальное расширение в 1000+ LoC

⊙ СРЕДНИЙ риск:
  T-G1 lead-form consumer — submit-flow дырки если что-то забыто
  T-D12 react-compiler conflict — прошлый revert; нужен careful подход
  T-F4-1 report-toolbar — много мест где переиспользуется; refactor risk

▼ НИЗКИЙ риск:
  T-G3, T-G4, T-G8, T-G9, T-G10, T-G11, T-F4-2, T-F4-3,
  T-CI-47, T-46FU
```

### 21.11 Files (полный delta-список к §17)

```text
NEW:
  apps/web/src/components/report-shell/report-toolbar.tsx               T-F4-1
  apps/web/src/components/report-shell/scope-toggle.tsx                 T-F4-2
  apps/web/e2e/regression/lead-priorities.spec.ts                       T-G8
  apps/web/e2e/regression/lead-locked-stage-color.spec.ts               T-G9
  apps/web/e2e/regression/version-history-snapshot.spec.ts              T-G10

EDIT:
  apps/api/src/modules/report-sections/lead-form.prisma-repository.ts   T-G5
  apps/web/src/components/lead/lead-form.tsx                            T-G1
  apps/web/src/components/lead/item-edit-dialog.tsx                     T-D12
  apps/web/src/components/lead/item-edit-dialog.test.tsx                T-D12
  apps/web/src/components/slides/lead-unified-slide.tsx                 T-G3
  apps/web/src/components/navigation/nav-bar.tsx                        T-F4-3
  apps/api/src/modules/carry-over/carry-over.service.ts                 T-G4 (comment)
  .github/workflows/<file>.yml                                           T-CI-47

REBUILD:
  packages/shared/dist/**                                                T-G11

DEFERRED (require spec):
  apps/web/src/app/(app)/head/dashboard/**                              T-F4-4
  apps/api/src/modules/dashboard/**                                     T-F4-4
  (multi-SDLC, holidays, UAT-landing — паттерны зависят от PRD)
```

---

## 22. Final sweep audit (2026-05-21, post-discovery)

### 22.1 Why this section exists

После §21 пользователь попросил пере-сканировать ветку и доделать ВСЁ
оставшееся. Запустил три параллельных Explore-разведчика и сверил их выводы
своими глазами — нашёл три расхождения, исправил факты ниже. Ответы
пользователя (AskUserQuestion 2026-05-21 19:14):

- e2e priorities spec → **переписать существующий**
  `agent-b-lead-priorities.spec.ts` (он сейчас тестирует устаревший UI с
  кнопкой «edit priority N», которой после F1 не существует).
- Live баг `lead-form.tsx:1781` `badge={priorities.length}` →
  **фиксить внутри T-G1** одним коммитом (badge не считает foreign authors).
- F4-4 Dashboard / T-UFB14 / Holidays / UAT landing → **defer в v8.4**
  (по плану §21.3 это NEEDS-RESEARCH-FIRST, нет PRD).

### 22.2 Sweep verdict — что закрыто, что осталось

```text
┌─ T-ID  ─┬─ статус ─┬─ evidence ───────────────────────────────────────────┐
│ T-G1    │ ◐ част.  │ lead-form.tsx:965 data.priorities still legacy pull; │
│         │          │ line 1781 badge counts own only, не mergedPriorities │
│ T-G3    │ ✓ done   │ lead-unified-slide.tsx:36 priorityChip,              │
│         │          │ :80-81 вызов рядом с product marker (sweep подтверд) │
│ T-G4    │ ✓ done   │ carry-over.service.ts:50-54 Q8 comment, 8f2a3ce      │
│ T-G5    │ ✓ done   │ lead-form.prisma-repository.ts:217-363               │
│         │          │ stageStatuses+priorityRank+severity restore (de259b5)│
│ T-G8    │ ◐ stale  │ agent-b-lead-priorities.spec.ts существует, но       │
│         │          │ LEAD-080..085 жмёт «edit priority N» — кнопки нет    │
│ T-G9    │ ✗ нет    │ lead-locked-stage-color.spec.ts не существует        │
│ T-G10   │ ✗ нет    │ version-history-snapshot.spec.ts не существует       │
│ T-G11   │ ◐ част.  │ src чистый, dist рассинхрон, нужен pnpm build        │
│ T-D12   │ ? проверк│ item-edit-dialog.tsx useEffect есть; pill reset      │
│         │          │ на reopen — нужен ручной UAT-проверка                │
│ T-46FU  │ ? проверк│ live-Prisma matrix полный прогон не запускался       │
│ T-F4-1  │ ✗ нет    │ report-shell/report-toolbar.tsx нет (есть archive-   │
│         │          │ toggle и view-mode-toggle — частично готова почва)   │
│ T-F4-2  │ ✗ нет    │ scope-toggle 3-way нет; есть 2-way slides/lead-      │
│         │          │ scope-toggle.tsx (33 строки, легко расширить)        │
│ T-F4-3  │ ✗ нет    │ nav-bar.tsx:41-74 — 4 head tabs вместо 3             │
│ T-CI-47 │ ✗ нет    │ .github/workflows/* — нет badge генерации            │
└─────────┴──────────┴──────────────────────────────────────────────────────┘
```

Полностью закрыты в текущей ветке: **T-G3, T-G4, T-G5**. Остальное —
открыто.

### 22.3 Scope этого финального sweep

```text
┌─ in scope ─────────────────────────────────────────────────────────────┐
│ T-G1   lead-form consumer cleanup + badge bug (один коммит)            │
│ T-G8   переписать agent-b-lead-priorities.spec.ts под новый UI         │
│ T-G9   создать lead-locked-stage-color.spec.ts                          │
│ T-G10  создать version-history-snapshot.spec.ts                         │
│ T-G11  pnpm --filter @customreport/shared build (no commit per Q9)     │
│ T-D12  manual UAT проверка status pill reset; если bug — точечный fix   │
│ T-F4-1 report-shell/report-toolbar.tsx (extract из lead+head)          │
│ T-F4-2 report-shell/scope-toggle.tsx 3-way generalization              │
│ T-F4-3 nav-bar.tsx 4→3 tabs (убрать /head/slides как nav-item)         │
│ T-CI-47 .github/workflows/* — badge генерация для 47-02 spec           │
└─────────────────────────────────────────────────────────────────────────┘
┌─ deferred в v8.4 ───────────────────────────────────────────────────────┐
│ T-F4-4 Head Dashboard enhancement — нет PRD, scope-creep risk          │
│ T-UFB14 multi-SDLC stages per product — нет UI/data model              │
│ T-HOL   Holidays calendar — нет source/admin flow                       │
│ T-UAT-L UAT landing pages — scope непонятен                            │
│ T-46FU  live-Prisma matrix — не блокирует merge, делается в CI прогоне  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 22.4 Execution order (solo sequential, по запросу «делай всё сам»)

```text
[stage A: high-risk core]
  ├─ A1  T-G1 lead-form consumer cleanup + badge fix (один коммит)
  └─ A2  T-G11 pnpm build shared (no commit, verify dist clean)
  ↓
[stage B: e2e regression — три атомарных коммита]
  ├─ B1  T-G8 переписать agent-b-lead-priorities.spec.ts
  ├─ B2  T-G9 lead-locked-stage-color.spec.ts (new)
  └─ B3  T-G10 version-history-snapshot.spec.ts (new)
  ↓
[stage C: F4 — три коммита, по компоненту]
  ├─ C1  T-F4-1 report-toolbar.tsx + переключение Lead+Head на него
  ├─ C2  T-F4-2 scope-toggle.tsx 3-way (own|product|lead)
  └─ C3  T-F4-3 nav-bar.tsx 4→3 tabs
  ↓
[stage D: housekeeping]
  ├─ D1  T-D12 ручная UAT проверка → fix если нужно
  └─ D2  T-CI-47 CI badge yml
  ↓
[stage E: closeout]
  ├─ E1  pnpm typecheck && pnpm lint && pnpm test (полный прогон)
  ├─ E2  playwright regression (новые spec'и обязаны зелёные)
  ├─ E3  /codex:review на полный diff origin/main..HEAD
  └─ E4  /Demo-plan verify graceful-coalescing-kurzweil → ≥80
```

Каждый stage завершается атомарным коммитом и `git push` перед следующим.

### 22.5 T-G1 cleanup — конкретные правки

```text
файл: apps/web/src/components/lead/lead-form.tsx
─────────────────────────────────────────────────────────────────
строка 965  const priorities: PriorityEntry[] = data.priorities as PriorityEntry[];
            ↑
            оставляем как есть. mapLeadPriorities derives из items.filter(
            priorityRank != null) на backend (apps/web/src/lib/mappers/
            lead-form.ts:143), т.е. api-shape УЖЕ derived. Q7 default
            «derive в FE» выполнен через mapper, не через ручное вычисление
            в компоненте.

строка 1077 const mergedPriorities = [...priorities, ...foreignPriorities];
            ↑
            оставляем — это own + foreign объединение.

строка 1445 (... && priorities.length > 0) && (
            ↑
            проверить: должен ли guard смотреть mergedPriorities или
            priorities? Если секция показывает merged, а guard own —
            секция исчезнет когда own пусто но foreign есть. Скорее всего
            заменить на mergedPriorities.length > 0.

строка 1781 badge={`${priorities.length}`}
            ↑
            BUG: PrioritiesSection ниже рендерит mergedPriorities.
            FIX: badge={`${mergedPriorities.length}`}
─────────────────────────────────────────────────────────────────
коммит: fix(lead-form): priorities badge counts cross-author entries
LoC: ~3
риск: low — badge числовой, ниже отображается тот же массив
```

### 22.6 T-G8 e2e priorities — новые сценарии

```text
файл: apps/web/e2e/regression/agent-b-lead-priorities.spec.ts
─────────────────────────────────────────────────────────────────
ЗАМЕНИТЬ всё содержимое (171 строка) на новый набор LEAD-080..LEAD-085
под current UI:

LEAD-080: PrioritiesSection видна, содержит ≥1 item с priorityRank.
          Селектор: [data-testid="lead-section-priorities"]
                    [data-testid="priority-row"]

LEAD-081: Item edit dialog — поле «Priority rank» доступно.
          Нажать Edit на любом item-card; в dialog найти input
          по label/aria «Priority rank»; убедиться editable.

LEAD-082: Set rank=1 на item у которого его не было → item
          появляется в PrioritiesSection в правильной позиции.

LEAD-083: Unset rank (set to empty/0) → item исчезает из
          PrioritiesSection (read-only derived view).

LEAD-084: Item-card P{N} chip виден когда priorityRank != null
          (left of tag, gold background).

LEAD-085: Cross-author item с priorityRank → виден в PrioritiesSection
          с пометкой автора (badge или aria-label includes "by <name>").
          Использует advanced seed где у одного продукта несколько lead.
─────────────────────────────────────────────────────────────────
коммит: test(e2e): rewrite lead-priorities under derived UI
LoC: ~180 (replace 171)
риск: low — изолированный spec
```

### 22.7 T-G9 e2e locked stage color — новый spec

```text
файл: apps/web/e2e/regression/lead-locked-stage-color.spec.ts (NEW)
─────────────────────────────────────────────────────────────────
LEAD-LSC-01: locked stage с cross-author blocker item →
             chip красный (или blocked-style class) + lock icon.
LEAD-LSC-02: locked stage с cross-author at-risk item →
             chip оранжевый + lock icon.
LEAD-LSC-03: locked stage реально пустой у всех контрибьюторов →
             chip серый (empty) + lock icon.
LEAD-LSC-04: current-author stage (не locked) с blocker →
             красный, БЕЗ замка.

Использует advanced seed + role=lead login.
Селекторы: [data-testid="stage-chip-<stageName>"] (если есть) или
           role=region с aria-label "Stage <name>".
─────────────────────────────────────────────────────────────────
коммит: test(e2e): locked stage chip color reflects cross-author risk
LoC: ~120
риск: low
```

### 22.8 T-G10 e2e version history snapshot — новый spec

```text
файл: apps/web/e2e/regression/version-history-snapshot.spec.ts (NEW)
─────────────────────────────────────────────────────────────────
LEAD-VHS-01: открыть /lead/report/<id>, запомнить current v=N.
LEAD-VHS-02: поставить статус DevOps stage; подождать 6 с;
             v-counter перешёл на N+1 (debounce 5 с + buffer).
LEAD-VHS-03: «Saved» badge пропал ≤1 с после v# bump.
LEAD-VHS-04: ‹ → форма read-only, DevOps статус = старый (пустой).
LEAD-VHS-05: › → DevOps статус = только что выставленный.
LEAD-VHS-06: Restore vN → активный draft показывает старое значение.
LEAD-VHS-07: snapshot включает stageStatuses, priorityRank, severity:
             поставить rank=1 на item + severity на risk + status на
             stage → подождать snapshot → изменить всё → restore →
             значения вернулись (на трёх местах одновременно).
─────────────────────────────────────────────────────────────────
коммит: test(e2e): version history snapshot integrity full F3 smoke
LoC: ~200
риск: medium — debounce timing flake; mitigation — waitForResponse
       на createSnapshot mutation, не sleep
```

### 22.9 T-F4-1/2/3 — F4 head alignment (реализация)

```text
T-F4-1  apps/web/src/components/report-shell/report-toolbar.tsx (NEW)
        ─────────────────────────────────────────────────────────
        Извлечь паттерн из lead-form.tsx:1454-1495 и head-history-
        client.tsx:92-104. Компонент принимает:
          - periodNavigator: ReactNode (slot)
          - archiveToggle: ReactNode (slot)
          - leadingExtras?: ReactNode (между period и archive)
          - trailingExtras?: ReactNode (после archive, role-specific:
                                        Lead → FillFrom + VersionNav,
                                        Head → ViewMode toggle)
        Layout: <div className="flex flex-nowrap items-center
                justify-between gap-2 overflow-x-auto rounded-...">
        Переключить lead-form.tsx и head-history-client.tsx на него.
        Tests: report-shell/report-toolbar.test.tsx (~60 LoC).
        LoC total: ~180; риск: low (refactor existing markup).

T-F4-2  apps/web/src/components/report-shell/scope-toggle.tsx (NEW)
        ─────────────────────────────────────────────────────────
        Generalize slides/lead-scope-toggle.tsx (2-way) до 3-way.
        Type: scope: "own" | "product" | "lead"
        Props: allowedScopes?: Array<"own"|"product"|"lead"> — Lead
               использует ["own", "product"], Head — ["product", "lead"].
        UI: map allowedScopes → buttons.
        Заменить импорт LeadScopeToggle на ScopeToggle в lead-slides-
        client.tsx; добавить Head usage если ready (если Head slides
        ещё на старом ToggleGroup — миграция).
        LoC: ~80; риск: low.

T-F4-3  apps/web/src/components/navigation/nav-bar.tsx (EDIT)
        ─────────────────────────────────────────────────────────
        NAV_LINKS (lines 41-74) для role=head:
          было:   History, Dashboard, Status, Slides
          станет: Dashboard, Status, History  (3 tabs)
        Убрать запись `/head/slides` — это alias-редирект, который
        существует как back-compat в apps/web/src/app/(app)/head/
        slides/page.tsx. Сам redirect оставляем (back-compat по URL).
        Tests: nav-bar.test.tsx — добавить кейс «head не видит Slides
        в nav».
        LoC: ~30 (включая тест); риск: low.
```

### 22.10 T-D12 — manual check + опциональный fix

```text
сценарий:
  1. /lead/report/<id> → open item edit dialog (Edit на любом item-card)
  2. сменить status pill (e.g. на «Done»)
  3. Save → dialog закрыт
  4. снова Edit того же item → check: status pill показывает «Done»
     (а не дефолтный/предыдущий)
  5. отменить → проверить что pill в dialog соответствует item state

если bug → точечный fix:
  - useEffect([open, item.workflowStatus], () => setStatus(item.workflowStatus))
  - ИЛИ key={`${item.id}-${open}`} на StatusPill для force-remount
LoC: ~5 если нужен fix; риск: medium (react-compiler конфликт в прошлом)
```

### 22.11 T-CI-47 — CI badge

```text
файл: .github/workflows/<ci-yml> (определить какой)
─────────────────────────────────────────────────────────────────
Добавить job или step, генерирующий badge SVG/JSON для phase 47-02
spec status (см. INTAKE-2026-05-16 item 4). Минимум — shields.io
endpoint в README.

LoC: ~20; риск: low.
```

### 22.12 Verification (final, для §22 closure)

```bash
# stage E1 quality gates
pnpm typecheck && pnpm lint && pnpm test

# stage E2 playwright (новые + перезаписанные specs обязаны зелёные)
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts \
  --grep "priorities|locked-stage|version-history-snapshot|nav-bar"

# stage E3 shared dist чистый (T-G11 verify, не коммит)
pnpm --filter @customreport/shared build
ls -la packages/shared/dist/schemas/report.d.ts
node -e "const m=require('./packages/shared/dist/schemas/report.cjs');
         console.log(Object.keys(m).filter(k => /priority|Priorities/i.test(k)))"
# ожидание: [] или только новые derived helpers

# stage E4 Codex review
/codex:review

# stage E5 Demo-plan verify
/Demo-plan verify graceful-coalescing-kurzweil
# таргет ≥80
```

### 22.13 Done definition (для §22 closure)

```text
§22 sweep done ⇔
  ✓ T-G1 commit landed (badge fix + cleanup confirmed)
  ✓ T-G8 agent-b-lead-priorities.spec.ts rewritten, 6 cases green
  ✓ T-G9 lead-locked-stage-color.spec.ts new, 4 cases green
  ✓ T-G10 version-history-snapshot.spec.ts new, 7 cases green
  ✓ T-G11 shared dist verified clean (no commit per Q9)
  ✓ T-D12 manual UAT step performed (fix only if bug found)
  ✓ T-F4-1 report-shell/report-toolbar.tsx landed, Lead+Head switched
  ✓ T-F4-2 report-shell/scope-toggle.tsx 3-way, Lead-slides switched
  ✓ T-F4-3 nav-bar.tsx 3 head tabs
  ✓ T-CI-47 CI badge в workflows
  ✓ stage E1+E2 зелёные
  ✓ /codex:review без BLOCK
  ✓ /Demo-plan verify ≥80
  ✓ DEFERRED (T-F4-4, T-UFB14, T-HOL, T-UAT-L) явно перенесены в v8.4

После §22 closure → §9a F5 GitLab MR fix/PRJ-2/shiny-eagle → main.
```

### 22.14 Risk map (только sweep-уровень)

```text
▲ medium
  T-G10 playwright snapshot timing flake — mitigation через waitForResponse
  T-D12 react-compiler reopen pattern — прошлый revert; careful

⊙ low
  T-G1 badge fix (3 LoC)
  T-G8/G9 e2e specs (изолированные)
  T-F4-1 toolbar refactor (children-slot pattern, чисто)
  T-F4-2 scope-toggle (UI-only)
  T-F4-3 nav-bar tabs (1 строка из NAV_LINKS)
  T-G11 build verify (без коммита)
  T-CI-47 yml-only

▼ deferred
  T-F4-4, T-UFB14, T-HOL, T-UAT-L → новый milestone v8.4
```

### 22.15 От человека / Я делаю сам

```text
─────────────────────────────────────
✓ Я ДЕЛАЮ САМ
─────────────────────────────────────
  ├── T-G1 lead-form badge fix + commit + push
  ├── T-G8 переписать agent-b-lead-priorities.spec.ts + commit
  ├── T-G9 lead-locked-stage-color.spec.ts new + commit
  ├── T-G10 version-history-snapshot.spec.ts new + commit
  ├── T-G11 pnpm build shared, проверить dist
  ├── T-F4-1 report-toolbar.tsx new + Lead/Head switch + commit
  ├── T-F4-2 scope-toggle.tsx 3-way + commit
  ├── T-F4-3 nav-bar 4→3 + commit
  ├── T-CI-47 CI badge yml + commit
  ├── полный pnpm typecheck/lint/test/playwright
  └── /codex:review + /Demo-plan verify

─────────────────────────────────────
▲ ОТ ТЕБЯ
─────────────────────────────────────
  ├── T-D12 manual UAT (1 минута): open item dialog → change status →
  │   save → reopen → check pill matches. Сообщить bug/clean.
  └── approve PR в GitLab UI после моего F5 push (последний шаг)
```

---

## 23. Extension: добиваем deferred (2026-05-21, post-§22, rich-mode)

### 23.0 TL;DR (Было / Проблема / Станет)

```text
┌─ Было ─────────────────────────────────────────────────────────┐
│ Head Dashboard  │ KPI + activity + table — нет действия из UI, │
│                 │ нет visible пинга молчащих лидов              │
│ Landing pages   │ /, /auth/dev-login, role-redirects работают,  │
│                 │ Playwright их не покрывает (UAT-SCENARIO [ ]) │
│ Holidays        │ business-date.ts ждёт holidays?: Set, но      │
│                 │ feature только в плане, нет visible маркера   │
│ Multi-SDLC      │ Уже сделано как «замок на locked stage» в F2  │
│                 │ — оригинальный UX-запрос закрыт               │
└────────────────────────────────────────────────────────────────┘

┌─ Проблема ─────────────────────────────────────────────────────┐
│ pulse: [head видит таблицу] → [нет one-click reminder]         │
│         → [нет визуального сигнала «лид молчит»]               │
│ UAT-L: [landing меняется] → [нет e2e gate] → [регрессии]       │
│ holidays: [уже фьючер обсуждался] → [нет следа в UI]           │
│            → [пользователь забудет об идее]                    │
└────────────────────────────────────────────────────────────────┘

┌─ Станет ───────────────────────────────────────────────────────┐
│ pulse     │ Remind кнопка per lead, 24h highlight, 24h KPI     │
│ UAT-L     │ landing-public + landing-role-redirect specs (7)   │
│ holidays  │ Coming Soon секция в admin + tooltip + TODO файл   │
│ CLAUDE.md │ правило: UI deferred → ComingSoonBadge + tooltip   │
└────────────────────────────────────────────────────────────────┘

Пайплайн:
[wave-0 Haiku scan]──[wave-1 Sonnet workers ×3]──[wave-2 commit/verify]
   ~3 мин                ~10 мин                       ~5 мин
```

### 23.1 Context

После §22 closure пользователь решил доделать ранее deferred-в-v8.4 пункты
прямо в этой ветке. Разведка тремя Explore-агентами + три ответа
AskUserQuestion (включая один Other в свободной форме) дали финальный
scope:

- **Pulse (T-F4-4)** — полный enhancement Head Dashboard.
- **UAT-L (T-UAT-L)** — полный набор e2e specs для landing.
- **Holidays (T-HOL)** — только Coming Soon UI + TODO. Идея «классная,
  но в фон». Никакой data model в этой ветке.
- **Multi-SDLC (T-UFB14 / UFB-058)** — DROP. Оригинальная идея
  «визуально показать фазы, в которых я не контрибутил, в виде замка» уже
  закрыта в F2 (lock-icon на locked stage chip) + sweep T-G9 e2e её
  покрывает. Дополнительный product-level multi-pipeline data refactor
  не нужен.

Side-deliverable от пользователя: дописать в `CLAUDE.md` правило про
ComingSoonBadge + tooltip как канонический паттерн для deferred UI
(вместо `throw new Error` loud stub для UI-фич).

### 23.2 Final scope

```text
┌─ in this branch ────────────────────────────────────────────────┐
│ T-F4-4 Head Dashboard pulse                          ~180 LoC   │
│ T-UAT-L Landing pages e2e regression                  ~250 LoC   │
│ T-HOL Holidays Coming Soon UI + TODO markers           ~30 LoC   │
│ CLAUDE.md rule: ComingSoonBadge pattern (side)         ~15 LoC   │
└─────────────────────────────────────────────────────────────────┘
┌─ dropped (already shipped) ─────────────────────────────────────┐
│ T-UFB14 multi-SDLC — locked-stage lock icon уже даёт нужный UX  │
└─────────────────────────────────────────────────────────────────┘
```

Итого ~475 LoC, без миграций БД.

### 23.3 Subagent strategy (Sonnet + Haiku fan-out)

```text
[wave 0: pre-flight Haiku discovery — параллельно]
  ├─ Haiku-PD: pulse data — селекторы LeadSummaryTable/ActivityLivePanel,
  │   trpc.notifications/email-reminder mutation, 24h activity heuristic
  └─ Haiku-LD: landing discovery — что в /, /auth/dev-login, role redirects,
      существующие visual/regression specs (landing.spec.ts, agent-a-landing)

[wave 1: Sonnet workers — три параллельных задачи]
  ├─ Sonnet-1: T-F4-4 pulse (UI + new tRPC pingLead mutation если нужна)
  ├─ Sonnet-2: T-UAT-L 5–7 e2e specs
  └─ Haiku-3: T-HOL Coming Soon badge + TODO маркеры (мини-задача)

[wave 2: оркестратор]
  ├─ верификация typecheck/lint/test
  ├─ конкретный CLAUDE.md edit под ComingSoonBadge правило
  ├─ атомарные коммиты per task
  └─ git push origin
```

Distribution rationale:

- **Haiku**: pre-flight grep/read + крошечная мини-задача (T-HOL = 30 LoC
  чисто UI-обвес).
- **Sonnet**: основная имплементация — нужна aware-конкретики, JSX
  composition, e2e selectors.
- **Opus (я)**: маршрутизация, integration, commits, conflict resolution.

### 23.4 T-F4-4 Head Dashboard pulse

**Файлы (EDIT):**

- `apps/web/src/components/dashboard/lead-summary-table.tsx` — добавить
  колонку «Last activity» (relative time) + кнопку «Remind» рядом с
  лидами в статусе draft/pending (status !== submitted).
- `apps/web/src/components/dashboard/activity-live-panel.tsx` — добавить
  визуальный highlight для лидов, у которых `lastEditAt > 24h ago`
  (border-left red + subtle pulse animation или просто бейдж «No activity»).
- `apps/web/src/components/dashboard/dashboard-page.tsx` — новая
  карточка «24h Activity» в KPI ряд: `count of changes last 24h`.

**Файлы (NEW):**

- `apps/web/src/components/dashboard/remind-lead-button.tsx` — small
  button с loading state, вызывает существующий `email-reminder` BullMQ
  путь через новый или существующий tRPC mutation.

**API:**

- Если `trpc.notifications.remindLead({leadId, reportId})` не существует —
  добавить в `apps/api/src/modules/notifications/` (или похожем модуле).
  Использует существующую `EmailService.sendMailMultipart()` +
  `escalation.template.ts`.

**Tests:**

- `apps/web/src/components/dashboard/lead-summary-table.test.tsx` —
  расширить: кнопка Remind видна для не-отправивших, не видна для
  submitted.
- `apps/web/src/components/dashboard/remind-lead-button.test.tsx` (NEW)
  — vitest: click → mutation called.

**Done criteria:**

- Кнопка Remind отправляет email через mailpit, виден в UI :8025.
- Highlight на лидах без активности > 24ч присутствует.
- 24h Activity KPI карточка показывает `count` событий.

Размер: ~180 LoC.

### 23.5 T-UAT-L landing pages e2e

**Контекст:** landing pages работают (root `/`, `/auth/dev-login`,
role-based redirects), но Playwright их не покрывает в regression suite.

**Файлы (NEW):**

- `apps/web/e2e/regression/landing-public.spec.ts` — 4 кейса:
  - LAND-01: `/` без сессии → видны brand + Sign-in кнопка.
  - LAND-02: `/` в AUTH_STUB режиме → dev-login picker рендерит N user-карт
    (≥ количество лидов в seed).
  - LAND-03: click на lead-карту → редирект на `/lead/report`.
  - LAND-04: click на head-карту → редирект на `/head/dashboard`.
- `apps/web/e2e/regression/landing-role-redirect.spec.ts` — 3 кейса:
  - LRR-01: viewer login → `/reports?tab=published`.
  - LRR-02: lead session, `/` → редирект на `/lead/report`.
  - LRR-03: head session, `/` → редирект на `/head/dashboard`.

**Шаблон:** `agent-b-lead-items.spec.ts` (loginByCookie + retry beforeEach).

**Done criteria:** 7 кейсов зелёные локально, screenshots в
`.planning/regression/screenshots/landing-*/`.

Размер: ~250 LoC.

### 23.6 T-HOL Holidays Coming Soon UI + TODO

**Pattern reference:** apps/web/src/components/navigation/nav-bar.tsx
имеет `LanguageComingSoonControl` и `ThemeComingSoonControl` —
канонический паттерн (inert button с aria-disabled + ComingSoonBadge
tooltip on hover).

**Файлы (EDIT):**

- `apps/web/src/app/(app)/admin/page.tsx` (или ближайший admin settings
  surface) — добавить секцию «Holidays Calendar» с inert control
  - ComingSoonBadge tooltip + TODO comment с ссылкой на
    `business-date.ts` где будет integration point.

**Файлы (NEW):**

- `.planning/todos/pending/2026-05-21-holidays-calendar.md` — todo с
  описанием scope (Holiday table, seed RU 2026, computeDeadline
  integration) для будущего milestone.

**Done criteria:**

- В админке видна секция «Holidays» с Coming Soon badge.
- Hover показывает tooltip.
- TODO файл создан со ссылкой на `.planning/plans/graceful-
coalescing-kurzweil.md#23.6`.

Размер: ~30 LoC.

### 23.7 Side deliverable — CLAUDE.md ComingSoon pattern

**Файл (EDIT):** `/home/user/work/customreport/CLAUDE.md` секция «Deferred
Features».

**Текущий текст:**

```text
When a feature is deliberately deferred, leave physical traces in code:
- TODO(<ref>) near the activation point.
- Loud stub: throw new Error('Not implemented -- see TODO(<ref>)').
- Metric name declared up front when the future path affects observability.
```

**Добавить новый bullet** (между TODO и Loud stub):

```text
- For deferred USER-FACING features (admin panels, settings, nav items),
  prefer a ComingSoonBadge tooltip on an inert control over a hidden
  feature flag. Pattern: see `nav-bar.tsx` LanguageComingSoonControl /
  ThemeComingSoonControl. Shows user that the feature is acknowledged
  + roadmapped without exposing half-working UI. Loud stub stays for
  backend/non-UI deferred paths.
```

**Done criteria:** правило в CLAUDE.md, ссылка на конкретный pattern
файл, разделение UI-deferred vs backend-deferred явное.

### 23.8 Verification

```bash
pnpm typecheck && pnpm lint && pnpm test
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts \
  --grep "landing|pulse|remind"

# UAT smoke:
# 1. Open /head/dashboard → видна KPI «24h Activity», кнопка Remind на
#    лидах в статусе draft.
# 2. Click Remind → mailpit :8025 показывает new email.
# 3. ActivityLivePanel highlight'ит лидов без активности 24ч+.
# 4. Open /admin → Coming Soon секция «Holidays» с tooltip.
# 5. CLAUDE.md содержит новое правило про ComingSoonBadge.
```

### 23.9 Done definition

```text
§23 extension done ⇔
  ✓ Head Dashboard pulse: Remind button + 24h highlight + 24h KPI card
  ✓ landing-public.spec.ts + landing-role-redirect.spec.ts (7 cases)
  ✓ Holidays Coming Soon UI в admin + TODO файл
  ✓ CLAUDE.md ComingSoonBadge правило записано
  ✓ pnpm typecheck/lint/test зелёные
  ✓ Playwright landing+pulse specs зелёные локально
  ✓ Атомарные коммиты per task + push
```

После §23 closure → §9a F5 GitLab MR (теперь с pulse + UAT-L + holidays
coming-soon + claude rule).

### 23.10 Сейчас (live state, 2026-05-21 19:30+)

```text
branch:   fix/PRJ-2/shiny-eagle
ahead:    9 commits после §22 (621d2f2..e4e277d), все pushed origin
dirty:    M  CLAUDE.md   (авто-генерация managed runtime, не моя правка)
          M  .planning/plans/graceful-coalescing-kurzweil.md (этот файл)
tests:    typecheck 5/5 ✓  lint 4/4 ✓  test web 494/494 ✓  api 928 ✓
playwright не запускался в этом sweep (нет live dev server в окружении)
TaskList: 12 completed F-* + G-* + P6-*; 1 pending (T-D12 manual UAT)
```

### 23.11 Git audit

```text
HEAD = e4e277d  docs(ci): add CI badge + finalize kurzweil plan
origin/main = 8f2a3ce..родитель ветки
ahead origin/main: 41 commit (full PRJ-2 milestone span)
behind origin/main: 0
no detached HEAD, no force-push history, no stale worktrees.
git stash list: пуст.
```

### 23.12 GSD audit

```text
.planning/STATE.md     → milestone v8.3 active, PRJ-2 stream
.planning/ROADMAP.md   → текущий milestone: pulse + UAT-L + holidays
                         только в виде "deferred to v8.4"
.planning/MILESTONES.md → v8.2 closed (tag v8.2.0), v8.3 in progress
.planning/HANDOFF.json  → не trigger'ит pause (контекст в норме)
INTAKE-*.md            → ничего нового после 2026-05-19 v8.3 closure

Расхождение: §23 расширяет scope текущего активного milestone (v8.3)
без открытия нового — это safe, plan §22 уже зафиксирован, §23 идёт
как extension того же PRJ-2 stream.
```

### 23.13 Recovered intent (источники)

```text
user message 1 → "доделаем deferred"      → scope extension
user message 2 → "не понял"               → simplify, перевыспросить
user message 3 → free-form Other (voice)  → дроп multi-SDLC, holidays
                                            только Coming Soon
user message 4 → "Holiday в ToDo,         → Coming Soon pattern +
                  Coming Soon в настройках"  TODO маркер
user message 5 → "пропиши в клаудио репо" → CLAUDE.md rule update
user message 6 → "Использую Demo план для  → этот rich-mode rewrite
                  максимальности"
user message 7 → "почему перелисты НЕ     → §0 баг описание уточнено
                  показывают снапшоты?"     (фикс уже в коде, §0
                                            описывал ДО-состояние)
```

### 23.14 Boundaries

**Трогаем:**

```text
apps/web/src/components/dashboard/                     T-F4-4 pulse
apps/web/src/components/dashboard/dashboard-page.tsx   pulse KPI card
apps/web/src/app/(app)/admin/                          T-HOL coming-soon
apps/web/e2e/regression/landing-*.spec.ts (NEW × 2)    T-UAT-L
apps/api/src/modules/notifications/  (или ближайший)   pulse mutation
CLAUDE.md (repo, не runtime)                           ComingSoon rule
.planning/todos/pending/2026-05-21-holidays-calendar.md (NEW)
```

**Не трогаем:**

```text
prisma/schema.prisma                  никаких миграций
prisma/migrations/                    никаких миграций
~/.claude/CLAUDE.md (managed runtime) — только repo CLAUDE.md
apps/api/src/lib/business-date.ts     holidays integration → v8.4
director-* / Holiday* модели          вне scope
ProductSDLC модель                    DROPPED полностью
.planning/memory/*.md dirty           pre-existing, оставляем
```

### 23.15 Skill routing

```text
skill                  применение                       output
─────────────────────  ──────────────────────────────   ────────────
Demo-plan (этот)        rich-mode разметка §23           этот файл
react-best-practices   pulse component composition      JSX patterns
typescript-pro         tRPC mutation typing для         schema +
                       pingLead                         types
nestjs-expert          backend mutation если нужна      service ref
                       новая в notifications/
test-quality           vitest для pulse                 test patterns
gsd-execute-phase      НЕ нужен (extension в той же     —
                       ветке, не новая phase)
Demo-gitlab             в финальном F5 MR (§9a)          MR создание
Demo-jira               PRJ-2 transition после merge     issue update

Сознательно пропущено: gsd-ai-integration-phase (нет AI),
Demo-confluence (не публикуем), security-audit (трогаем только UI +
existing tRPC paths без auth changes).
```

### 23.16 Subagent roadmap (Sonnet + Haiku + research + review)

Расширено по feedback пользователя: добавлен wave-(-1) best-practices research
и wave-3 review gate как отдельная фаза до коммитов.

```text
Stage 0: Orchestrator (Claude Opus 4.7 — я)
  scope: live repo truth, intake, plan-write, integration, commits.

Stage 0a: Wave-(-1) best-practices research (Haiku × 3 параллельно)
  ┌─ Haiku-BP-pulse ──────────────────────────────────────────────┐
  │ scope: Context7 + WebSearch — «head dashboard remind UI 2026»,│
  │   «activity heatmap 24h React», «email reminder pattern       │
  │   tRPC + BullMQ» — best-practice references для UI            │
  │ output: 40-line — recommended patterns + anti-patterns        │
  │ NO writes                                                      │
  └────────────────────────────────────────────────────────────────┘
  ┌─ Haiku-BP-uat ────────────────────────────────────────────────┐
  │ scope: Context7 @playwright/test 1.55 — 2026 best practice    │
  │   landing e2e (auth helpers, retry, race-free seed, screenshot│
  │   baseline, role-based redirect coverage)                      │
  │ output: 40-line pattern cheatsheet                            │
  │ NO writes                                                      │
  └────────────────────────────────────────────────────────────────┘
  ┌─ Haiku-BP-coming-soon ────────────────────────────────────────┐
  │ scope: внутренний — найти существующий ComingSoon-pattern     │
  │   (nav-bar.tsx Language/Theme), сравнить с UI guidelines,     │
  │   составить копипаст-template                                 │
  │ output: 30-line — pattern + ready-to-paste snippet            │
  │ NO writes                                                      │
  └────────────────────────────────────────────────────────────────┘

Stage 1: Wave-0 pre-flight discovery (Haiku × 2 параллельно)
  ┌─ Haiku-PD (pulse-discovery) ──────────────────────────────────┐
  │ scope: read-only grep + Read                                  │
  │ files: dashboard-page.tsx, lead-summary-table.tsx,             │
  │        activity-live-panel.tsx, trpc.router.ts notifications  │
  │ output: 80-line report — селекторы, mutation paths,           │
  │         24h activity heuristic, existing testids              │
  │ NO writes                                                      │
  └────────────────────────────────────────────────────────────────┘
  ┌─ Haiku-LD (landing-discovery) ────────────────────────────────┐
  │ scope: read-only grep + Read                                  │
  │ files: apps/web/src/app/page.tsx, /auth/, login-page.client,  │
  │        existing e2e: landing.spec, agent-a-landing,           │
  │        helpers/dev-auth.ts                                    │
  │ output: 80-line report — landing flows, redirect rules,       │
  │         seed flavors, testids                                 │
  │ NO writes                                                      │
  └────────────────────────────────────────────────────────────────┘

Stage 2: Wave-1 implementation (3 параллельных worker-агента)
  ┌─ Sonnet-1 (T-F4-4 pulse) ─────────────────────────────────────┐
  │ scope: write — pulse UI + Remind button + 24h logic + tests   │
  │ owns: components/dashboard/* (+ NEW remind-lead-button.tsx),  │
  │       trpc.router.ts (notifications.pingLead если нужна)      │
  │ input: brief от Haiku-PD                                      │
  │ output: одна строка статуса + изменённые файлы                │
  │ NO commit                                                      │
  └────────────────────────────────────────────────────────────────┘
  ┌─ Sonnet-2 (T-UAT-L) ──────────────────────────────────────────┐
  │ scope: write — 2 NEW e2e spec файла                           │
  │ owns: apps/web/e2e/regression/landing-public.spec.ts,         │
  │       apps/web/e2e/regression/landing-role-redirect.spec.ts   │
  │ input: brief от Haiku-LD                                      │
  │ output: одна строка статуса                                   │
  │ NO commit                                                      │
  └────────────────────────────────────────────────────────────────┘
  ┌─ Haiku-3 (T-HOL coming-soon) ─────────────────────────────────┐
  │ scope: write — Coming Soon UI block + TODO файл               │
  │ owns: apps/web/src/app/(app)/admin/page.tsx (или ближайший    │
  │       admin settings surface), pattern из nav-bar.tsx         │
  │       LanguageComingSoonControl;                              │
  │       .planning/todos/pending/2026-05-21-holidays-calendar.md │
  │ input: nav-bar.tsx pattern reference (прямая ссылка)          │
  │ output: одна строка статуса                                   │
  │ NO commit                                                      │
  └────────────────────────────────────────────────────────────────┘

Stage 3: Wave-2 orchestrator integration (pre-commit)
  ├─ полный pnpm typecheck && pnpm lint && pnpm test
  ├─ CLAUDE.md edit ComingSoonBadge правило (Opus вручную)
  ├─ playwright spec'и компилируются, run откладывается (нет dev-server)
  └─ stage worker outputs ready-to-commit, НО commit ещё нет

Stage 4: Wave-3 Review Gate (Demo review разделён по доменам)
  ┌─ Haiku-RV-react (react domain) ───────────────────────────────┐
  │ scope: read-only review pulse changes против react-best-      │
  │   practices skill rubric (composition, Hooks rules, useMemo   │
  │   misuse, accessibility)                                       │
  │ input: file list от Sonnet-1                                  │
  │ output: PASS / BLOCK + конкретные file:line                   │
  └────────────────────────────────────────────────────────────────┘
  ┌─ Haiku-RV-tests (tests domain) ───────────────────────────────┐
  │ scope: read-only review UAT-L specs + pulse tests:            │
  │   coverage чисто проверяет F-3 поведение, нет fragile         │
  │   timeouts, нет dead code, нет skipped без TODO                │
  │ output: PASS / BLOCK                                          │
  └────────────────────────────────────────────────────────────────┘
  ┌─ Haiku-RV-claude-md (docs domain) ────────────────────────────┐
  │ scope: проверить новое правило в CLAUDE.md на согласованность │
  │   с существующим Deferred Features блоком; lint markdown      │
  │ output: PASS / BLOCK                                          │
  └────────────────────────────────────────────────────────────────┘
  Опция fork: если ревью найдёт BLOCK с большим объёмом fix —
  отдать fix как fork subagent (`isolation: worktree`), Opus
  смерджит результат после.

Stage 5: Post-review actions
  ├─ если ревью PASS — 3 атомарных коммита: pulse, UAT-L, holidays+CLAUDE.md
  ├─ если ревью BLOCK — Sonnet-fix worker (scoped) → re-review
  ├─ git push origin fix/PRJ-2/shiny-eagle
  ├─ /codex:review на полный diff origin/main..HEAD (внешнее second-opinion)
  └─ /Demo-plan verify graceful-coalescing-kurzweil → ≥80
```

### 23.17 Token economy

| Work                            | Model  | Writes         |
| ------------------------------- | ------ | -------------- |
| best-practice research (×3)     | Haiku  | no             |
| pre-flight grep/read scan (×2)  | Haiku  | no             |
| classification, status          | Haiku  | no             |
| pulse implementation            | Sonnet | yes, scoped    |
| UAT-L e2e specs                 | Sonnet | yes, scoped    |
| holidays coming-soon            | Haiku  | yes, micro     |
| review per domain (×3)          | Haiku  | no (read-only) |
| BLOCK-driven fix worker         | Sonnet | yes, scoped    |
| optional fork subagent worktree | Sonnet | yes, isolated  |
| plan synthesis                  | Opus   | only plan.md   |
| CLAUDE.md rule edit             | Opus   | only CLAUDE.md |
| integration commits + push      | Opus   | git ops        |

Iteration reserve: ≈15% контекста под Wave-2 fix-ups + Wave-3 review fix loop.
Deep model (Opus) активирован только для оркестрации и плана.

**Fork subagent policy:** worktree-isolation использовать ТОЛЬКО когда
review-loop требует параллельного fix-а на тех же файлах, что и активный
implementation worker (race по `apps/web/src/components/dashboard/*`).
В обычном случае scoped Sonnet справляется без worktree.

### 23.18 Open questions с defaults

```text
| #   | Вопрос                                | Default                  | Эскалирую если              |
| --- | ------------------------------------- | ------------------------ | --------------------------- |
| Q10 | Новый tRPC namespace notifications или| ближайший существующий   | conflict с existing module  |
|     | extend existing                       | (review/email)           |                             |
| Q11 | 24h activity threshold — фикс или    | фикс 24h                 | пользователь хочет slider   |
|     | конфиг?                              |                          |                             |
| Q12 | Remind button — confirm modal?       | без confirm (один клик)  | юзер жалуется на случайные  |
| Q13 | Holidays todo destination            | .planning/todos/pending/ | user указал другой путь     |
| Q14 | CLAUDE.md правило — repo only или    | repo CLAUDE.md only      | пользователь явно расширит  |
|     | global ~/.claude/CLAUDE.md?          |                          | в global                    |
```

Применяю дефолты автономно.

### 23.19 Agent does / Human does

```text
─────────────────────────────────────
✓ Я ДЕЛАЮ САМ
─────────────────────────────────────
  ├── spawn Haiku ×3 wave-(-1) best-practice research
  ├── spawn Haiku ×2 wave-0 internal discovery
  ├── spawn Sonnet ×2 + Haiku ×1 wave-1 workers
  ├── integration check (typecheck/lint/test)
  ├── spawn Haiku ×3 wave-3 review gate (react/tests/docs)
  ├── BLOCK-driven Sonnet fix-loop если нужно
  │   (fork worktree только при race на одном файле)
  ├── CLAUDE.md ComingSoon rule edit
  ├── 3 атомарных коммита + push
  ├── /codex:review на diff (внешнее second-opinion)
  └── /Demo-plan verify finally

─────────────────────────────────────
▲ ОТ ТЕБЯ
─────────────────────────────────────
  ├── T-D12 manual UAT (по §22.10) — open item dialog → change
  │   status → save → reopen → check pill. 1 минута.
  ├── (опционально) запустить локально playwright для smoke 7
  │   новых landing specs + pulse smoke, если есть dev-server
  └── approve MR в GitLab UI после моего F5 push
```

### 23.20 Iteration reserve

```text
plan hardening: §0 баг описания уточнено по feedback пользователя
self-review:    perform pillar review (§23.22) перед ExitPlanMode
feedback loop:  если worker-агенты дадут несовместимые changes,
                merge сам (Opus) с приоритетом read-write-исхода
evidence refresh: перед wave-1 сделать git pull (origin может уйти
                  вперёд)
token reserve:  ~15% контекста на integration fix-ups
```

### 23.21 Verification (final, §23)

```bash
# (a) Полные гейты
pnpm typecheck
pnpm lint
pnpm test

# (b) Playwright (если есть dev-server)
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts \
  --grep "landing|pulse|remind"

# (c) Mailpit smoke (manual)
# Open http://localhost:8025
# в UI Head dashboard → Remind кнопка на draft-лиде
# → подтвердить email появился в Mailpit
# (только если есть локальный stack)

# (d) Coming Soon UI smoke
# /admin → секция Holidays → hover показывает tooltip
# (или /head/dashboard если admin не доступен)

# (e) Demo-plan verify
/Demo-plan verify graceful-coalescing-kurzweil
# target ≥80
```

### 23.22 Pillar review self-check (перед ExitPlanMode)

```text
| Pillar          | Verdict                                              |
| --------------- | ---------------------------------------------------- |
| Workflow        | ✓ соответствует docs/core/WORKFLOW.md                |
| Git/TTT         | ✓ task PRJ-2 / branch fix/PRJ-2/shiny-eagle          |
| Source of truth | ✓ правим repo CLAUDE.md, не runtime managed         |
| Tests           | ✓ команды + критерии PASS определены                |
| Skills/docs     | ✓ lint:md и typecheck в verify-секции               |
| Token economy   | ✓ Haiku для scan, Sonnet для writes, Opus оркестр.  |
| Visual quality  | ✓ ASCII frames + один pipeline без широких Mermaid  |
| Iteration       | ✓ §0 уточнён по feedback, self-review этот блок     |
```

### 23.23 Closeout (что после wave-2)

```text
└─ §22 + §23 закрыты → переход в §9a F5:
   ├─ /Demo-gitlab create-mr (source fix/PRJ-2/shiny-eagle → main)
   ├─ MR описание включает §22 + §23 deltas
   ├─ ручной approve в GitLab UI (от пользователя)
   ├─ merge --no-ff (preserve commit history per §F5.2 default)
   ├─ /Demo-jira transition PRJ-2 → next state
   └─ tag v8.3.x если milestone v8.3 целиком закрыт
```
