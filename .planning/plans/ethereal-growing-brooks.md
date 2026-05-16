# UI Feedback Capture — lead/report

## Context

Сессия живого UI-аудита по ветке `fix/PRJ-2/uat-v7-2026-05-12`. Пользователь
открыл `/lead/report/a0000000-0000-4000-8000-000000000001` в локальном
`http://localhost:3000` и кидает аннотации через page-annotator MCP. Цель —
собрать список замечаний, привязать каждое к конкретному файлу/строке в
`apps/web/src`, а после остановки сбора преобразовать в план правок.

Режим: «аудит сначала, потом ты добавляешь» → user взял инициативу и сам
дёргает аннотатор. Поэтому план = живой журнал замечаний + маппинг на код.
Реализация — отдельным шагом, после ExitPlanMode.

```
[user annotator] → [этот plan-файл] → [PLAN.md фикс-фаза] → [реализация]
       ▲                                                          │
       └──────── ещё фидбэк ──────────────────────────────────────┘
```

## Architecture context (область lead-report)

Главный экран — `apps/web/src/app/(app)/lead/report/[reportId]/page.tsx`,
рендерит `<LeadForm/>` из `apps/web/src/components/lead/lead-form.tsx`.
Внутри формы:

- header-полоса с действиями (Toggle All / Edit / Slides / Submit / Reopen)
- toolbar с навигатором периода (`period-navigator.tsx`) + `fill-from-button`
  - `version-history-nav`
- секции через `AccordionSection`, одна из которых — «Аналитический хаб» с
  пайплайном `sdlc-pipeline.tsx`
- секции `current-week-section`, `next-week-section`, `priorities-section`,
  `risks-section`, `decisions-section`

UI-строки английские (правило репо). Тёмная тема — research-only, не трогаем.

## Captured feedback (live)

### F1 — toolbar периода слишком мелкий

- **Время:** 2026-05-16T21:07:17Z
- **DOM:** `form.space-y-6 > div.flex` (1088×48px, `gap-1.5`, `px-2 py-1.5`,
  `bg-white/75`, `rounded-[var(--radius)]`, `border rgba(0,0,0,0.08)`)
- **Контекст:** «May 11–17, 2026 / Fill / v2» — полоса навигации периода +
  Fill-from + версия снапшота.
- **Real source:** скорее всего `apps/web/src/components/lead/period-navigator.tsx`
  - соседние `fill-from-button.tsx`, `version-history-nav.tsx` (атрибуция
    «sdlc-tooltip.tsx:61:72» — это `SdlcTooltipProvider` сверху, нерелевантна).
- **Фидбэк:** «давай тут не так мельчить».
- **Интерпретация:** увеличить высоту/паддинги полосы и сами контролы. 48px
  визуально маленький для toolbar на 1088px ширины; шрифт 14px+ внутри,
  `gap-1.5` → `gap-2/3`, `py-1.5 → py-2/3`, кнопки на `min-h-[var(--touch-target-min)]`
  (44px), пересмотр иерархии: период — крупнее, Fill / v2 — вторичные.
- **Открытое:** уточнить — увеличиваем ВСЁ или только период (как primary)?

### F2 — SDLC pipeline выровнять по центру

- **Время:** 2026-05-16T21:07:43Z
- **DOM:** контейнер `flex flex-wrap items-center gap-2 pb-1` (1012×60px) внутри
  секции «Аналитический хаб» (`AccordionSection > SdlcPipeline`).
- **Real source:** `apps/web/src/components/lead/sdlc-pipeline.tsx:26` —
  корневой ряд этапов пайплайна.
- **Фидбэк:** «давай выровни по середине».
- **Интерпретация:** добавить `justify-center` к flex-ряду (сейчас items
  висят слева). Контейнер 1012px, элементы занимают ~half — центровка
  имеет визуальный смысл.
- **Риск:** если этапы при `flex-wrap` ломаются на 2 строки на узких
  вьюпортах — `justify-center` норм для обеих строк, побочки нет.

### F3 — объединить Submit / Request Reopen в один state-зависимый контрол

- **Время:** 2026-05-16T21:08:36Z
- **DOM:** `header.flex > div.flex > button.btn-press` — выделены 3 кнопки:
  «Request Reopen», «Submit Report», «Product Status2 assigned» (status-чип).
  Рядом: «Toggle All», «Edit», «Slides».
- **Real source:** `apps/web/src/components/lead/lead-form.tsx` — header
  формы с action-кнопками; `request-reopen-dialog.tsx` за «Request Reopen».
- **Фидбэк (расшифровка с опечатками):**
  - «думаю нужно объединить как тогл»
  - «когда форма ушла — выводить Submit» (вероятно: когда отчёт ОТПРАВЛЕН →
    показывать обратную операцию)
  - «когда draft — то показывать Submit».
- **Интерпретация:**

  ```
  state = draft       → [Submit Report]      (Request Reopen скрыт)
  state = submitted   → [Request Reopen]     (Submit скрыт)
  ```

  Сейчас, видимо, рендерятся обе одновременно — нужно сделать один контрол,
  зависящий от статуса отчёта. «Product Status2 assigned» — это статусный чип,
  трогать его не нужно, он попал в выделение случайно.

- **Открытое:** на стороне head/admin (когда смотрит чужой отчёт) — какой
  набор показывать? Сегодня там Approve/Lock/Unlock — это уже отдельная
  ветка логики, она вне F3.

### F4 — ОТМЕНЕНО

~~Перенос stage-chip в верхний правый угол~~ — пользователь отменил в
сообщении 2026-05-16T21:11+. Замена — F4' ниже.

### F4' — переосмыслить стиль stage-chip + убрать дубль после имени автора

- **Время:** 2026-05-16T21:11+Z
- **Фидбэк (расшифровка):**
  - «надо подумать, как лучше изобразить»
  - «может сделать тонкими — тогда они сократятся?»
  - «и заодно убрать из секции, после имени автора лида (D, Василий)»
  - «то есть лучше переделать»
  - «отменить запрос на верхний правый угол»
- **Интерпретация (две подзадачи):**

  **F4'a — visual rework chip:** оставить позицию, но сделать чип
  визуально тоньше. Варианты:
  - заменить pill-фон на «outline»: убрать `bg-[var(--color-success)]`,
    оставить тонкую рамку `border border-[var(--color-primary)]/40` +
    текст основного цвета — занимает меньше визуального веса
  - либо «text-only with dot»: точка-маркер + название стадии без фона
    (`text-[10px] text-[var(--color-primary)]` + `•` префикс)
  - либо сокращение лейбла: 1-2 буквы аббревиатура («An» вместо «Analysis»,
    «Dev» вместо «Development»), полное имя — в title/tooltip
  - **рекомендую:** outline-вариант — сохраняет читаемость, убирает
    «таблеточный» вес, не ломает scan-pattern. ← рекомендую

  **F4'b — убрать дубль stage-chip рядом с именем автора:** где-то в layout
  карточки рендерится stage рядом с «D Василий» (имя/инициал автора лида).
  Нужно найти этот рендер и удалить — оставить chip только в одном месте
  на карточке.

- **Real sources (для F4'a):**
  - `apps/web/src/components/lead/item-card.tsx:118`
  - `apps/web/src/components/lead/risks-section.tsx:104`
  - `apps/web/src/components/lead/decisions-section.tsx:123`
- **Real sources (для F4'b):** нужно найти место рендера автора лида.
  Кандидаты — `item-card.tsx`, либо общий `stage-chip.tsx`, либо рядом с
  `lead-history-list.tsx`. Проверить на этапе реализации через grep
  `Василий` или role-аватара лида.
- **Открытое (Q4 переформулирован):**
  - Q4a: какой из трёх визуальных вариантов берём? (рекомендую outline)
  - Q4b: подтверди, что дубль chip после имени автора нужно удалить во
    ВСЕХ местах, не только в одной секции

### F5 — унифицировать мета-строку «автор + стадия» в Risks / Decisions / Priorities

- **Время:** 2026-05-16T21:12:40Z (2 аннотации, общая идея)
- **Фидбэк (расшифровка):**
  - на Risks: «здесь нужен автор, и тоже как на недельной секции —
    [позиция/раскладка]» — сейчас в строке только stage-chip (`justify-end`),
    автора нет
  - на Decisions: «и сюда [добавь] чипы стадий» — у Decisions сейчас
    есть «Owner: Василий И.», но нет stage-chip в этой же строке
- **DOM:**
  - Risks: `div.mt-3 flex justify-end` 1012×19px, содержит только chip
  - Decisions: `div.mt-0.5 break-words text-muted-foreground` рядом с
    label «Owner» → «Василий И.» (502×20px)
- **Real sources:**
  - `apps/web/src/components/lead/risks-section.tsx:104`
  - `apps/web/src/components/lead/decisions-section.tsx:123`
- **Интерпретация:** во всех типах карточек (items / risks / decisions)
  должен быть единый паттерн мета-строки:

  ```
  [author-name]  ……………………  [stage-chip]
  ```

  Сейчас:
  - items (current/next week): автор + chip есть → reference
  - risks: chip есть, автор отсутствует → **добавить автора слева**
  - decisions: «Owner: Василий И.» есть отдельной строкой, chip
    есть в шапке → **свести в одну строку**, оставить один chip

- **Связка с F4':** F5 и F4'b пересекаются — «убрать дубль chip после
  имени автора» относится к Decisions (там сейчас chip в одном месте,
  Owner в другом → если объединить в одну строку, дубля не будет).
  Раскладка должна быть согласована: один chip per card, в общей
  мета-строке с автором.
- **Открытое:** Q5 — выводить автора в Risks через ту же модель
  данных, что и в items (`assignee` / `ownerName`)? Нужно проверить
  Zod-схему risk-entry в `packages/shared` — есть ли там автор.

### F6 — Priorities: добавить мета-строку «автор + стадия» (в составе F5)

- **Время:** 2026-05-16T21:13:21Z
- **DOM:** `div.flex.items-center.gap-3.rounded-lg.p-4` 1046×105px,
  содержит «1 / Маркетинговый портал / Analysis / Закрыть OAuth2…»
- **Real source:** `apps/web/src/components/lead/priorities-section.tsx:203`
- **Фидбэк (расшифровка):**
  - «и тут этапы и автора» — нужны и stage-chip, и автор
  - «так как мы по идее можем видеть разные приоритеты по стадиям,
    которых у нас сейчас нет» — стадия как визуальный признак на
    приоритетах сейчас не выделена; видно «Analysis» как inline-текст,
    но как полноценный chip-маркер — отсутствует
- **Интерпретация:** включить Priorities в F5. Тот же унифицированный
  паттерн `[author] …… [stage-chip]` в мета-строке карточки приоритета.
  «Analysis» из inline-текста перенести в outline-chip (по решению F4'a).
- **Side-effect:** если в priority-data модели стадия записана как
  свободная строка внутри title — нужно поднять её в отдельное поле.
  Проверить `packages/shared` (priority schema).

### F7 — slides mode как in-page toggle, без перезагрузки

- **Время:** 2026-05-16T21:15:10Z (2 связанные аннотации)
- **Фидбэк (расшифровка):**
  - на AccordionSection: «режим слайдов — это почти точно такая же
    секция, но с другим содержимым (слайдом)»
  - на header (My Report + Toggle All + Edit + Slides …): «поэтому
    верхние элементы остаются, и желательно переключение без
    перезагрузки, а через скрытие элементов»
- **DOM/Source:**
  - section card: `apps/web/src/components/lead/lead-form.tsx:518`
    (AccordionSection — карточный контейнер 1088×86px)
  - header формы: тот же `lead-form.tsx` (h1 «My Report» + кнопки)
- **Интерпретация:** сейчас «Slides» — отдельный route
  (`apps/web/src/app/(app)/lead/slides/page.tsx`) и/или query
  (`?mode=slides` на `/lead/report/[id]`). User хочет, чтобы:
  - переключение **не** уводило со страницы и не дёргало SSR
  - header формы (`My Report` + actions) **оставался** виден сверху
  - контент-зона ниже header'а просто переключалась между
    «accordion sections» и «slide deck» через client-side state
    (`useState`) с `aria-hidden` / условным рендером
- **Возможная реализация:**
  - в `lead-form.tsx` ввести client state `viewMode: 'form' | 'slides'`
  - кнопка «Slides» в header переключает state, а не навигирует
  - `lead-slides-client.tsx` (или его внутренности) рендерится в той
    же позиции, что и AccordionSection-список
  - URL может синхронизироваться через `router.replace('?mode=slides',
{scroll:false})` чтобы deep-link работал, но без жёсткого
    `<Link/>` перехода
- **Открытое (Q6):**
  - Q6a: оставлять ли отдельный route `/lead/slides` для deep-link
    из nav, или редиректить его на `/lead/report/[current]?mode=slides`?
  - Q6b: на `present`-странице (`report/[id]/present/page.tsx`) та же
    логика, или present — это отдельный full-screen режим вне scope?

## Mapping → files

```
F1  apps/web/src/components/lead/period-navigator.tsx          размер toolbar
    apps/web/src/components/lead/fill-from-button.tsx          вторичный
    apps/web/src/components/lead/version-history-nav.tsx       вторичный
    apps/web/src/components/lead/lead-form.tsx                 wrapper-классы

F2  apps/web/src/components/lead/sdlc-pipeline.tsx:26          justify-center

F3  apps/web/src/components/lead/lead-form.tsx                 header buttons
    apps/web/src/components/lead/request-reopen-dialog.tsx     поведение
    packages/shared (status enum)                              источник state

F4  ОТМЕНЕНО

F4' apps/web/src/components/lead/item-card.tsx:118             outline chip
    apps/web/src/components/lead/risks-section.tsx:104         outline chip
    apps/web/src/components/lead/decisions-section.tsx:123     outline chip
    (+ найти дубль chip рядом с именем автора и удалить)

F5  apps/web/src/components/lead/risks-section.tsx:104         + автор слева
    apps/web/src/components/lead/decisions-section.tsx:123     свести Owner+chip
    apps/web/src/components/lead/priorities-section.tsx:203    + автор + chip
    packages/shared (risk/priority schema)                     проверить поля

F7  apps/web/src/components/lead/lead-form.tsx:518             viewMode state
    apps/web/src/components/slides/lead-slides-client.tsx      встроить в форму
    apps/web/src/app/(app)/lead/slides/page.tsx                редирект/deep-link
```

## Mode

**Сейчас:** продолжаем capture. План пополняется по мере поступления новых
аннотаций. Реализация и `ExitPlanMode` — после явного «всё, накидал, поехали».

## Open questions

| #   | вопрос                                                                         | как решу автономно                                                                   | когда эскалирую                                             |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Q1  | F1: увеличить весь toolbar или только период как primary?                      | начну с равномерного увеличения паддингов + min-h 44px на контролах                  | если пользователь хочет иерархию primary/secondary — спрошу |
| Q2  | F3: как называется enum статуса отчёта (`draft` / `submitted` / `locked` / …)? | читаю `packages/shared` и `prisma/schema.prisma`, мапплю на текущее условие в header | если в коде нет явного перехода — спрошу                    |
| Q3  | F3: что показывать head/admin на чужом отчёте?                                 | не трогаю в F3, считаю out-of-scope                                                  | если user уточнит — добавлю                                 |
| Q4  | F4: унифицировать размер chip между items/risks/decisions?                     | приведу к одному варианту (text-[11px], px-2 py-0.5) для согласованности             | если user скажет «не трогай размеры» — оставлю как есть     |

## От человека

```
─────────────────────────────────────
▲ ОТ ТЕБЯ (live capture)
─────────────────────────────────────
  ├── продолжай кидать аннотации        ← если есть ещё
  ├── скажи «всё, поехали» когда хватит ← переходим к плану реализации
  └── ответь на Q1/Q3 если хочешь зафиксировать сразу

─────────────────────────────────────
✓ Я ДЕЛАЮ САМ (после твоего «поехали»)
─────────────────────────────────────
  ├── читаю реальные строки в period-navigator / sdlc-pipeline / lead-form
  ├── собираю PLAN.md с конкретными правками (diff-уровень)
  ├── гоню pnpm typecheck + lint + targeted Playwright spec
  └── коммичу атомарно: F1 → F2 → F3 (или объединяю по review)
```

## Verification (после реализации)

```bash
pnpm --filter @customreport/web dev                       # визуальная проверка
pnpm --filter @customreport/web typecheck
pnpm lint
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts \
  -g "lead-form"
```

Сценарии для глаз:

```
#   (a) /lead/report/<id> в состоянии draft  → виден Submit, нет Reopen
#   (b) /lead/report/<id> после Submit       → виден Request Reopen, нет Submit
#   (c) toolbar периода — крупнее, читается на 1728px и не ломается на 1280px
#   (d) SDLC pipeline — этапы по центру внутри «Аналитический хаб»
```
