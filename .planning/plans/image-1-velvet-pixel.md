# Slides mode — read-only обзор и общий presenter

## Context

На скриншоте `review-slides-mode.png` режим **Slides** выглядит как обычная
форма редактирования: три навигатора стоят подряд (неделя / версия / период
слайдов), Submit/Reopen-chrome тянется в режим просмотра, «слайд» визуально
неотличим от карточки edit-режима, а карусель `1/N` мертва, потому что
`buildSectionSlideModel` всегда строит ровно одну модель.

Пользователь выбрал направление: **Slides = чистый read-only обзор всех
продуктов сразу** (не fullscreen-презентация, не executive summary), со
скоупом «Lead + выравнивание с Head» и приоритетом скрыть лишние навигаторы.

**Ключевое уточнение от пользователя:** в рамках одного лида ВСЕ его
продукты живут на ОДНОМ слайде. Никакой product-навигации `◀ 1/2 ▶`
внутри лида — всё видно сразу вертикальной прокруткой. Карусель/keyboard
nav остаётся только у Head (где есть несколько лидов), Lead — один длинный
read-only article.

Цель — компактный нередактируемый layout с единым header-компонентом для
визуальной консистентности Lead и Head, но без навязанного shell-каркаса
для Lead.

## TLDR

### Было / Стало

```
БЫЛО — Slides активен                          СТАЛО — Slides read-only
┌─────────────────────────────────────┐        ┌─────────────────────────────────────┐
│ My Report  ✓ Submitted  ToggleAll   │        │ Slides · Week May 11-17 · v2        │
│ [Edit][Slides] [Request Reopen]     │        │ Василий И. ✓ Submitted    [↩ Edit] │
│                                     │        ├─────────────────────────────────────┤
│ ◀ May 11-17 ▶ [ ] Fill ◀ v2 ▶      │ ← дубль │ ▌ Аналитический хаб ● Blocked      │
│                                     │        │   SDLC · Analysis Design Dev       │
│ ┌─ [Edit][Slides] ◀ May 11-17 ▶ ──┐ │ ← дубль│   CURRENT       NEXT FOCUS         │
│ │ Аналитический хаб 100%          │ │        │   Подключили... Раскатка...        │
│ │ ... edit-style card ...         │ │        │   RISKS         PRIORITIES         │
│ └─────────────────────────────────┘ │        │   Memory leak.. —                  │
└─────────────────────────────────────┘        │                                    │
                                               │ ▌ Маркетинговый портал ● At-Risk   │
                                               │   SDLC · Planning Analysis Design  │
                                               │   CURRENT       NEXT FOCUS         │
                                               │   ...           Интеграция SSO...  │
                                               │   RISKS         PRIORITIES         │
                                               │   OAuth2 quota..  Закрыть OAuth..  │
                                               └─────────────────────────────────────┘
        (один длинный article: все продукты Василия И. на одном слайде)
```

### Проблемы → решения

- **Тройная навигация** (PeriodNavigator + VersionHistoryNav + SlidePeriodToolbar)
  → в режиме Slides скрываем неделя/архив/fill/версия toolbar и внутренний
  SlidePeriodToolbar, период и версия уезжают в подзаголовок слайдов.
- **Дубль Edit/Slides pill** (`lead-form.tsx:1361,1377` и
  `lead-slides-client.tsx:96-118`) → оставляем только один Edit-link в шапке
  слайдов («↩ Edit»), второй pill удаляем.
- **Submit/Reopen-chrome тянется в Slides** → гейтим под `!isSlidesMode`
  Submitted badge, Toggle All, Submit, Request Reopen, Revoke. Submitted-метка
  переезжает в шапку слайдов как тонкий status pill.
- **«Слайд» = edit-карточка** (`LeadSlideArticle` градиент + min-h-[680px]) →
  плоская read-only поверхность на `--color-card`, без min-height, без
  тяжёлого градиента. Все продукты лида рендерятся вертикальным списком
  внутри одного `<article>` — естественный scroll, без якорной навигации.
- **Карусель `1/N` мертва** (`slides.length === 1`) → счётчик и
  prev/next-кнопки для Lead **полностью удаляются**. Один лид = один слайд.
  Карусель остаётся релевантной только для Head (multiple leads); там она и
  была — оставляем как есть.
- **Lead и Head не делят header-компонент** → новый `SlideHeader` (только
  заголовок: title + period/version meta + status pill + exit-link, БЕЗ
  навигационной обвязки). Lead использует только `SlideHeader`, Head
  использует `SlideHeader` + СВОЮ существующую keyboard-логику для перехода
  между лидами. `head-present-client.tsx` переезжает на `SlideHeader`
  визуально, поведенческий контракт (←/→/J/K/F + counter) сохраняется один к
  одному.

### Execution flow

```
[step 1] gate chrome in lead-form.tsx        ─┐
[step 2] simplify SlidePeriodToolbar         ─┼─ parallel (3 файла)
[step 3] flatten LeadSlideArticle (no anchors)┘
                                              │
                                              ▼
[step 4] extract SlideHeader     ──►  [step 5] use SlideHeader in lead-slides-client.tsx
                                              │
                                              ▼
                                       [step 6] adopt SlideHeader in head-present-client.tsx (visual only)
                                              │
                                              ▼
[step 7] Playwright spec + screenshot  ──►  [step 8] pnpm typecheck/lint/test
```

### От человека (one-liner)

Решения зафиксированы: read-only обзор, скоуп Lead + выравнивание с Head,
скрыть неделю и версию. Дальше всё я делаю сам; человек подключается только
к финальному визуальному sign-off (см. блок `▲ ОТ ТЕБЯ` ниже).

## Architecture context

```
URL  /lead/report/<id>?mode=slides
      │
      ▼
lead-form.tsx  (isSlidesMode = mode === "slides")
      │
      ├── header (My Report / Submitted / Toggle All / Edit·Slides toggle / Submit·Reopen)
      │       └── СТАЛО: в Slides рендерится только slide-header (Edit↩ + status + counter)
      │
      ├── toolbar (PeriodNavigator + Archive + FillFromButton + VersionHistoryNav)
      │       └── СТАЛО: скрыт в isSlidesMode
      │
      └── isSlidesMode ? <LeadSlidesClient chrome="content" /> : <LeadFormSyncBridge>...</...>
                            │
                            ▼
                       LeadSlidesClient
                            │
                            ├── SlidePeriodToolbar  ── СТАЛО: удалён
                            │
                            ├── <SlideHeader title="..." statusBadge=... exitHref=... />  (NEW)
                            │
                            └── <StatusSlideDeck mode="lead" />
                                     │
                                     └── <LeadSlideArticle>  ── СТАЛО: плоская поверхность; все продукты вертикально
                                              │
                                              └── ProductSdlcGroups → один длинный список секций

Shared (visual-only):
  apps/web/src/components/slides/slide-header.tsx   (NEW)
       ├── title (`<Lead>'s status` / `Week <range>` / `vN`)
       ├── optional status pill (Submitted / In progress)
       ├── exit-link «↩ Edit»
       └── consumed by:
           ├── lead-slides-client.tsx   — только header
           └── head-present-client.tsx — header + СВОЯ keyboard/counter/F-logic остаётся как есть
```

Данные: tRPC `leadForm.byPeriod` остаётся как есть. `buildSectionSlideModel`
не меняем — внутри одной section-модели уже есть массив `productSlides`,
этого достаточно для product-anchor навигации.

## Review state

MR/PR-ветка ещё не открыта для этой работы. Текущая рабочая ветка —
`fix/PRJ-2/uat-v7-2026-05-12` (PRJ-2/UAT v7); change touches frontend-only,
никаких миграций или API-изменений.

Dirty-файлы в репо (`.planning/plans/ethereal-growing-brooks.md`,
`session-retros/NEXT-ACTIONS.md`, screenshots в корне) трогать не буду —
правило CLAUDE.md: «не нормализуй несвязанные dirty-файлы».

## Стратегия выполнения

### Cheap-first delegation

- **Haiku** — Playwright snapshot после изменений, проверка что Submit/Reopen
  не рендерятся в slides, что counter показывает правильное `k/N`. Чтение
  диффа shadcn primitives. Sweeps по тестам.
- **Sonnet (главная нить)** — извлечение `PresenterShell`, миграция
  `head-present-client.tsx`, гейтинг chrome в `lead-form.tsx`, написание тестов.
- **Opus** — не нужен; задача механическая, без архитектурных развилок.

### Parallel waves

- **Волна 1** (3 файла одновременно, не зависят друг от друга):
  - `lead-form.tsx` — гейт chrome.
  - `lead-slides-client.tsx` — упростить toolbar, удалить дубль Edit/Slides pill.
  - `status-slide-deck.tsx` — flatten `LeadSlideArticle`, добавить anchors.
- **Волна 2** (последовательно — ждёт волну 1):
  - Создать `slide-header.tsx` (visual only, без navigation).
  - Подключить `SlideHeader` в `lead-slides-client.tsx`.
  - Подключить `SlideHeader` в `head-present-client.tsx` (визуально), keyboard
    logic не трогаем — она уже работает.
- **Волна 3** — Playwright spec и `pnpm typecheck && pnpm lint && pnpm test`.

### Subagent split

- **Agent A (Sonnet)** — волна 1 + волна 2 (главный исполнитель, код-правки).
- **Agent B (Haiku)** — волна 3: написать Playwright-spec под
  `apps/web/e2e/regression/`, прогнать `--update-snapshots`, отчитаться о
  любых regression в head's `/present` (главный риск миграции).
- **Agent C (Haiku)** — финальный визуальный сравнительный отчёт: до/после
  скриншот `review-slides-mode.png`, проверка по списку «6 проблем выше».

## От человека

```
─────────────────────────────────────
▲ ОТ ТЕБЯ
─────────────────────────────────────
  ├── Финальный визуальный sign-off на новом read-only слайде         ← когда я отдам новый review-slides-mode.png
  └── (опционально) подтверждение, что Head's /present не сломан      ← покажу скриншот перед коммитом
```

Всё остальное — я делаю сам: гейт chrome, рефактор toolbar, извлечение
shell, миграция head, Playwright spec, typecheck/lint/test, коммит.

## Open questions

| #   | Вопрос                               | Как решу автономно                                                                                                                                                                                                                                                         | Когда эскалирую                                                         |
| --- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Нужен ли F/fullscreen в Lead slides? | Делаю **без F** — read-only обзор, не презентация. Head оставляет F (он работал и работает).                                                                                                                                                                               | Если пользователь захочет F и в Lead — добавлю одной строкой.           |
| 2   | Архив-чекбокс куда?                  | Прячу в Slides (период выбирается через переход из Edit).                                                                                                                                                                                                                  | Если пользователь хочет архив-чекбокс в Slides — добавлю в SlideHeader. |
| 3   | Нужна ли product-навигация в Lead?   | **Нет** — пользователь зафиксировал: «всё на одном слайде в рамках 1 лида». Все продукты лида вертикально внутри одного `<article>`, scroll работает естественно. Counter `1/N` и prev/next-кнопки для Lead удаляются. Карусель остаётся только для Head (multiple leads). | — (направление зафиксировано)                                           |

## Files to modify

| Файл                                                    | Тип     | Что делаю                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/src/components/lead/lead-form.tsx`            | edit    | Строки 1335–1432: гейт `Submitted` badge, Toggle All, Submit/Reopen/Revoke под `!isSlidesMode`. Строки 1436–1469: скрыть весь toolbar под `!isSlidesMode`. Строки 1361–1396: один Edit/Slides pill только в edit-режиме; в slides-режиме `SlideHeader` рендерит «↩ Edit».                                                                  |
| `apps/web/src/components/slides/lead-slides-client.tsx` | edit    | Удалить дубль `SlidePeriodToolbar` (строки 48–171). `LeadSlidesClient` рендерит `<SlideHeader>` + `<StatusSlideDeck chrome="content">`.                                                                                                                                                                                                    |
| `apps/web/src/components/slides/status-slide-deck.tsx`  | edit    | `LeadSlideArticle` (415–449): убрать `min-h-[680px]`, заменить `bg-[linear-gradient(...)]` на `bg-[var(--color-card)]`, убрать тяжёлый shadow → `shadow-[0_1px_2px_rgba(0,0,0,0.05)]`. `LeadSlideChecksStrip` (390–408): прячем в Slides (не редактируемо — статус readiness не имеет смысла). Никаких product-anchors не добавляем.       |
| `apps/web/src/components/slides/slide-header.tsx`       | **NEW** | Shared header (visual only, без navigation logic): props `{ title, subtitle?, statusBadge?: { label, tone }, exitHref?, exitLabel? }`. Внутри: `<header>` с h1 (title), `<p>` (subtitle), правый край — status pill + `<Link>` «↩ Edit». Никаких useEffect, никакого keydown, никаких счётчиков — это просто визуальный header.            |
| `apps/web/src/components/head/head-present-client.tsx`  | edit    | Внутри текущей разметки заменить inline header (lines 110–149 — сейчас prev/next/counter в одном flex-блоке) на `<SlideHeader>` сверху + ОТДЕЛЬНЫЙ блок prev/next/counter/F остаётся как есть. Keyboard logic в useEffect (lines 79–96) сохраняется без изменений. Получаем визуальную консистентность с Lead без поведенческих изменений. |
| `apps/web/e2e/regression/lead-slides-read-only.spec.ts` | **NEW** | Spec: открыть `/lead/report/<id>?mode=slides`, проверить (a) нет PeriodNavigator/VersionHistoryNav, (b) нет Submit/Reopen, (c) нет prev/next/counter (один лид = один слайд), (d) все продукты лида видны на странице, (e) screenshot match.                                                                                               |

Reuse без изобретения нового:

- `--color-card`, `--color-success`, `--color-primary`, `--radius`,
  `--radius-pill` — токены из `packages/ui/src/styles/globals.css`.
- `toneClass`, `statusClass`, `productAccentClass` уже в
  `status-slide-deck.tsx` — переиспользую.
- shadcn `Badge`, `Button` из `packages/ui/src/components/ui/` для shell-header
  (если впишется без рисков; иначе оставляю текущий handcrafted markup, чтобы
  не расширять surgical scope).

## Verification

```bash
# 1. Статический анализ
pnpm typecheck
pnpm lint

# 2. Юнит/интеграция
pnpm --filter @customreport/web test status-slide-deck

# 3. Regression — критично, тут затронут head's /present
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts \
  --grep "head-present|lead-slides"

# 4. Сценарии вручную (Playwright headed для проверки UX)
#   (a) /lead/report/<id>           → edit-режим, все toolbars на месте
#   (b) /lead/report/<id>?mode=slides → read-only: нет недели/версии/Toggle All/Submit
#   (c) все продукты лида видны на одном слайде (вертикальный scroll)
#   (d) /head/report/<id>/present   → F работает, ←/→ работает, поведение не сломано
#       (SlideHeader появился сверху, но keyboard/counter работают как раньше)
#   (e) lint:md на изменённых .planning/**
pnpm lint:md
```

Доказательная база (что положу в PR-описание):

- Скриншот `review-slides-mode.png` до/после (старый уже в репо).
- Playwright snapshot новый.
- `git diff --stat` показывает 4 edit + 2 NEW + tests.

## Side deliverables

После approve плана:

- **memory** — записать в `.planning/memory/` факт что Lead и Head делят
  `SlideHeader` (визуальная консистентность), но НЕ делят navigation logic
  (это намеренно: один лид = один слайд, навигация только у Head).
- **CLAUDE.md / repo** — никаких правок не нужно; правила уже корректны.
- **rules/** — никаких новых durable правил из этой задачи не выводится
  (это разовый рефактор, не паттерн с повторами).

## Self-verify checklist

- [x] TLDR с before/after frame
- [x] Architecture context с data flow
- [x] Стратегия: cheap-first, parallel waves, subagent split
- [x] От человека — одно ASCII frame, явный список
- [x] Open questions — таблица с автономным решением
- [x] Files to modify — путь + конкретные строки + что меняется
- [x] Verification — bash + сценарии
- [x] Side deliverables — что вне сразу
- [x] Не введены новые цвета/фоны/градиенты (правило «Visual And Theme Work»)
- [x] Не вводится Director scope, не трогается dark mode (research-only)
- [x] UI-строки остаются English (правило репо)

---

## V2 Direction — Phase 61b (после визуального ревью 2026-05-17, оценка 2/10)

### Что пошло не так в V1

V1 (коммиты `fa36f1d` + `4b4ce55`) реализовал план буквально: добавил
отдельный `SlideHeader` компонент, скрыл chrome в edit-стороне. Визуально
получился **двойной заголовок**:

```
┌─────────────────────────────────────────────────────────┐
│ My Report                                                │  ← page <header>
│ Your report draft and status context.                    │     из lead-form.tsx
├─────────────────────────────────────────────────────────┤
│ Василий И.                            [Blocked]  [↩ Edit] │  ← наш SlideHeader (DUPE)
│ Period 20 - May 11-17, 2026 (Current)                    │
├─────────────────────────────────────────────────────────┤
│ ┌─ карточка продукта (sidebar + 2-col grid) ────────────┐│  ← edit-style layout
│ │ PRODUCT [Red]    │ CURRENT WORK   │ NEXT FOCUS       ││
│ │ Маркетинговый    │ ...            │ ...              ││
│ │ портал           │ RISKS          │ PRIORITIES       ││
│ │ SDLC: chips...   │ ...            │ ...              ││
│ │                  │ DECISIONS (full width)            ││
│ └────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Ответы пользователя на уточнения (2026-05-17)

| Вопрос                             | Ответ                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1. Прятать page-header в slides?   | «зачем скрывать» — **не прятать**. Один и тот же header, разный chrome/контент по mode.           |
| 2. Что не так с product-карточкой? | Оставить «всё на одном слайде», **переделать визуал под крупный slide-look** (presentation feel). |

### Новая модель: один header — разный chrome / контент

```
┌─ V2 — Slides mode ──────────────────────────────────────┐
│ My Report                                                │  ← page <header> остаётся,
│ Your report draft and status context.                    │     контент тот же
│                                                          │
│ Василий И. · Period 20 · May 11-17, 2026   [Blocked] [↩ Edit]
│           ↑ slim sub-row внутри того же <header>         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   ┌──── Slide-look product card ──────────────────────┐  │
│   │  МАРКЕТИНГОВЫЙ ПОРТАЛ                  Red ●      │  │  ← крупный заголовок,
│   │  Planning · Analysis · Design · Development ...   │  │     SDLC inline-text,
│   │                                                    │  │     не chips-кнопки
│   │  Current work                                      │  │
│   │  • Завершил рефакторинг модуля авторизации        │  │
│   │                                                    │  │
│   │  Next focus                                        │  │
│   │  • Запланировал ревью архитектуры с командой PEO  │  │
│   │                                                    │  │
│   │  Risks (1)         Priorities (3)                  │  │
│   │  ...               ...                             │  │
│   │                                                    │  │
│   │  Decisions (2)                                     │  │
│   │  ...                                               │  │
│   └────────────────────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Изменения относительно V1

| #   | Что                       | V1                                     | V2                                                                                            |
| --- | ------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | Page `<header>`           | Сохранён, но визуально дублируется     | **Сохранён, единственный заголовок**                                                          |
| 2   | `SlideHeader`             | Отдельный компонент сверху             | **Удалить** — функциональность вмерджить в page-header                                        |
| 3   | Lead-name + period        | В SlideHeader как title + subtitle     | Slim sub-row внутри page-`<header>` справа от title                                           |
| 4   | Status badge              | В SlideHeader справа                   | В sub-row рядом с lead-name                                                                   |
| 5   | ↩ Edit link               | В SlideHeader                          | В sub-row, рядом с status badge                                                               |
| 6   | Product card              | edit-style: PRODUCT label + SDLC chips | **slide-look**: крупный h2 продукта, SDLC inline-текстом, плотные секции, минимум edit-chrome |
| 7   | `head-present-client.tsx` | Использует SlideHeader                 | **Тоже удалить SlideHeader**, использовать собственный inline-header (как было до V1)         |

### Files to modify (V2)

| Файл                                                        | Что делаю                                                                                                                                                                                                                                                                              |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/lead/lead-form.tsx`                | В page-`<header>` (строки 1326-1431): добавить slim sub-row под h1+subtitle с lead-name · period · status badge · ↩ Edit — ТОЛЬКО когда `isSlidesMode`. Остальной chrome (Submit/Toggle/etc) остаётся скрытым по `!isSlidesMode`.                                                      |
| `apps/web/src/components/slides/lead-slides-client.tsx`     | Убрать рендер `<SlideHeader>` (строки 143-155). Оставить только `<StatusSlideDeck>`. Sub-row уезжает в lead-form.                                                                                                                                                                      |
| `apps/web/src/components/slides/status-slide-deck.tsx`      | `LeadSlideArticle` → переделать в **slide-look**: убрать sidebar-grid `xl:grid-cols-[minmax(260px,340px)_1fr]`, дать продукту крупный h2 (text-3xl/4xl), SDLC превратить из chips в inline-текст ("Planning · Analysis · Design · ..."), секции одна под другой с увеличенным spacing. |
| `apps/web/src/components/head/head-present-client.tsx`      | Убрать `<SlideHeader>` (строки 113-122), вернуть inline `<header>`-блок c title + subtitle + counter + exit-link (как было до V1 — page-level header в `head-present/page.tsx` уже даёт визуальный wrapper).                                                                           |
| `apps/web/src/components/slides/slide-header.tsx`           | **Удалить файл** — компонент больше не используется ни в Lead, ни в Head.                                                                                                                                                                                                              |
| `apps/web/src/components/slides/status-slide-deck.test.tsx` | Обновить assertions: вместо «no Completion / no Slide checks» проверить новый slide-look (крупный заголовок продукта, SDLC inline-текст вместо buttons).                                                                                                                               |

### Verification (V2)

```bash
pnpm typecheck && pnpm lint
pnpm --filter @customreport/web test -- status-slide-deck lead-form

# Manual via Playwright headed:
#   (a) /lead/report/<id>           → edit-режим, всё как до V1
#   (b) /lead/report/<id>?mode=slides → ОДИН header (My Report) с slim sub-row;
#                                        нет нашего отдельного SlideHeader блока;
#                                        product card имеет крупный slide-look
#   (c) /head/report/<id>/present   → keyboard ←/→/F работает; inline-header
#                                       вернулся к до-V1 виду (без SlideHeader)
```

### От человека (V2)

```
─────────────────────────────────────
▲ ОТ ТЕБЯ
─────────────────────────────────────
  └── Финальный визуальный sign-off на V2-скриншоте slides-режима
```

### Loop

Пользователь подвесил `/loop 1h` со скриптом «анализируй лог, найди
последний незавершенный шаг, авто-фикс, продолжай сборку до полного
завершения». Cron создаю первым делом **после ExitPlanMode** (в plan-режиме
запрещены non-readonly tools, включая `CronCreate`).

---

## Phase 61c — Закрытие сессии (2026-05-18)

### Контекст

V2-реализация закоммичена двумя коммитами на ветке
`feat/head-report-history-slides`:

- `2f5724e feat(web): V2 slides — unified header, slide-look product cards,
delete SlideHeader`
- `9575f01 style(web): apply Prettier formatting to V2 slides files`

Цель этой фазы — **довести работу до состояния, в котором сессию можно
безопасно закрыть**: верификация что ничего не сломалось локально, screenshot
для визуального sign-off, опциональный regression-spec, попытка push, retro +
ledger для следующей сессии.

### Состояние и блокеры

```
┌─ ветка feat/head-report-history-slides ─────────────────────┐
│ HEAD          3192cf0 (Phase 61 head history fix)            │
│ V2 коммиты    2f5724e, 9575f01                               │
│ unpushed      да — origin недоступен (SSL_ERROR_SYSCALL)     │
│ типы / lint   не прогонялись после V2 — нужно прогнать       │
│ unit-тесты    status-slide-deck 5/5 PASS (локально)          │
│ visual review нет (нет нового скриншота V2)                  │
└──────────────────────────────────────────────────────────────┘
```

Главный блокер — **SSL до `ghe.example.org`** (LibreSSL SSL_ERROR_SYSCALL).
Push в plan-mode не пробовали; в session уже подтверждено что failed. Это
HUMAN: сетевая среда вне scope агента.

### Execution flow

```
[1 verify locally]                         [3 screenshot review-slides-v2.png]
       │                                          │
       │ pnpm typecheck && pnpm lint              │ playwright headed snapshot
       │ pnpm --filter @customreport/web test     │ /lead/report/<id>?mode=slides
       │                                          │
       └─────────► [2 regression spec (opt)] ◄────┘
                          │
                          │ apps/web/e2e/regression/
                          │   lead-slides-read-only.spec.ts
                          ▼
                  [4 retro + ledger]
                          │
                          │ /peo-retro full ru
                          │ .planning/session-retros/NEXT-ACTIONS.md
                          ▼
                  [5 push (HUMAN — SSL)]
                          │
                          ▼
                  [6 PR (HUMAN — после push)]
```

Шаги 1, 2, 3, 4 — AGENT. Шаги 5, 6 — HUMAN (сеть + GitHub UI).

### Files to modify / create

| Файл                                                    | Тип               | Что                                                                                                                                                                                                    |
| ------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/e2e/regression/lead-slides-read-only.spec.ts` | NEW (опционально) | Playwright spec: (a) нет `[data-period-navigator]` / `[data-version-history]`, (b) нет Submit/Reopen-кнопок, (c) нет prev/next/counter, (d) видны все продукты лида, (e) screenshot match.             |
| `review-slides-v2.png`                                  | NEW (screenshot)  | Скриншот `?mode=slides` после V2 — для sign-off пользователя.                                                                                                                                          |
| `.planning/session-retros/NEXT-ACTIONS.md`              | UPDATE            | Continuation ledger: RUN FIRST = push после восстановления сети; AGENT = пусто (всё локально сделано); HUMAN = push + PR + visual sign-off; VERIFY = `git log --oneline -3` ожидает 2f5724e + 9575f01. |
| `.planning/STATE.md`                                    | UPDATE            | Phase 61b → CLOSED локально, awaiting push + visual sign-off.                                                                                                                                          |
| `.planning/plans/image-1-velvet-pixel.md`               | MOVE              | После approve — `git mv` в `.planning/plans/done/`.                                                                                                                                                    |

### Verification

```bash
# 1. Локальные gates (agent выполняет, обязательно до retro)
pnpm typecheck
pnpm lint
pnpm --filter @customreport/web test -- status-slide-deck lead-form

# 2. Visual snapshot (agent поднимает dev, делает screenshot)
pnpm dev:watch &  # уже запущен в session? проверить ps
# затем через playwright MCP:
#   browser_navigate http://localhost:3000/lead/dev-login?role=lead
#   browser_navigate http://localhost:3000/lead/report/<active-id>?mode=slides
#   browser_take_screenshot review-slides-v2.png

# 3. (опционально) Regression
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts \
  --grep "lead-slides-read-only"

# 4. Push attempt (HUMAN — SSL зависит от сети)
git push origin feat/head-report-history-slides
# expected fail сейчас: LibreSSL SSL_ERROR_SYSCALL

# 5. PR (HUMAN — после успешного push)
gh pr create --title "feat(web): V2 slides — unified header + slide-look cards" --body "..."
```

### От человека (Phase 61c)

```
─────────────────────────────────────
✓ Я ДЕЛАЮ САМ (тебе ничего не нужно)
─────────────────────────────────────
  ├── pnpm typecheck / lint / test                ← agent
  ├── screenshot review-slides-v2.png             ← agent (playwright)
  ├── (опц) Playwright spec lead-slides-read-only ← agent
  ├── update .planning/STATE.md + retro ledger    ← agent
  └── /peo-retro full ru в конце                  ← agent

─────────────────────────────────────
▲ ОТ ТЕБЯ
─────────────────────────────────────
  ├── визуальный sign-off на review-slides-v2.png  ← покажу скрин
  ├── git push после восстановления сети (SSL)     ← вне scope агента
  └── открыть PR через ghe.example.org UI         ← после push
```

### Open questions

| #   | Вопрос                                            | Как решу автономно                                                                                                     | Когда эскалирую                                                |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Нужен ли Playwright regression spec прямо сейчас? | Делаю минимальный smoke spec (5 assertions), не блокирующий push.                                                      | Если пользователь хочет full visual regression — допишу позже. |
| 2   | Что писать в STATE.md?                            | Phase 61b → `CLOSED locally, awaiting push + visual sign-off`. Phase 61c → `IN PROGRESS — local verification + retro`. | —                                                              |
| 3   | Куда положить план после approve?                 | После закрытия сессии — `git mv` в `.planning/plans/done/`.                                                            | —                                                              |

### Done-when

- [ ] `pnpm typecheck && pnpm lint && pnpm test status-slide-deck` — все зелёные
- [ ] `review-slides-v2.png` сделан и показан пользователю
- [ ] `.planning/STATE.md` обновлён (Phase 61b/61c)
- [ ] `.planning/session-retros/NEXT-ACTIONS.md` содержит RUN FIRST = push
- [ ] `/peo-retro full ru` выдан в чат
- [ ] (HUMAN, не блокирует закрытие сессии) push + PR — отмечено в ledger как pending

### Side deliverables (после approve плана)

- Создать `CronCreate` для `/loop 1h` (был запланирован, но в plan-mode
  запрещён).
- Записать в `.planning/memory/`: «V2 slides shipped, awaiting push»
  (project-memory).
- Никаких новых правил — это разовый closure, не паттерн.

### Self-verify checklist (Phase 61c)

- [x] Контекст + блокеры явно
- [x] Execution flow ASCII
- [x] AGENT/HUMAN разделены
- [x] Verification — bash + сценарии
- [x] Done-when измеримый
- [x] Side deliverables после ExitPlanMode
