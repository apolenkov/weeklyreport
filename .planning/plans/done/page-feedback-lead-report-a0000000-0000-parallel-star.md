# Page Feedback — Lead Report `/lead/report/a0000000-0000-…`

## Context

На странице lead-репорта пользователь дал визуальный feedback к четырём
add-кнопкам секций:

- `+ Add Item` (Current Week / Next Week) — помечено как **эталон**.
- `+ Add Priority`, `+ Add Decision`, `+ Add Risk` — помечены как «это», «надо
  перенести так же как Add Item».

В чём отличие. `+ Add Item` живёт **в шапке `<AccordionSection>`** через
существующий prop `actions=`: кнопка стоит справа от заголовка, рядом с
chevron. Триггер открытия диалога — signal-counter из parent: lead-form
поднимает `setCurrentWeekAddSignal(v => v + 1)`, секция слушает `addSignal`
через `useEffect` и сама открывает свой `ItemEditDialog`.

`+ Add Priority`, `+ Add Decision`, `+ Add Risk` сейчас живут **внутри тела
секции** — в `<div className="flex justify-end">` поверх списка, и открывают
локальный диалог напрямую. От этого они визуально оторваны от заголовка и
лежат на другой колонке (x:1251 вместо эталонных x:1199), с другой
hover-заливкой (`var(--color-surface-hover)` вместо `bg-white`) и другим
объявлением высоты (`min-h-[40px]` вместо `min-h-10`).

Цель — привести три кнопки к ровно тому же паттерну, что и эталонная Add
Item: вынести их в `actions=` соответствующих `<AccordionSection>` в
`lead-form.tsx`, использовать signal-counter, удалить локальный wrapper +
кнопку из секций.

## TLDR

```text
Было                                       │  Стало
───────────────────────────────────────────┼───────────────────────────────────────────
┌─ AccordionSection [Priorities]       ─┐  │  ┌─ AccordionSection [Priorities]  [+ Add Priority] ▼ ─┐
│ ┌─ space-y-3 ────────────────────────┐ │  │  │ <body>                                            │
│ │ <div flex justify-end>             │ │  │  │   список priorities                               │
│ │   [+ Add Priority]  ← хочется убрать│ │  │  └───────────────────────────────────────────────────┘
│ │ </div>                             │ │  │
│ │ список priorities                  │ │  │  (то же для Decisions и Risks)
│ └────────────────────────────────────┘ │  │
└────────────────────────────────────────┘  │
```

Проблемы → решения:

- 3 add-кнопки оторваны от заголовка секции → перенести в `actions=` шапки
  `<AccordionSection>`.
- 3 разных класса `min-h-[40px]` + `hover:bg-[var(--color-surface-hover)]` →
  привести к эталонным `min-h-10` + `hover:bg-white`.
- 3 локальных `<div className="flex justify-end">` wrapper'а → удалить (слот
  `actions` сам обёртывает в `<div className="flex shrink-0 items-center
gap-2">`).
- Локальный `handleAdd()` дёргается прямо из кнопки → перевести на
  signal-counter (`prioritiesAddSignal`, `decisionsAddSignal`,
  `risksAddSignal`).

Поток: `[user click + Add Priority]` → `[parent setPrioritiesAddSignal(v →
v+1)]` → `[PrioritiesSection useEffect on addSignal]` → `[setDialogState
open=true]` → `[PriorityEditDialog]`.

«От человека» — один раз глазами проверить позиционирование в браузере на
1728×962 на странице `/lead/report/a0000000-0000-4000-8000-000000000001`.
Всё остальное делаю сам.

## Architecture context

```text
[lead-form.tsx]
  ├─ AccordionSection [Current Week]   actions=<+ Add Item button> ──signal──▶ CurrentWeekSection
  ├─ AccordionSection [Next Week]      actions=<+ Add Item button> ──signal──▶ NextWeekSection
  ├─ AccordionSection [Risks]          actions=<+ Add Risk>        ──signal──▶ LeadFormSyncBridge.Risks ─▶ RisksSection   (NEW)
  ├─ AccordionSection [Decisions]      actions=<+ Add Decision>    ──signal──▶ DecisionsSection                            (NEW)
  └─ AccordionSection [Priorities]     actions=<+ Add Priority>    ──signal──▶ PrioritiesSection                           (NEW)
```

`AccordionSection` — локальная функция в `lead-form.tsx` (строки 232–343),
prop `actions?: React.ReactNode` уже существует (строка 250); слот рендерится
на 314–316 как `<div className="flex shrink-0 items-center gap-2">{actions}</div>`.
Дополнительных правок в самом `AccordionSection` не требуется.

Для Risks нужно протащить `addSignal` через bridge:
`<LeadFormSyncBridge.Risks />` (см. `lead-form-sync-bridge.tsx`) — нужно
расширить пропсы bridge'а и пробросить в `<RisksSection addSignal=… />`.

Read-only режим. Текущий тест `lead-form-sync-bridge.test.tsx:195–204`
проверяет, что в read-only у `+ Add Risk` нет кнопки. После переноса
условие `!isReadOnly` остаётся (как в эталонном Add Item, lead-form.tsx
1529), тест сохранит совместимость, имя кнопки `+ Add Risk` не меняется.

## Стратегия выполнения

- **Cheap-first delegation.** Сама работа маленькая (3 файла секций +
  lead-form.tsx + bridge), без отдельного поискового прохода — Explore
  агент уже вернул все file:line. Subagents для исполнения не нужны.
- **Parallel waves.** Все 4 file edits (lead-form.tsx + priorities-section.tsx
  - decisions-section.tsx + risks-section.tsx + bridge.tsx) идут одной
    волной — между ними нет data dependency. Single tool-use block, N
    параллельных Edit/Write.
- **Subagent split.** Не применяется (объём слишком мал, синтез простой).

## Files to modify

| Файл                                                     | Строки                                                           | Что меняется                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/lead/priorities-section.tsx`    | 124–129 (button), 147–162, 186–191                               | Удалить локальный `addButton` + wrappers `<div flex justify-end>`; добавить пропс `addSignal?: number`; добавить `useEffect` на `addSignal` → `handleAdd()`.                                                                                                                                                                                                                                                                                   |
| `apps/web/src/components/lead/decisions-section.tsx`     | 123–128 (button), 157–175                                        | То же самое: удалить `addButton` + wrapper; пропс `addSignal?: number`; `useEffect`.                                                                                                                                                                                                                                                                                                                                                           |
| `apps/web/src/components/lead/risks-section.tsx`         | 104–109 (button), 138–162                                        | То же самое: удалить `addButton` + wrapper; пропс `addSignal?: number`; `useEffect`. Сохранить логику `disabled={!hasProducts}` через `if (!hasProducts) return` внутри `useEffect` (без открытия диалога).                                                                                                                                                                                                                                    |
| `apps/web/src/components/lead/lead-form-sync-bridge.tsx` | (в Risks bridge component)                                       | Расширить пропсы `<LeadFormSyncBridge.Risks>` — принять `addSignal?: number`, передать в `<RisksSection addSignal={…} />`.                                                                                                                                                                                                                                                                                                                     |
| `apps/web/src/components/lead/lead-form.tsx`             | 1597–1612 (Risks), 1616–1639 (Decisions), 1647–1674 (Priorities) | Добавить три новых state: `prioritiesAddSignal`, `decisionsAddSignal`, `risksAddSignal`. В трёх `<AccordionSection>` добавить prop `actions={!isReadOnly ? <button className="min-h-10 … hover:bg-white …">+ Add X</button> : null}`. В Risks дополнительно: вычислить `const hasProductsForRisks = products.length > 0` и проставить `disabled={!hasProductsForRisks}` + `title` (как у Add Item). Пробросить `addSignal` в bridge / section. |

Ключевые JSX-якоря:

- Эталон шапки + button: `apps/web/src/components/lead/lead-form.tsx:1519–1556`
  (Current Week — пример для copy-paste).
- Слот actions в `AccordionSection`: `apps/web/src/components/lead/lead-form.tsx:314–316`.
- Эталонный useEffect на addSignal: `apps/web/src/components/lead/current-week-section.tsx:131–136`.

## Verification

```bash
# 1. Типы и линт
pnpm typecheck
pnpm lint

# 2. Юнит-тесты (затронутые)
pnpm --filter @customreport/web test -- --run \
  src/components/lead/lead-form-sync-bridge.test.tsx \
  src/components/lead/priorities-section.test.tsx \
  src/components/lead/risks-section.test.tsx

# 3. Регрессия Playwright (только релевантные spec'и)
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts \
  -g "lead-form|priorities|decisions|risks"

# 4. Ручная сверка
#   (a) http://localhost:3000/lead/report/a0000000-0000-4000-8000-000000000001
#       — все четыре кнопки (Add Item / Add Priority / Add Decision / Add Risk)
#       стоят справа в шапке своей AccordionSection, на одинаковом расстоянии
#       от правого края, с одинаковым стилем (min-h-10, hover:bg-white).
#   (b) Read-only режим (viewer) — кнопки не отображаются ни в одной из четырёх
#       секций.
#   (c) Клик по каждой из трёх перенесённых кнопок открывает соответствующий
#       create-диалог.
#   (d) Add Risk при отсутствии products у lead'а — disabled + title-тултип
#       «No products assigned …».
```

## Open questions

| #   | Вопрос                                                                                                                          | Как решу автономно                                                                                                                     | Когда эскалирую                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | Сохранять ли empty-state в priorities-section (раньше там тоже был `addButton` — строка 160)?                                   | Удалить из тела секции; в шапке `<AccordionSection>` кнопка всегда видна, что лучше эталона.                                           | Не эскалирую.                                                                                     |
| 2   | Risks — `disabled={!hasProducts}` сейчас на самой кнопке. После переноса кнопка живёт в parent, который не знает `hasProducts`. | `hasProductsForRisks = products.length > 0` уже доступен в lead-form.tsx (поле `products` ведёт state на всю форму). Использовать его. | Если в parent контексте `products` называется иначе — уточню при чтении кода во время реализации. |
| 3   | Risks bridge — расширять пропсы или вообще пропустить bridge для add-сигнала?                                                   | Расширить пропсы bridge'а — единственный честный путь, иначе нарушим инкапсуляцию.                                                     | Не эскалирую.                                                                                     |
| 4   | min-w-[136px] оставить или убрать?                                                                                              | Оставить — у эталона Add Item тоже `min-w-[136px]`.                                                                                    | Не эскалирую.                                                                                     |

## От человека

```text
┌─ ▲ ОТ ТЕБЯ ──────────────────────────────────────────────┐
│  глазами проверить в браузере на 1728×962:               │
│    1. http://localhost:3000/lead/report/a0000000-…-0001  │
│    2. все 4 кнопки стоят в шапке секций одинаково        │
│    3. read-only режим — кнопки скрыты                    │
│                                                          │
│  Всё остальное — Я делаю сам (правки + тесты + лит).     │
└──────────────────────────────────────────────────────────┘
```

## Side deliverables

- Не требуется обновление rules/CLAUDE.md — паттерн уже задокументирован
  существующими Current Week / Next Week в `lead-form.tsx`. Этот PR просто
  распространяет паттерн на ещё три секции.
- Если в процессе исполнения окажется, что `min-h-10` vs `min-h-[40px]`
  расходится с tailwind конфигом (`min-h-10` = 40px, должно совпасть) —
  закрепить эталонную форму `min-h-10` в трёх местах без отдельной правки
  tokens.
