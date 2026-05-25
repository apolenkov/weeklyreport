# Page feedback — /lead/report/a0000000-0000-…-000000000001 (twinkly-milner)

Branch: `fix/PRJ-2/shiny-eagle` · 2026-05-20 · продолжение W14

## Context

Пользователь дал три набора page-feedback к странице lead-отчёта Василия:
edit-mode (SDLC pipeline + StageChip) и slides-mode (продуктовые чипы +
inline-маркеры + вертикальный зазор). Цель — минимально-инвазивные правки,
сохраняющие текущий визуальный стиль; «никаких redesign», только починить
плавающие границы и заменить агрессивную блокировку на читаемую иконку.

## TLDR

```text
ДО                                          ПОСЛЕ
──────────────────────────────              ──────────────────────────────
edit-mode SdlcPipeline                      edit-mode SdlcPipeline
  [chips row]                                 [chips row]
  ┌─ Other contributors ─┐                    (панель удалена)
  │ Vasily 4 stages …    │                    hover на чужом chip:
  │ Boris  1 stage  …    │                    ┌─ Vasily · 4 items · 1 risk ─┐
  └──────────────────────┘                    └──────────────────────────────┘

StageChip locked (чужой)                    StageChip locked (чужой)
  opacity-35 grayscale-[0.5]                  full color + 🔒 lock icon
  ○ Planning (Бледный)                        ○ Planning 🔒 (читаемо)

slides chips row                            slides chips row
  [Маркет] [CRM-Cust] [CRM-D] [CRM-S]         [────] [────] [────] [────]
   разные ширины                              одинаковые ширины (grid)

slides inline markers                       slides inline markers
  * CRM-DATA      │ text…                     * CRM-DATA       │ text…
  * CRM-SALES     │ text…                     * CRM-SALES      │ text…
  * МАРКЕТИНГОВЫ  │ text…  ← разный X         * МАРКЕТИНГОВЫ   │ text…  ← один X
                                              fixed-width column

slides spacing (period band → chips)        slides spacing
  ~80px (empty toolbar div + space-y-5)       ~24px (matches edit-mode)
```

Execution flow:

```text
[1 sdlc-pipeline] → [2 stage-chip] → [3 slide-product-chips]
                                          ↓
[6 tests + snapshot] ← [5 status-slide-deck spacing] ← [4 lead-unified-slide]
```

От человека: **ничего на этой фазе** — все правки агент делает сам, тесты
гоняет сам, snapshot обновляет сам, smoke через chrome-devtools MCP сам.
Решение пользователя зафиксировано в Open Questions ниже.

## Architecture context

```text
LeadForm (lead/lead-form.tsx)
  ├─ <form class="space-y-6">  ← 24px ritm
  │   ├─ Period band  (May 18–24, 2026 · Show archived · Fill · v2 · Save)
  │   └─ isSlidesMode? LeadSlidesClient : <AccordionSection…>
  │
  │   edit-mode path:
  │     AccordionSection "Pipeline"
  │       └─ SdlcPipeline (sdlc-pipeline.tsx)
  │           ├─ chips row [StageChip…]            ← правка #2 (lock icon)
  │           └─ ┌─ Other contributors panel ─┐   ← правка #1 (удалить)
  │                255–347 в файле
  │
  │   slides-mode path:
  │     LeadSlidesClient → StatusSlideDeck → LeadSlideArticle
  │       ├─ toolbar wrapper (empty for inReportMode) ← правка #5
  │       └─ <article slide-frame p-6>
  │           └─ <div space-y-5>
  │               ├─ LeadSlideHero (status, lead, metrics)
  │               ├─ SlideProductChips (chips row)    ← правка #3
  │               └─ LeadUnifiedSlide
  │                   └─ <ul> с inlineProductMarker   ← правка #4
```

## Review state

- Существующий план `.planning/plans/page-feedback-lead-report-a0000000-0000-shiny-eagle.md`
  закрыт фазами W11/W12/W13/W14 (см. memory P83, P84, P85, P87). Этот план —
  отдельный новый раунд фидбека поверх той же ветки.
- Inline review-комментариев в MR пока нет (ветка `fix/PRJ-2/shiny-eagle`
  локальная).
- Связанная UAT-запись `S17` (design review smoke W13) и `S19` (W14 shipped)
  — этот раунд продолжает ту же линию визуальных доводок.

## Стратегия выполнения

- **Cheap-first delegation**: разведка уже выполнена двумя параллельными
  Explore-агентами (см. логи сессии). Дальнейшие правки делаются Sonnet/Opus
  непосредственно — это targeted edits, синтез не нужен.
- **Parallel waves**:
  - Wave A (правки #1 + #2): edit-mode pipeline + stage-chip — параллельно
    (один tool-use block, два Edit). Файлы независимые.
  - Wave B (правки #3 + #4): slides chips + inline markers — параллельно
    (один tool-use block, два Edit). Файлы независимые.
  - Wave C (правки #5 + tests): status-slide-deck spacing + npm test +
    snapshot refresh — параллельно где можно.
- **Subagent split**: не требуется. Изменения <50 LoC на файл, локальные,
  без unknown territory.

## От человека

```text
─────────────────────────────────────
✓ Я ДЕЛАЮ САМ (тебе ничего не нужно)
─────────────────────────────────────
  ├── edit-mode: удалить Other contributors panel
  ├── edit-mode: lock icon на StageChip locked
  ├── slides: grid auto-cols-fr на верхние чипы
  ├── slides: fixed-width column на inline markers
  ├── slides: пропустить empty toolbar wrapper
  ├── pnpm typecheck + pnpm test
  ├── snapshot refresh (lead-form-viewmode)
  ├── smoke через chrome-devtools MCP
  └── commit + push

─────────────────────────────────────
▲ ОТ ТЕБЯ
─────────────────────────────────────
  (ничего на этой фазе — иди занимайся своим)
```

## Open questions

| #   | Вопрос                                                          | Как решу автономно                                                            | Когда эскалирую                                  |
| --- | --------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | Удалять Other contributors?                                     | Решено: удалить, перенести в tooltip (ответ пользователя)                     | если smoke покажет потерю данных                 |
| 2   | Lock icon: lucide-react vs emoji 🔒?                            | lucide-react (консистентность с остальным app)                                | если a11y тест упадёт                            |
| 3   | Ширина inline-marker column?                                    | `w-[110px]` (вмещает «CRM-Sales Hub», «Маркетинг.»)                           | если не вместится → `w-[120px]`                  |
| 4   | Truncate стратегия в маркере?                                   | оставить текущий `.slice(0, 12)` + `title=` (рендер быстрый, нет JS overhead) | если ширина колонки увеличена > 12 chars влезает |
| 5   | Tooltip на locked chip: shadcn Tooltip или SdlcTooltipProvider? | расширить SdlcTooltipProvider до ReactNode (минимальный диф vs существующее)  | если структура контента сложнее, чем 2-3 строки  |

## Files to modify

### 1. `apps/web/src/components/lead/sdlc-pipeline.tsx`

- Удалить блок Other contributors (строки 255–347 включительно).
- Передать в каждый `<StageChip>` новый проп `crossAuthorInfo?: { author: string; itemCount: number; riskCount: number }` для locked-этапов.
- Источник данных: тот же `crossAuthors` массив, который сейчас рендерится в удаляемой панели (см. lines 254 и далее).

### 2. `apps/web/src/components/lead/stage-chip.tsx`

- Строка ~124: убрать `"opacity-35 cursor-not-allowed grayscale-[0.5]"`, оставить `"cursor-not-allowed"` (только cursor cue).
- Импорт `import { Lock } from "lucide-react"`.
- В `<button>` (строка ~203): когда `isLocked`, рендерить `<Lock className="h-3 w-3 opacity-60" aria-hidden="true" />` рядом с config.icon или вместо него.
- Расширить tooltip content: использовать новый проп `crossAuthorInfo` для строки `${assignee} · ${itemCount} items · ${riskCount} risks · No edit permissions`.

### 3. `apps/web/src/components/slides/slide-product-chips.tsx`

- Контейнер строка 42–46: заменить `flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1` на `grid grid-flow-col auto-cols-fr gap-2`.
- Кнопка-чип строка 57–62: убрать `shrink-0`, добавить `min-w-0` чтобы CSS truncate работал, добавить `truncate` на label `<span>` внутри.
- Сохранить `title={product.productName}` (full name в hover).

### 4. `apps/web/src/components/slides/lead-unified-slide.tsx`

- Функция `inlineProductMarker` (строки 19–34): обернуть в `<span>` фиксированной ширины (`w-[110px] shrink-0`), внутри сохранить текущий точка-маркер + укороченное имя.
- Опционально: заменить `.slice(0, 12)` на класс `truncate` если новая ширина колонки требует CSS-обрезки.
- Row `<li>` (строка ~65): оставить `flex items-baseline gap-2`, но теперь border-l-2 будет всегда на одной X-координате (потому что marker w-[110px] фиксирован).

### 5. `apps/web/src/components/slides/status-slide-deck.tsx` + `lead-slides-client.tsx`

- `lead-slides-client.tsx` строки 269–283: возвращать `undefined` (не пустой `<div>`) когда `inReportMode === true` и оба inner condition false (LeadScopeToggle null + SlideFullscreenButton null).
- ALT: `status-slide-deck.tsx` строка 362: изменить `toolbar ? <div>{toolbar}</div> : null` на проверку content — если toolbar — это `<div>` без children, не рендерить.
- Предпочтительный вариант: первый (источник правды — clean prop).

### 6. Tests

- `apps/web/src/components/lead/lead-form-viewmode.snapshot.test.tsx`: возможен diff snapshot — обновить через `pnpm test -- -u`.
- Опционально: новый `apps/web/src/components/slides/lead-unified-slide.test.tsx` с проверкой что все inline-маркеры имеют одинаковую ширину (через `getBoundingClientRect` в JSDOM не работает; альтернатива — проверка class `w-[110px]` на каждом маркере).
- Опционально: новый `apps/web/src/components/lead/stage-chip.test.tsx` для проверки `<Lock>` icon при `isLocked`.

## Verification

```bash
# (a) Типы и линт
pnpm typecheck
pnpm lint

# (b) Юнит-тесты
pnpm test

# (c) Snapshot refresh если нужно
pnpm --filter @customreport/web test -- -u lead-form-viewmode

# (d) Markdown lint планового файла
pnpm lint:md

# (e) Smoke через chrome-devtools MCP:
#   - dev server: pnpm dev:watch (если не запущен)
#   - navigate /lead/report/a0000000-0000-4000-8000-000000000001
#   - проверить edit-mode: hover на чужом StageChip → tooltip с владельцем
#   - проверить отсутствие Other contributors панели
#   - navigate /lead/report/a0000000-0000-4000-8000-000000000001?mode=slides
#   - take_screenshot: все верхние chips одной ширины
#   - take_screenshot: все вертикальные разделители inline-маркеров на одной X-вертикали
#   - сравнить зазор period band → chips в обоих режимах

# (f) Build гейт (опционально)
pnpm build
```

## Side deliverables

- После approve: атомарные коммиты по wave (3 коммита: edit-mode, slides chips
  - markers, slides spacing + tests).
- Обновить `.planning/STATE.md` пометкой о twinkly-milner раунде фидбека.
- Сохранить screenshot evidence в `.planning/screenshots/W15_*.png`.
- Memory entry после wave C: `project_twinkly_milner_2026_05_20.md` — закрыть
  раунд с before/after скриншотами.
