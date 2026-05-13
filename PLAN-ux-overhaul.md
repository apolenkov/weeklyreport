# UX Overhaul Plan — modal editing, regression coverage, empty-state, erase semantics

**Date:** 2026-05-02
**Scope:** `/lead/report` page (Lead form). Other pages out of scope.
**Driver:** four user pain-points from live testing:

1. Стирание текста в priority/decision/item не сохраняется на сервере (autosave-фильтр дропает пустые rows; round-trip возвращает старый текст).
2. При полностью удалённой Current Week (0 items) кнопка `+ Add` исчезает — сектор «мёртвый».
3. Редактирование одного поля (только `text`) недостаточно — пользователь хочет диалог со ВСЕМИ полями схемы (tag, owner, impact, mitigation, deadline, projectId, severity, workflowStatus, carriedOver).
4. Регрессионные тесты не ловят UI-баги, потому что мокают tRPC — нужно перенести их на Playwright E2E против live-стека.

**Не-цели:** перерисовка SDLC pipeline, изменения backend-схемы, мобильные правки сверх существующих.

---

## Архитектура решения

### Источник истины: schema + UAT-сценарии

Первое — переписать регрессионные сценарии из mock-based unit-тестов в Playwright E2E (`apps/web/tests/e2e/lead-form-crud.spec.ts`). Эти сценарии становятся определением «работает» — каждый PR должен их проходить.

### Источник истины UI: ModalEditor

Каждый CRUD-домен (item / risk / decision / priority) получает диалог `<DomainEditDialog>` со всеми полями `domainInputSchema`. Inline-edit в карточке остаётся как быстрый шорткат для `text`-only правки, но кнопка-карандаш открывает диалог.

### Empty-state

Каждая аккордеон-секция показывает `+ Add` независимо от количества items. Если pproducts пуст (на старте у нового лида) — кнопка отключена с подсказкой «Контакт админа: продукты не назначены».

### Erase = delete

Когда пользователь стирает `text` в priority/decision/item:

- Локальное state сохраняет row с пустым `text`.
- `sectionToDraftPayload` НЕ дропает, а превращает в payload `delete`-intent: row помечается `_intent: 'delete'` либо id остаётся, text='' и тогда сервер должен удалить.
- Поскольку server.saveDraft делает `deleteMany` + `createMany`, проще всего на клиенте просто исключить пустую row из массива `next` (то есть удалить её из локального state), а UI нарисует placeholder/empty-state.
- Для priorities: пустой rank-2 рисуется как `Second priority...` placeholder, но фактически в `draftSection.priorities` его нет.

---

## Фаза 1 — Регрессионные E2E (test-first)

**Файл:** `apps/web/tests/e2e/lead-form-crud.spec.ts`

**Pre-conditions (beforeEach):**

- Reset DB через `pnpm db:seed:simple`
- `await page.goto('/auth/dev-login?role=lead&email=platanov@customreport.local&redirect=/lead/report')`

**Сценарии (каждый — отдельный `test()`):**

### S1. Items — current week

1. **S1.1 Add** — нет items в seed (пред-условие: удалить все 3 через UI), клик `+ Add` → диалог открывается → text="X" tag=feature workflow=in_progress → Save → reload → row виден, `Current Week 1 items`.
2. **S1.2 Edit** — клик карандаш на существующем → диалог содержит все поля → меняю text → Save → reload → новый text.
3. **S1.3 Delete** — корзина → confirm → reload → нет row.
4. **S1.4 Erase** — открываю диалог, очищаю text, Save → диалог требует non-empty (validation), либо row удаляется (как S1.3). Не должно быть «текст вернулся» после reload.
5. **S1.5 Empty + Add** — после удаления всех items, секция показывает заглушку «No current-week items yet» + большая кнопка `+ Add`.

### S2. Items — next week

Зеркало S1 для next week.

### S3. Risks

1. **S3.1 Add** — `+ Add Risk` → диалог: risk + impact + mitigation + projectId(select) + severity(at-risk/blocked) → Save → reload → row.
2. **S3.2 Edit** — клик на row → диалог со всеми 5 полями.
3. **S3.3 Delete** — корзина → reload.
4. **S3.4 Erase** — стираю risk/impact/mitigation → диалог validation отклоняет.
5. **S3.5 Empty** — нет risks → секция показывает «No risks reported. + Add Risk».
6. **S3.6 Stage sync** — добавляю risk на stage X → подтверждение → SDLC chip stage X = at-risk. Удаляю risk → chip = on-track.

### S4. Decisions

1. **S4.1 Add** — `+ Add Decision` → диалог: text + owner + impact + deadline(date picker) → Save → reload.
2. **S4.2 Edit** — карандаш → все 4 поля.
3. **S4.3 Delete** — корзина → reload.
4. **S4.4 Erase** — диалог validation.
5. **S4.5 Empty** — пустой список + `+ Add Decision`.
6. **S4.6 Deadline** — выбираю дату 7 дней вперёд → reload → отображается human-friendly «in 7 days».

### S5. Priorities

1. **S5.1 Edit slot 2** — клик на placeholder slot 2 → диалог: text + rank(disabled, =2) → Save → reload → slot 2 заполнен.
2. **S5.2 Erase slot 2** — Edit slot 2 → text="" → Save → диалог удаляет (или validation), reload → slot 2 снова placeholder, badge `1/3`.
3. **S5.3 Все 3 заполнены** — badge `3/3`.

### S6. Stage chip popover

1. **S6.1 Не клипается** — клик `Dev (mine)` chip → popover виден целиком, 4 опции (`On Track`, `At Risk`, `Blocked`, `Clear`) полностью в viewport.
2. **S6.2 Status update** — выбираю `On Track` → chip обновляется, traffic-light зелёный.

### S7. Fill from Previous

1. **S7.1 Confirm** — клик `Fill from Previous` → диалог `Fill from Week 15?` → `Replace & Fill` → reload → data из Week 15.
2. **S7.2 Cancel** — `Cancel` → данные не изменились.

### S8. Submit

1. **S8.1 Confirm** — клик `Submit Report` → modal с stats → `Submit Report` button → reload → форма read-only.
2. **S8.2 Cancel** — `Cancel` → форма editable.

### S9. Restore version

1. **S9.1 Restore v1** — версии `v1` и `v2` в seed → выбираю v1 → confirm → reload → data из v1.

### S10. Permissions

1. **S10.1 Past period read-only** — переключаю на Week 15 → form readonly, кнопок нет.
2. **S10.2 Submitted lock** — после S8.1 — все CRUD-кнопки скрыты.

**Вспомогательные хелперы:** `apps/web/tests/e2e/helpers/lead-form.ts` — `loginAs(role, email)`, `expandAccordion(name)`, `openItemDialog(text)`, `fillItemDialog({text,tag,workflow})`.

---

## Фаза 2 — Empty-state + Add buttons

**Файлы:**

- `current-week-section.tsx` — после `{[...grouped.entries()].map(...)}` добавить fallback:
  ```tsx
  {
    grouped.size === 0 && !readOnly && (
      <EmptyState
        onAdd={() => handleAdd(seedFromProducts())}
        disabled={!products.length}
      />
    );
  }
  ```
  где `seedFromProducts()` = первый product из props.
- `next-week-section.tsx` — то же.
- `risks-section.tsx` — кнопка `+ Add Risk` всегда видна (если `!readOnly`); если products пуст — `disabled` с tooltip.
- `decisions-section.tsx` — empty list → показывать `+ Add Decision` с заглушкой выше.
- `priorities-section.tsx` — уже всегда 3 slots, не требует.

**Новый компонент:** `apps/web/src/components/lead/empty-state.tsx` — generic заглушка `<div>{message}<Button>+ Add</Button></div>`.

**Пропс `products`:** прокинуть в current-week и next-week секции (сейчас они не получают products, потому новые row создаются с `seed: groupItems[0]` — но если items=0, нет seed).

---

## Фаза 3 — Erase semantics

**Файл:** `apps/web/src/components/lead/lead-form.tsx`

### handleCurrentWeekItemsChange / handleNextWeekItemsChange

Already correct: filter `!== id` removes row from local state. Server `saveDraft` deleteMany+createMany гарантирует синхронность. Empty `text` row сейчас попадает в state с text='' и потом дропается фильтром в payload — фикс: при text='' автоматически удалять row из state. **Менять не нужно** — UI всё равно открывает диалог для нового row, и пользователь жмёт «Cancel» → row не вставляется.

### handlePrioritiesChange

Сейчас:

```ts
const presentRanks = new Set(merged.map((p) => p.rank));
const preserved = prev.priorities.filter((p) => !presentRanks.has(p.rank));
const all = [...preserved, ...merged].sort(...);
```

`priorities-section` всегда отправляет `next` со всеми 3 ranks, так что preserved = []. Но: если пользователь стирает text в slot 2, `handleTextChange` отправляет `[{rank:1,text:'A'}, {rank:2,text:''}, {rank:3,text:'C'}]` → merged содержит rank 2 с text='' → в state остаётся. `sectionToDraftPayload.filter(hasText)` дропает rank 2 → server deleteMany+createMany сохраняет только 1 и 3 → reload приходит без rank 2 → UI рендерит placeholder. ✅ должно работать. Если не работает — bug в другом месте, найти через console.log в handleTextChange + проверка autosave payload в Network tab.

### handleRisksChange / handleDecisionsChange

Аналогично — фильтр в payload корректен, server delete-and-recreate. Менять не нужно.

**Что менять:** диалог-режим эту проблему решает архитектурно. В диалоге Save кнопка disabled пока поля не валидны. Пустой текст — `Save` → `Delete row instead?` confirmation.

---

## Фаза 4 — Modal editing everywhere

### Общая инфраструктура

**Файл:** `apps/web/src/components/lead/edit-dialogs/` — новая директория.

**Базовый компонент:** `apps/web/src/components/lead/edit-dialogs/base-dialog.tsx` — `<Dialog>` shell с `Save`/`Cancel`/`Delete`-в-edit-режиме кнопками, validation banner.

**Hook:** `useEditDialog<T>()` — возвращает `{open, openFor(initial), close, draft, setDraft, errors}`.

### ItemEditDialog

**Поля:**

- `text` — `<Textarea>` required
- `tag` — `<Select>`: `feature` / `bugfix` / `infra` / `ops` / `general`. Default `general`.
- `workflowStatus` — `<RadioGroup>`: `in_progress` / `done` / `blocked`. Default `in_progress`. Visible только для current-week items.
- `projectId` — `<Select>` из `products`. Default = текущий product.
- `carriedOver` — `<Checkbox>`. Default false.

### RiskEditDialog

**Поля:**

- `risk` — `<Textarea>` required, max 500
- `impact` — `<Textarea>` required, max 500
- `mitigation` — `<Textarea>` required, max 500
- `projectId` — `<Select>` required
- `severity` — `<RadioGroup>` `at-risk` / `blocked`

### DecisionEditDialog

**Поля:**

- `text` — `<Textarea>` required
- `owner` — `<Input>` required
- `impact` — `<Textarea>` required
- `deadline` — `<DatePicker>` optional (shadcn calendar)

### PriorityEditDialog

**Поля:**

- `text` — `<Textarea>` required
- `rank` — disabled `<Input>` showing slot number

### Триггеры

- `+ Add` button → `openFor(emptyDefault)`.
- Pencil icon на row → `openFor(row)`.
- Inline-edit на ItemCard сохранять как fast path для опытных пользователей.

### Save flow

1. `Save` → validate (Zod schema локально).
2. Если valid → `onChange(merged array with new/updated row)`.
3. Close dialog.
4. Autosave debounce 3s срабатывает.

### Delete flow в режиме edit

- Кнопка `Delete` (красная) → confirm → `onChange(filter !== id)` → close.

### Удаление inline-Edit textarea

Inline-edit textarea в ItemCard (Phase 21) удалить — теперь pencil → диалог. Опция оставить через `?fastEdit=true` query — отложить.

---

## Фаза 5 — Stage chip popover (уже сделано в HEAD~1)

Закоммичено в `feat(lead-form): portal stage chip popover` (sketch). Регрессионный тест S6.1 покрывает.

**Что осталось:** запустить S6.1 и убедиться что popover виден целиком. Если позиция плохая на узком viewport → добавить flip.

---

## Файлы

### Новые

- `apps/web/src/components/lead/edit-dialogs/base-dialog.tsx`
- `apps/web/src/components/lead/edit-dialogs/item-edit-dialog.tsx`
- `apps/web/src/components/lead/edit-dialogs/risk-edit-dialog.tsx`
- `apps/web/src/components/lead/edit-dialogs/decision-edit-dialog.tsx`
- `apps/web/src/components/lead/edit-dialogs/priority-edit-dialog.tsx`
- `apps/web/src/components/lead/empty-state.tsx`
- `apps/web/src/components/lead/use-edit-dialog.ts`
- `apps/web/tests/e2e/lead-form-crud.spec.ts`
- `apps/web/tests/e2e/helpers/lead-form.ts`

### Меняем

- `apps/web/src/components/lead/lead-form.tsx` — убрать "TBD" hacks, диалоги становятся источником значений всех полей.
- `apps/web/src/components/lead/current-week-section.tsx` — empty-state + dialog wiring.
- `apps/web/src/components/lead/next-week-section.tsx` — то же.
- `apps/web/src/components/lead/risks-section.tsx` — dialog вместо textarea.
- `apps/web/src/components/lead/decisions-section.tsx` — dialog.
- `apps/web/src/components/lead/priorities-section.tsx` — dialog при клике.
- `apps/web/src/components/lead/item-card.tsx` — pencil → dialog (убрать inline edit-mode).
- `apps/web/src/components/lead/lead-form.tsx#sectionToDraftPayload` — убрать "TBD" дефолты, теперь dialogs гарантируют schema-valid.
- `apps/web/src/lib/mappers/lead-form.ts#mapLeadDecisions` — добавить owner/impact/deadline в LeadDecisionEntry presentation type.
- `apps/web/src/components/lead/mock-data.ts` (типы DecisionEntry, RiskEntry) — расширить.

---

## Acceptance criteria

- ✅ Все 30+ E2E сценариев из Фазы 1 проходят (`pnpm playwright test e2e/lead-form-crud.spec.ts`).
- ✅ Empty-state Current/Next/Risks/Decisions показывают `+ Add`.
- ✅ Стирание текста через диалог удаляет row (или валидация блокирует Save) — после reload данные синхронны.
- ✅ Все CRUD-операции открывают диалог со всеми полями схемы.
- ✅ Никаких `TBD`-дефолтов в `lead-form.tsx` (схема пробивается через UI fields).
- ✅ Stage chip popover виден целиком в viewport (portal).

---

---

## Карта макетов (mockups/cutom_report_maket_mockup-v17-v14.html) vs текущая реализация

| #   | Что в макете                                                                                                                                                                                               | Файл/линия       | Текущее состояние                                                                           | Дельта                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| M1  | **Add/Edit Item Modal** — header с продуктом, поля: Description (input), Status chip-row (`✓ Completed` / `! In Progress` / `✕ Blocked` / `○ Planned`), Assignee select, Cancel/Save                       | mockup:900-909   | inline-edit textarea в ItemCard (только text)                                               | СОЗДАТЬ диалог. Поле `Status` соответствует `workflowStatus`. `Assignee` пока не в schema — отложить либо добавить как metadata |
| M2  | **SDLC Stage Popover (Save-only)** — header с названием стадии и продукта, Assignee select, Status chip-row (`✓ On Track` / `! At Risk` / `✕ Blocked`), **отдельная Save-кнопка** (не auto-apply на клике) | mockup:911-920   | сейчас выбор статуса = клик по опции в dropdown → apply мгновенно (через portal — починено) | МЕНЯТЬ: popover показывает форму с Save/Cancel, без auto-apply. Добавить `Assignee` select                                      |
| M3  | **Submit Report Confirmation** — stats line ("6 products · 11 items · 1 risk · 2 decisions") + Cancel/Submit                                                                                               | mockup:922-927   | реализовано в `<SubmitConfirmDialog>` ✓                                                     | ПРОВЕРИТЬ соответствие                                                                                                          |
| M4  | **Publish & Lock Report** — stats banner + warning "⚠ N leads не submitted: имена" + Cancel/Publish                                                                                                        | mockup:929-935   | head/report имеет Publish & Lock — есть ли warning?                                         | СВЕРИТЬ                                                                                                                         |
| M5  | **Reopen Report (Head/Admin)** — stats banner + Cancel/Reopen                                                                                                                                              | mockup:937-942   | возможно отсутствует                                                                        | ДОБАВИТЬ если нет                                                                                                               |
| M6  | **Request Reopen (Lead)** — read-only banner + кнопка "Request Reopen"                                                                                                                                     | mockup:944-949   | нет                                                                                         | ДОБАВИТЬ                                                                                                                        |
| M7  | **Past Period Banner (Read-Only)** — clock-icon + "Viewing past period · Week 15" + дата + бейдж Read-Only                                                                                                 | mockup:951-954   | у нас есть простой banner                                                                   | ОБНОВИТЬ дизайн                                                                                                                 |
| M8  | **Fill From Dialog (with search)** — search input + radio-list прошлых reports со stats + Cancel/Fill                                                                                                      | mockup:956-967   | есть простой dialog без search и radio                                                      | ПЕРЕДЕЛАТЬ под search+radio                                                                                                     |
| M9  | **Copy Warning (overwrite)** — Yellow alert + stats existing data + "Replace will overwrite" + Cancel/Replace & Fill                                                                                       | mockup:969-978   | у нас сразу один диалог совмещает Fill + warning                                            | РАЗДЕЛИТЬ                                                                                                                       |
| M10 | **Revoke Submission** — avatar+lead info + Cancel/Revoke                                                                                                                                                   | mockup:980-985   | нет (head нужно revoke)                                                                     | ДОБАВИТЬ                                                                                                                        |
| M11 | **Version History (rollback)** — список версий с Active highlight, Restore-кнопка, **diff preview** между версиями (`+ added`, `~ edited`, `− removed`) + warning "discard newer"                          | mockup:987-1007  | у нас простой dropdown с Restore                                                            | ДОБАВИТЬ diff preview, расширить дизайн                                                                                         |
| M12 | **Send Reminder** — список лидов которые не сдали, Cancel/Send Email                                                                                                                                       | mockup:1009-1017 | возможно есть                                                                               | СВЕРИТЬ                                                                                                                         |
| M13 | **Add/Edit User (Admin)** — Full Name + Email + Role select + Department + Assigned Products chips + Cancel/Save                                                                                           | mockup:1019-1036 | у нас Add User кнопка работает, но диалог не сверял                                         | СВЕРИТЬ                                                                                                                         |
| M14 | **Add/Edit Product (Admin)** — Name + Status (Active/Archived) + SDLC Stages list (per stage assignee select + delete + Add Stage)                                                                         | mockup:1038-1057 | возможно частично есть                                                                      | СВЕРИТЬ                                                                                                                         |
| M15 | **Add Period (Admin)** — Start/End дата + Deadline datetime + Week Label                                                                                                                                   | mockup:1059-1071 | возможно есть                                                                               | СВЕРИТЬ                                                                                                                         |
| M16 | **Reminder Settings (Admin)** — toggles: auto-reminder on deadline / 24h before / weekly summary                                                                                                           | mockup:1073-1082 | возможно частично                                                                           | СВЕРИТЬ                                                                                                                         |
| M17 | **Locked Form** banner                                                                                                                                                                                     | mockup:895       | есть submitted-banner                                                                       | СВЕРИТЬ дизайн                                                                                                                  |
| M18 | **Notifications** (toast variants — success/error/warning)                                                                                                                                                 | mockup:896       | toast есть, варианты не сверял                                                              | СВЕРИТЬ                                                                                                                         |
| M19 | **Validation Error** (input border red + error message)                                                                                                                                                    | mockup:897       | shadcn form support, но в формах?                                                           | ДОБАВИТЬ inline validation в диалоги                                                                                            |
| M20 | **Delete Confirmation** — header + body preview ("Интеграция OAuth2") + Cancel/Delete                                                                                                                      | mockup:898       | у нас Delete срабатывает мгновенно без confirmation                                         | ДОБАВИТЬ confirm-dialog                                                                                                         |

**Замеченные пробелы (не в плане выше):**

- M2 — popover с Save (а не auto-apply) — это меняет UX-контракт chip-popover. Влияет на S6.
- M9 + M8 — Fill flow двух-шаговый: первый диалог выбор + второй Copy Warning. Сейчас один.
- M19 — inline validation отсутствует в формах, нужна везде.
- M20 — отсутствие Delete confirmation на CRUD — пользователь может случайно удалить.
- **Risk/Decision/Priority модалки** в макете НЕ показаны — их нужно сделать по аналогии с M1.

---

## Фаза 6 — Dev seed/wipe controls

**Зачем:** во время разработки часто нужно стереть всё и переналить full/minimum seed без `pnpm db:seed:simple` из терминала.

**Файлы:**

- `apps/api/src/modules/dev/dev.router.ts` (новый) — tRPC mutations:
  - `dev.wipe()` — `prisma.priority/decision/risk/item/projectStatus/reportSection.deleteMany`
  - `dev.reseedMinimum()` — runs current `seed-simple.ts` content
  - `dev.reseedFull()` — runs more advanced `seed.ts` (если будет)
  - все три gated на `env.AUTH_DEV_MODE === 'true'`
- `apps/web/src/components/dev/role-switcher.tsx` — добавить раздел "Data" с кнопками: Wipe / Reseed minimum / Reseed full → confirm → invalidate queries → page reload.
- `apps/api/src/main.ts` — wire dev router только в `AUTH_DEV_MODE`.

**Acceptance:**

- кнопки видны только в dev (флаг `NEXT_PUBLIC_DEV_ROLE_SWITCHER=true` И `AUTH_DEV_MODE=true`).
- после Wipe пользователь видит empty-state.
- после Reseed minimum возвращает текущий seed-simple.

---

## Открытые вопросы пользователю

1. **Макет.** Есть ли Figma/png макета модалки, на который ориентироваться? Если нет — соберу по shadcn `Dialog` + `Form` без брендового стайлинга, доточим итеративно.
2. **Inline-edit fast path в ItemCard.** Оставить (Enter/blur saves text) или удалить полностью в пользу диалога?
3. **DatePicker для decision deadline.** shadcn `Calendar` (date-fns зависимость) ОК?
4. **`projectId` change для существующего risk/item.** Можно менять или замораживать после создания? Schema допускает оба варианта.
5. **Severity для risk** — `at-risk`/`blocked` уже есть в presentation. Добавить ли `blocker`-flag отдельно (он сейчас derived от severity)?
6. **Порядок реализации** — Phase 1 (тесты) → Phase 2 (empty-state) → Phase 4 (диалоги) → Phase 3 (erase, отпадает после диалогов)? Или быстрые wins (Phase 2) → Phase 4 → Phase 1 в конце?

---

## Размер работы

- Phase 1 (тесты): ~600 строк, 8 файлов
- Phase 2 (empty-state): ~150 строк, 4 файла
- Phase 3 (erase): входит в Phase 4
- Phase 4 (диалоги): ~1500 строк, 8 файлов
- Phase 5 (popover): уже есть, +доп. тест

Итого: ~2500 строк, ~20 файлов. Реалистично 3–4 сессии (по ~1.5 часа Claude-времени), с регрессией после каждой фазы.
