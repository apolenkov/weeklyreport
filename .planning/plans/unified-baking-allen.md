# План — live UAT triage 2026-05-23 (fix/PRJ-2/shiny-eagle)

## 0. Контекст (зачем переписали план)

Старый план (snapshot-stage-color + UAT artifacts) — закрыт ранее в этой
сессии (commit `263b50d fix(lead): snapshot stage chips ...`). С 22:14 GMT+3
пользователь сидит в живом UAT (на `/lead/report/<id>`) и за ~14 минут прислал
**9 фидбэков** (#1–#7 в первой волне 22:14–22:25, #8 + #10 — добор 22:28).
План переписан под триаж этого потока. #9 — мета-комментарий («увидишь сам»),
не отдельный коммит.

### Что **уже сделано** и НЕ обсуждается

```text
┌─ закрыто ранее ─────────────────────────────────────────────────────────┐
│ ✓ HEAD период-полоска + archive toggle                                  │
│   head-report-shell.tsx:96-105 — ReportToolbar + PeriodNavigator +     │
│   ArchiveToggle. UAT 2026-05-22 done-condition 10. Идентичная           │
│   полоске у лида (lead-form.tsx:1530-1543).                             │
│                                                                         │
│ ✓ TODO(STAGE-COLOR-SNAPSHOT) — implementation already merged в         │
│   commit 263b50d (deriveEffectiveStageStatus в snapshot path).          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Что **НЕ берём** (заморожено, не трогать)

```text
┌─ frozen ────────────────────────────────────────────────────────────────┐
│ AI/RAG, Telegram, Holidays, Director, dark theme, i18n                  │
│ next/font migration (TODO(VERCEL-FONT)) — нужен visual sign-off         │
│ apps/web/src/app/layout.tsx, pulse.css, globals.css (--font-*)          │
│ goals/accumulated-work-audit/                                           │
│ push origin/main — SSL заблокирован (ghe.example.org)                  │
│ E2E spec automation — пользователь сказал «E2E пока забьём»,           │
│   фокус на regression-сценариях через agent-browser / DevTools.        │
└─────────────────────────────────────────────────────────────────────────┘
```

## 1. TL;DR — две волны фидбэка (9 quick-fix + 6 slide-redesign)

### Волна 1 (form view, 22:14–22:28) — atomic per-issue

```text
┌─ live-UAT findings 2026-05-23 22:14-22:28 GMT+3 ────────────────────────┐
│                                                                         │
│ ▲ HIGH                                                                  │
│  #1 autosave UX           — мерцания, скачки версий, теряет правки.     │
│                              Нужна перепроектировка модели сохранения.  │
│  #2 navbar icons-only     — пользователь просил 10 раз. Текст на xl     │
│                              breakpoint всё ещё рендерится.             │
│  #5 seed 5 периодов       — Fill From dropdown пуст; для regression    │
│                              нужно 5 периодов, 2 архивных.              │
│  #7 Risk-Stage логика     — при создании blocker/risk предлагать только│
│                              стадии помеченные как blocked + hint-text. │
│  #8 at-risk без risk-text — пометил стадию at-risk → нет warning что    │
│                              в Risks секции пусто. Cross-validation.    │
│ #10 stage↔section drift   — Development показан at-risk «глюком»;       │
│                              нужно чёткое соответствие chip↔section    │
│                              + regression-тесты на correspondence.      │
│                                                                         │
│ ◆ MEDIUM                                                                │
│  #3 Fill From dialog      — текст вытекает за пределы белой карточки,   │
│                              cut off правой границей viewport.          │
│  #6 StageMultiSelect      — нижний «Scope: <pills>» дублирует чекбоксы │
│                              сверху. Когда выбрано — убрать дубль.      │
│                                                                         │
│ ▼ LOW                                                                   │
│  #4 lock-chip tooltip     — улучшить формулировку «owned by <name>».    │
│                                                                         │
│  #9 «как вариант увидите» — мета-комментарий пользователя к #8/#10,    │
│                              не самостоятельный коммит. Не трогаем.    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Волна 2 (slides view `?mode=slides`, 22:32) — UX-redesign

```text
┌─ live-UAT slide findings 2026-05-23 22:32 GMT+3 ────────────────────────┐
│                                                                         │
│ ▲ HIGH                                                                  │
│ #11 AgentReview ДУБЛЬ      — рендерится 2 раза: в LeadSlideHero        │
│                              (x=598,y=282) И в LeadUnifiedSlide        │
│                              (x=1239,y=445). Нужно оставить один.       │
│                              Аналогично у scope-toggle / tone-badge.    │
│ #12 высота скачет          — при смене группировки слайд меняет        │
│                              высоту. Должна быть фиксированная.        │
│ #13 item alignment         — приоритеты сдвигают начало item-text     │
│                              вправо на ~213px (priority pill съел      │
│                              место). Нужно выравнивание по левой       │
│                              границе текста, priority как trailing.    │
│ #16 slide-design research  — найти skill / Context7 паттерны для      │
│                              генерации красивых слайдов. UX-fix         │
│                              требует дизайн-вижена, не точечных правок.│
│ #17 By-product = тоже slide— scope=product сейчас отдельный            │
│                              `LeadProductGrid` (sm:grid-cols-2 lg:3),   │
│                              не slide-frame. Должен быть в том же       │
│                              визуальном языке что и Own-view (тот же   │
│                              skill, тот же slide-frame, hero, metrics).│
│                                                                         │
│ ◆ MEDIUM                                                                │
│ #14 layout 2-колонки       — current+next слева/справа в одной строке; │
│                              risks+decisions тоже 2 колонки. Использо- │
│                              вать всё полотно (slide-frame 1088×680).  │
│ #15 metric tiles стиль     — «25» On-track% непонятно почему; tiles    │
│                              некрасивые; нужны стикеры в стиле          │
│                              Blockers/AgentReview pills. Подумать.     │
└─────────────────────────────────────────────────────────────────────────┘
```

Волна 2 **НЕ atomic-commits** — нужен design-research first, потом
комплексный slide-layout refactor. Решение: после волны 1 запускаем
research-фазу (Context7 + frontend-design skill + slide-design patterns
WebSearch), потом единый плановый коммит «slides redesign» с превью.

### Волна 3 (другие экраны, 22:39–22:40) — bug + audit

```text
┌─ live-UAT cross-screen findings 2026-05-23 22:39-22:40 ─────────────────┐
│                                                                         │
│ ▲ HIGH                                                                  │
│ #18 head/dashboard БАГ      — Василий И. показан «No content / 0 items»│
│                              на /head/dashboard, но он закоммитил       │
│                              текущий период. Activity-row фильтрует    │
│                              неверно «текущие периоды попадающие в      │
│                              текущий день». Прям bug, данные врут.    │
│                                                                         │
│ ◆ MEDIUM                                                                │
│ #19 skeleton audit          — /reports?tab=drafts: проблемы со          │
│                              skeleton при загрузке (мерцания/jumps).   │
│                              User просит ПРОАНАЛИЗИРОВАТЬ ВСЕ формы,   │
│                              навесить consistent skeletons где нет.   │
│ #20 LeadHistoryList ↔ rows  — /reports?tab=published показывает         │
│                              LeadHistoryList grid 2-col. User спросил  │
│                              «есть ли сопоставление с тем что для     │
│                              ряда?» — нужна consistency check между    │
│                              published view и lead-side history.       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Cross-cutting принцип

User: «всегда подсказки давать, на английском пока (i18n позже — coming
soon)». При любых non-obvious UX-механиках добавлять inline hint-text
рядом с control-ом, не закапывать в tooltip.

### Approach: атомарные коммиты per-issue (НЕ bundle)

Пользователь сидит в live-UAT — будет ещё фидбэк. Каждое исправление —
один атомарный коммит, чтобы можно было катить инкрементально и не ждать
весь bundle. После каждого — короткий ответ «#N сделал, проверь».

```text
[fix #2 navbar]              → [commit 1] → ✓ live
   → [fix #6 stage dup]      → [commit 2] → ✓ live
   → [fix #4 lock tooltip]   → [commit 3] → ✓ live
   → [fix #3 Fill From]      → [commit 4] → ✓ live
   → [fix #5 seed 5 periods] → [commit 5] → ✓ live
   → [fix #7 Risk-Stage hint MIN] → [commit 6] → ✓ live
   → [fix #8 at-risk warn + #10 corresp regression]
                              → [commit 7] → ✓ live  ← НОВОЕ
   → [AskUserQuestion: autosave модель A/B/C?]
   → [fix #1 autosave]       → [commit 8] → ✓ live
   → [final gates]
```

Порядок: сначала дёшево/быстро (#2 #6 #4), потом portal (#3), seed
(#5), hint-text (#7), потом семантическая валидация (#8 + #10 вместе,
они оба о связке chip-status ↔ Risks section), потом самый сложный с
development decision (#1).

## 2. Архитектурный контекст

### #1 — autosave path (root-cause анализ)

```text
user-edit                          (любой input change)
   ↓
draftSavePayload (useMemo)          (lead-form.tsx:200-330)
   ↓
useLeadFormAutosave                 (debounceMs=3000)
   │ state: idle → pending → saving → saved
   │
   ├──[3s timer]──▶ saveDraft mutation
   │                    onSuccess:
   │                       lastSavedRef = inFlightKey
   │                       setState("saved")
   │                       invalidateLeadForm(qc, trpc)  ←── ★ ПРИЧИНА
   │                                                          МЕРЦАНИЙ
   │                                                          + revert
   │                                                          edits
   │
   └──[onSaveSuccess]──▶ debounced snapshot (5s, lead-form.tsx:609)
                            → создаёт версию → version-counter++
```

**Корневая причина мерцаний / revert:** `invalidateLeadForm` дёргает три
queryGroups (`reports.getActive` + `leadForm.byPeriod` + `leadForm.versions`)
после каждого save. Refetch `byPeriod` → новый объект данных → форма
пересоздаёт state на основе серверной правды → если пользователь успел
кликнуть ещё что-то между save и refetch — его свежие правки в
state-derived UI (chip color, status) могут перезаписаться серверной
версией. + auto-snapshot каждые 10 saves (lead-form.tsx:609) создаёт
прыжки version-counter c5→9 на минуту активной правки.

### #2 — navbar buttons сейчас

```text
nav-bar.tsx:380-419
├── DevRoleSwitcher                 (текст «Switch Role» — внутри компонента)
├── ThemeComingSoonControl          (текст «Theme» при xl: hidden xl:inline)
├── LanguageComingSoonControl       (текст «Language» при xl)
└── Logout button                   (текст «Logout» при xl: hidden xl:inline)

на ноуте 1728×962 (тест-viewport) xl breakpoint = 1280px → текст ВИДЕН.
требование: иконки ВСЕГДА; «Switch Role / Theme / Language / Logout» —
никогда не рендерить как видимый text. aria-label/title оставить.
```

### #3 — Fill From dialog overflow

```text
fill-from-button.tsx:189-216
<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
  <div className="animate-scale-in mx-4 w-full max-w-md ... bg-white p-6">
    <h3>Fill from Week N?</h3>
    <p className="mt-2 text-sm">...text...</p>
    ...
  </div>
</div>

симптом (скриншот): белая карточка в верхней-левой трети viewport,
текст <p> вытек за её правую границу до правого края экрана.
гипотеза: какой-то предок в lead-form имеет transform/filter, и
fixed-позиционирование становится относительно него (W3C spec).
решение: createPortal в document.body (так уже сделано для
stage-chip popover в stage-chip.tsx:253-302).
```

### #4 — lock-chip tooltip сейчас

```text
stage-chip.tsx:169-188
const title = isLocked
  ? [stage.assignee ?? "Unknown", lockSuffix, "No edit permissions"]
      .filter(Boolean).join(" · ")
  : ...;

текущий формат: «Boris · 2 items · 1 risk · No edit permissions»

запрос: чётче объяснить «почему ты не можешь». читаемее:
«Locked — owned by Boris. You don't have edit permissions.»
```

### #5 — seed данные сейчас

```text
prisma/seed.ts → создаёт сейчас 2 периода (Week 20 + текущий)
                  → Fill From dropdown показывает только 1 past period

нужно для regression: 5 периодов, 2 архивных
  Week 18 (archived)
  Week 19 (archived)
  Week 20 (active, submitted)
  Week 21 (active, submitted)
  Week 22 (current, draft)

проверить: prisma/seed.ts, prisma/seed-* helpers, dev.wipeAndReseed
```

### #7 — Risk-Stage логика (UX gap)

```text
сценарий пользователя:
  1. user открывает Risk Edit Dialog для product «CRM customer»
  2. видит StageMultiSelect со всеми стадиями (Analysis, Dev, Testing,
     DevOps, Support — все assigned product-у)
  3. выбирает severity = «blocker»
  4. может выбрать ВСЕ стадии — даже те, где chip = on-track / empty
  5. ↓ результат: blocker «привязан» к стадиям, где никакой проблемы нет

логичный flow (user request):
  1. user сначала помечает chip Testing как «blocked» (SDLC pipeline)
  2. → Risk Edit Dialog показывает только стадии с status=blocked
        как «default scope»; другие — disabled или вообще скрыты
  3. если user пытается создать risk БЕЗ помеченных blocked-стадий →
     показывается hint: «Mark a stage as blocked first, then add a risk»

технически:
  apps/web/src/components/lead/risks-section.tsx (~line 106) →
    RiskEditDialog → StageMultiSelect
  нужно прокинуть «stageStatuses» в RiskEditDialog → отфильтровать
  доступные stages по: status === "blocked" (для severity=blocker)
  или status в ("blocked", "at-risk") (для severity=at-risk)

скоп этого фикса в текущем плане:
  ВАРИАНТ MIN: добавить только hint-text над checkboxes:
    «Tip: mark a stage as blocked on the SDLC pipeline before adding
     a risk that targets it.»
  ВАРИАНТ FULL: фильтровать stages по chip status — требует thread
    stageStatuses через RisksSection → RiskEditDialog → StageMultiSelect.
    Это +30-50 LoC + потенциальная регрессия e2e тестов.

рекомендация: MIN в этом плане; FULL — в новой ветке после live-UAT
текущих 6 коммитов. user явно сказал «надо доработать ЛОГИЧЕСКИ» что
тяготеет к FULL — но это уже новая фича а не fix.
```

### #6 — StageMultiSelect duplicate

```text
stage-multi-select.tsx:57-97
сверху (56-80):  green-highlighted checkboxes для каждой стадии
снизу (86-97):   «Scope: <pill>Dev</pill> <pill>Testing</pill>...»

это ВИЗУАЛЬНЫЙ дубль: те же стадии что зелёные сверху — повторены
снизу как pills. user видит одни и те же названия дважды.

исключение: когда selected.length === 0, снизу показывается
«Scope: all assigned stages.» — это полезный legend, оставить.

фикс: убрать pill-блок (86-97) когда selected.length > 0; оставить
только legend для empty-state.
```

### #8 — at-risk без risk-text (cross-validation gap)

```text
сценарий пользователя:
  1. user помечает SDLC chip «Support» как at-risk через долгое нажатие
  2. в Risks section НИЧЕГО не добавляет (нет текста, нет dialog'а)
  3. сохраняет / сабмитит секцию → НИКАКОГО warning'а
  4. ↓ результат: «голый» at-risk без объяснения, читатель отчёта не
     понимает что не так

технически:
  - SDLC chip status хранится в `draftSection.stageStatuses[i].status`
    (apps/web/src/components/lead/stage-chip.tsx)
  - Risks хранится в `draftSection.risks[]`
    (apps/web/src/components/lead/risks-section.tsx)
  - связь stage ↔ risk через `risk.stageIds[]` (StageMultiSelect)

  validation должен: для каждой stage где status ∈ {at-risk, blocked}
  проверить что есть хотя бы один risk с этой stage в stageIds[],
  ИЛИ хотя бы один blocker-item, ИЛИ — если нет — показать inline
  warning рядом с chip:
  «Stage marked as at-risk — add a risk entry to explain why»

место для warning'а: рядом с chip (под SDLC pipeline) или в footer
секции перед submit-кнопкой. ЛУЧШЕ inline (рядом с chip) — даёт
direct call-to-action.

скоп: derive helper `deriveStageValidationWarnings(section)` в
section-validation.ts; consume в stage-chip.tsx (рендерит warning
icon в углу chip-а) И в SubmitBar (рендерит summary перед submit).
```

### #10 — stage↔section correspondence (потенциальный bug)

```text
симптом пользователя: «У меня Development вообще показан как at-risk
— это глюк». «Нужно чёткое соответствие секций и того как помечаем
стадии. Это важно в тестах тоже проверить.»

гипотезы (нужно investigate перед фиксом):
  H1: snapshot-derived chip-status показывает at-risk потому что
      deriveEffectiveStageStatus агрегирует risks+items для всех
      продуктов, а user ожидает per-section правду.
      (commit 263b50d уже трогал этот path — потенциальная регрессия)
  H2: cross-author embed (F14) подтягивает чужие risks с пометкой
      на Development, и user видит at-risk «не своего» риска.
  H3: stale localStorage / cache между сессиями.

investigation steps (перед commit'ом):
  1. вживую воспроизвести: clean seed → создать risk на Development
     для одной секции → проверить что другие секции не подсвечивают.
  2. прочитать deriveEffectiveStageStatus в snapshot-builder.ts.
  3. прочитать buildSectionSlideModel (slide-rendering path).
  4. найти все места где stage status вычисляется и убедиться они
     консистентны.

скоп фикса: ОТКРЫТО — зависит от того что найдём в investigation.
варианты:
  A. bug в deriveEffectiveStageStatus → точечный fix.
  B. cross-author embed подсвечивает чужие risks → отдельный flag.
  C. нет bug — нужно объяснить user через UX (tooltip «inherited
     from product owner» на чужом risk).

regression tests (mandatory): добавить в section-validation.test.ts
case: «section A risks for Development → section B Development chip
остаётся neutral» (изолированность статуса между секциями одного
продукта).
```

### #11 — AgentReview / scope-toggle ДУБЛЬ на слайде

```text
скриншот фидбэка:
  - position 1: x=598, y=282 (внутри LeadSlideHero, slide header)
  - position 2: x=1239, y=445 (внутри LeadUnifiedSlide body)

причина: в lead-slides-client.tsx scopeControls передаётся в
heroControls И в ReportSlides (StatusSlideDeck). И LeadSlideHero
рендерит heroControls, И LeadUnifiedSlide / SlideHeader тоже
рендерит controls. Двойной маунт AgentReviewComingSoon (+ скорее
всего ScopeToggle тоже дублируется).

проверить:
  apps/web/src/components/slides/lead-slide-hero.tsx:117 → {heroControls}
  apps/web/src/components/slides/lead-unified-slide.tsx — где ещё
    маунтится AgentReviewComingSoon (judging by скриншот #1).
  apps/web/src/components/slides/status-slide-deck.tsx — toolbar slot.

фикс: один canonical mount-point. Лучший — в LeadSlideHero (вверху
слайда, как hero badge). Удалить второй mount из LeadUnifiedSlide
ИЛИ из status-slide-deck toolbar.
```

### #12 — высота слайда скачет при смене группировки

```text
симптом: при переключении scope (Own/By product) высота slide-frame
меняется. slide-frame имеет fixed `height: 680px` в computed styles,
но при rerender content внутри `overflow: hidden` обрезается без
warning'а.

возможные причины:
  - flex-сетка внутри (current/next/risks/decisions) не имеет min-h
  - product grid в scope=product реально длиннее чем article-flow
  - article slide-frame фиксирован на 680, product-grid не

фикс: либо синхронизировать min-h для обоих scope (по самому
длинному), либо сделать height: auto + max-h: 80vh + overflow: auto
внутри.

связано с #14 (layout redesign) — лучше решать вместе.
```

### #13 — item-text alignment (priority pill сдвигает текст)

```text
скриншот: «213px правее, чем начинается "подготовка демо для
квартального ревью"».

причина: priority pill (rank badge) рендерится inline с item text,
и item text «обтекает» priority pill справа. в результате items
с priority сдвинуты вправо относительно items без priority.

фикс: вынести priority pill в trailing slot (справа от item) ИЛИ
зарезервировать фиксированную колонку слева под priority badge так
чтобы все item-text начинались с одной X-координаты.

место: apps/web/src/components/slides/lead-unified-slide.tsx
(SectionBlock ul mt-2 space-y-1.5).
```

### #14 — slide layout: 2-колонки и full-width

```text
user request: «current/next в 2 колонки в одной строке, risks/
decisions тоже в 2 колонки, использовать весь slide-frame (1088×680)».

текущий layout (vertical stack):
  ┌────────────────────────────────┐
  │ Current work (full width)      │
  ├────────────────────────────────┤
  │ Next focus (full width)        │
  ├────────────────────────────────┤
  │ Risks (full width)             │
  ├────────────────────────────────┤
  │ Decisions (full width)         │
  └────────────────────────────────┘

target layout (2-col grid):
  ┌──────────────────┬─────────────┐
  │ Current work     │ Next focus  │
  ├──────────────────┼─────────────┤
  │ Risks            │ Decisions   │
  └──────────────────┴─────────────┘

trade-off: если risks много, колонка переполняется. возможно нужен
adaptive: if (risks.length > 5) → risks занимает full row, decisions
отдельно. Иначе 2×2 grid.

связано с #12 (высота) и #15 (общая красота).
```

### #15 — hero metric tiles (стиль + «25 непонятно»)

```text
текущие tiles (lead-slide-hero.tsx:129-134):
  ┌─Current─┐ ┌─Risks─┐ ┌─Priorities─┐ ┌─On-track %─┐
  │   3     │ │   4   │ │    25      │ │    100     │
  └─────────┘ └───────┘ └────────────┘ └────────────┘

стиль: rounded white card с цифрой + label.

user pain points:
  1. «25 непонятно почему» — нужен tooltip или подпись объясняющая
     что считается (24 = priority items в section? в продукте?
     в группе?).
  2. tiles некрасивые — нужны badge-style stickers в стиле
     Blockers / AgentReview (rounded-pill + цветной accent).
  3. asymmetric — Blockers tone-badge сверху отдельно, metrics
     отдельно справа. Слить в один rail чтобы выглядело cohesive.

design direction (frontend-design skill candidate):
  - все metrics + tone в одну горизонтальную rail из pills
  - hover → tooltip объясняет источник числа
  - cohesive цветовая палитра (не каждая metric с своим border)

связано с #16 (research дизайн через skill).
```

### #17 — By-product view тоже должна быть «слайдом»

```text
текущий path:
  lead-slides-client.tsx:168 → if (scope === "product")
    return <div ref={deckRef} className="space-y-4">
             <scope controls>
             <LeadProductGrid products={...} />
           </div>

LeadProductGrid:
  grid gap-4 sm:grid-cols-2 lg:grid-cols-3
  — обычная сетка из ProductCard'ов (rounded-card, padding=4, shadow)

user expectation: scope=product тоже должен жить В slide-frame
(rounded-[var(--radius)] border bg-card p-6 shadow_1px_2px), с тем же
hero (LeadSlideHero), теми же metrics tiles, той же визуальной
сеткой как в Own-view. Не просто grid карточек снаружи slide-frame.

фикс (в составе #14-#16 redesign):
  - product-view рендерить в том же `<article class="slide-frame">`
    что и Own-view.
  - hero (метрики + tone-badge + scope-toggle) — общий компонент
    LeadSlideHero для обеих scope.
  - product cards внутри slide-frame — переиспользовать дизайн
    SectionBlock (рамки, типография, spacing).

связано с #11 (дубль AgentReview): сейчас в product-view scope-toggle
и AgentReview рендерятся отдельно, в Own-view — через hero. Унифи-
цировать → один маршрут рендера hero, two-mode content внутри
slide-frame.

место для правки:
  apps/web/src/components/slides/lead-slides-client.tsx:168-178
    обернуть product-view в slide-frame + hero.
  apps/web/src/components/slides/lead-product-grid.tsx
    адаптировать spacing/typography под slide-frame internal grid.
```

### #18 — head/dashboard activity-row показывает «no content» хотя есть submit

```text
симптом (скриншот): user Василий И. → activity-row с opacity-65,
text «No content», «0 items · 0 risks · 0 decisions · 0 priorities»,
status «not started». Но user заявляет что Василием закоммитил
текущий период.

место: apps/web/src/components/dashboard/activity-live-panel.tsx:204
  → ActivityRow рендерит aria-label «X has no report content yet»

гипотезы:
  H1: ActivityLivePanel читает данные за «текущий период по дате»,
      а Василий закоммитил для прошлого/будущего periodId.
  H2: tRPC query reports.dashboardActivity (или эквивалент) считает
      contentful по разным критериям чем submit-status (например
      counts на section, а submit-status на report).
  H3: race-condition: submit прошёл, но кэш дашборда не invalidated.
  H4: фильтр по author/group исключает Василия неверно.

investigation steps (перед commit'ом):
  1. найти source query → activity-live-panel.tsx → useQuery hook.
  2. изучить server resolver (apps/api/src/reports/...) — какие
     поля он берёт чтобы пометить «no content».
  3. проверить что reportPeriodId соответствует «текущему дню»
     (по dayjs / какому формату).
  4. live repro: войти как Василий → закоммитить секцию → перейти
     на /head/dashboard → проверить что row обновился.
  5. если bug — fix в server resolver, добавить regression test.

regression test: в integration suite добавить case:
  «после submit-section as user X → dashboardActivity показывает
   X с contentful counts (не "no content")»
```

### #20 — LeadHistoryList consistency check (clarify-first)

```text
user комментарий: «А у нас есть какое-то сопоставление вот этого и
того, что для ряда?»

интерпретация (требует уточнения у user): на /reports?tab=published
рендерится `<LeadHistoryList>` (lead-history-list.tsx:225, grid
sm:grid-cols-2). Тот же компонент используется на lead-side
(/lead/history или эквивалент?). Question: совпадает ли визуально
и данными то что видит head на /reports?tab=published с тем что
видит lead в своей history-view?

approach:
  1. grep `LeadHistoryList` → найти ВСЕ callers.
  2. сравнить props/data shape: какие репорты показываются head'у
     на published-tab vs какие lead'у на его history?
  3. если расхождение — bug; если consistency — задокументировать
     для user.

скоп: investigation-only до user clarification. Если bug найден →
fix в составе волны 3 (с #18 #19).
```

### #19 — skeleton audit по всем формам

```text
симптом: /reports?tab=drafts → loading state мерцает / нет skeleton.
user request: «проверь скелетоны ВЕЗДЕ, проанализируй всю модель,
чтобы всё чётко было».

инвентарь экранов (нужно audit):
  - /lead (form view) — есть SlideSkeleton? проверить
  - /lead/report/<id> (snapshot view) — skeleton?
  - /lead/history — skeleton?
  - /head/dashboard — skeleton?
  - /head/report — skeleton?
  - /head/history — skeleton?
  - /reports?tab=drafts — НЕТ skeleton (фидбэк)
  - /reports?tab=published — проверить
  - /viewer/* — проверить

approach:
  1. audit pass (Haiku агент): grep `SlideSkeleton|loading|isLoading`
     по `apps/web/src/components/**` → составить список экранов
     БЕЗ или с слабым skeleton'ом.
  2. для каждого «слабого» экрана добавить consistent skeleton
     (shadcn Skeleton component с правильными dims чтобы CLS=0).
  3. regression: pnpm test → verify Loading states.

скоп: ~50-100 LoC, MEDIUM priority, после волны 1 + bug-fix #18.
```

### #16 — slide-design research (Context7 + frontend-design skill)

```text
user request: «Найди skill / Context 7 / WebSearch для красивых
слайдов. С учётом что у нас динамические блоки (группировка,
продукты-метки и т.д.). Подумай.»

available resources:
  - plugin:frontend-design:frontend-design (уже подгружен этой сессии)
    → guidance на aesthetic direction, typography, motion, layout
  - context7 MCP → может query тэги "report design", "dashboard layout"
  - WebSearch → patterns 2026 для status-slide дизайна
  - existing examples: tldraw, Notion gallery, Linear weekly digest

approach:
  1. провести research-фазу (3-5 параллельных Haiku агентов через
     Context7 + WebSearch) → собрать 5-10 reference паттернов.
  2. сделать design-research memo в .planning/research/
     `slide-redesign-2026-05-23.md` с reference image links +
     decision matrix.
  3. user approves direction.
  4. implementation single commit с превью.

НЕ trade-off: НЕ делать это микрокоммитами вместе с волной 1 —
слайды должны переделываться целиком, не по компоненту.
```

## 3. Что меняем (по issue, атомарно)

### Шаг 1 — #2 navbar icons-only (commit 1, ~10 LoC)

`apps/web/src/components/navigation/nav-bar.tsx`:

```text
строка 175: <span className="hidden xl:inline">Language</span>   → удалить
строка 200: <span className="hidden xl:inline">Theme</span>      → удалить
строка 417: <span className="hidden xl:inline">Logout</span>     → удалить
```

`apps/web/src/components/dev/role-switcher.tsx`:

```text
проверить рендер «Switch Role» — если есть hidden xl:inline или
visible-text → удалить, оставить только icon + aria-label/title.
```

### Шаг 2 — #6 StageMultiSelect duplicate (commit 2, ~10 LoC)

`apps/web/src/components/lead/stage-multi-select.tsx:82-98`:

```diff
- {selected.length === 0 ? (
-   <p className="mt-2 text-[11px] ...">
-     Scope: all assigned stages.
-   </p>
- ) : (
-   <div className="mt-2 flex flex-wrap items-center gap-1.5 ...">
-     <span>Scope:</span>
-     {selected.map((stage) => (...pill...))}
-   </div>
- )}
+ {selected.length === 0 && (
+   <p className="mt-2 text-[11px] ...">
+     Scope: all assigned stages.
+   </p>
+ )}
```

### Шаг 3 — #4 lock-chip tooltip (commit 3, ~10 LoC)

`apps/web/src/components/lead/stage-chip.tsx:169-188`:

```diff
- const title = isLocked
-   ? [stage.assignee ?? "Unknown", lockSuffix, "No edit permissions"]
-       .filter(Boolean).join(" · ")
-   : ...;
+ const title = isLocked
+   ? [
+       `Locked — owned by ${stage.assignee ?? "another lead"}`,
+       lockSuffix,
+       "You don't have edit permissions",
+     ].filter(Boolean).join(" · ")
+   : ...;
```

Проверить рендер `useSdlcTooltip` — multi-line с `\n` или одной строкой
через `·`. Sticky к `·` если newline не рендерится.

### Шаг 4 — #3 Fill From dialog (commit 4, ~30 LoC)

`apps/web/src/components/lead/fill-from-button.tsx`:

1. Воспроизвести через chrome-devtools MCP — открыть `/lead/report/<id>`,
   нажать Fill, найти `transform` на предке.
2. Решение: обернуть `showConfirm` ветку в `createPortal(..., document.body)`
   (паттерн идентичен `stage-chip.tsx:253-302`).
3. Добавить focus-trap (если был — сохранить, тесты на A11y зелёные).

### Шаг 5 — #5 seed 5 periods (commit 5, ~30-50 LoC)

`prisma/seed.ts` (или вспомогательные seed-\* в `prisma/`):

1. Найти `createReportPeriod` / эквивалент.
2. Добавить 3 дополнительных периода (Week 18, 19, 21):
   - Week 18 → archived=true, submitted
   - Week 19 → archived=true, submitted
   - Week 20 → archived=false, submitted (как сейчас)
   - Week 21 → archived=false, submitted (новый)
   - Week 22 (current) → draft (как сейчас)
3. Seed одинаковые products + 1-2 items + 1 risk per period — чтобы
   Fill From показал реалистичный preview-меtatext «X products · Y items».
4. Проверить, что archived-периоды появляются только при включённом
   `ArchiveToggle` (показ archived).

### Шаг 6 — #7 Risk-Stage hint (commit 6, ~5 LoC, MIN-вариант)

`apps/web/src/components/lead/stage-multi-select.tsx`:

```diff
  <p
    id={helperId}
    className="mb-2 text-[11px] text-[var(--color-muted-foreground)]"
  >
-   Optional. Leave empty to apply to all assigned stages.
+   Optional. Leave empty to apply to all assigned stages. Tip: mark the
+   stage as blocked on the SDLC pipeline above before pinning a risk —
+   that keeps your blocker scope honest.
  </p>
```

FULL-вариант (фильтрация stages по status) — отдельная ветка после
текущего цикла, не в этом плане.

### Шаг 7 — #8 + #10 cross-validation (commit 7, ~80-120 LoC)

**#8 at-risk без risk-text** — добавить inline warning:

```text
apps/web/src/lib/section-validation.ts (NEW helper):
  export function deriveStageValidationWarnings(
    section: DraftSection,
  ): Array<{ stageId: string; reason: string }> {
    const warnings = [];
    for (const stage of section.stageStatuses) {
      if (stage.status === "at-risk" || stage.status === "blocked") {
        const hasLinkedRisk = section.risks.some((r) =>
          r.stageIds.includes(stage.id),
        );
        if (!hasLinkedRisk) {
          warnings.push({
            stageId: stage.id,
            reason: `Stage marked ${stage.status} — add a risk entry`,
          });
        }
      }
    }
    return warnings;
  }

consumers:
  - stage-chip.tsx → рендерит ⚠ icon в углу chip-а если warning есть
    (только для своих chips, не для locked)
  - risks-section.tsx (footer) → суммарный счётчик «N stages at-risk
    without linked risk — add details»
```

**#10 stage↔section correspondence** — investigate first, fix scope
зависит от находок. Перед commit-ом:

1. `pnpm test -- section-validation` — baseline.
2. `grep -rn "deriveEffectiveStageStatus" apps/` — найти все consumers.
3. Read `snapshot-builder.ts` (где chip-status агрегируется).
4. Read `buildSectionSlideModel` (slide rendering path).
5. Live repro: чистый seed → create risk on Development в section A
   → проверить что section B Development chip остаётся neutral.

**regression test (mandatory)** в commit 7:

```text
apps/web/src/lib/__tests__/section-validation.test.ts:
  it("Development chip in section B not affected by section A risks", () => {
    const sectionA = makeSection({ risks: [{ stageIds: ["dev"] }] });
    const sectionB = makeSection({ risks: [] });
    expect(deriveEffectiveStageStatus(sectionB, "dev")).toBe("neutral");
  });

  it("at-risk stage without linked risk → warning", () => {
    const s = makeSection({
      stageStatuses: [{ id: "support", status: "at-risk" }],
      risks: [],
    });
    expect(deriveStageValidationWarnings(s)).toHaveLength(1);
  });
```

### Шаг 8 — #1 autosave UX (commit 8, ~80 LoC, вариант A зафиксирован)

User выбрал **A: smart debounce 5s + setQueryData patch**.

```text
apps/web/src/hooks/use-lead-form-autosave.ts:
  DEFAULT_DEBOUNCE_MS: 3000 → 5000
  onSuccess:
    - убрать invalidateLeadForm(qc, trpc)
    - вместо: qc.setQueryData(byPeriod.queryKey, (prev) => ({
        ...prev,
        section: { ...prev.section, ...response.patch },
      }))
    - invalidate только versions queryKey (не byPeriod)

apps/web/src/components/lead/lead-form.tsx:609 (auto-snapshot):
  убрать «каждые 10 saves» auto-snapshot
  оставить snapshot только на «значимых» событиях:
    - explicit Submit
    - manual «Create snapshot» button
  → version-counter не прыгает 4+ единиц на минуту правок

apps/web/src/components/lead/lead-form.tsx:1418-1427 (autosave badge):
  расширить visual states (inline hint):
    pending: «● Pending save…» (тусклый, статичный)
    saving:  «◐ Saving…» (spinner анимированный)
    saved:   «✓ Saved at HH:MM» (текущее)
    error:   «⚠ Save failed [Retry]» (с кнопкой retry)
```

### Шаг 9 — Волна 2 research (после commit 8, отдельная фаза)

После того как волна 1 (commits 1-8) на проверке у user — запустить
research-фазу для slide-redesign (#11-#17):

```text
parallel Haiku agents (single message, 4 calls):
  A. frontend-design skill → consult патtern «status-slide
     dashboard, dynamic groupings, metric pills»
  B. Context7 → search «react slide deck library 2026»,
     «notion dashboard layout patterns»
  C. WebSearch → «status report slide design 2026 examples»,
     «Linear weekly digest screenshot»
  D. Internal grep → найти все места где slide-frame используется,
     все callers heroControls/scope-toggle.

output → .planning/research/slide-redesign-2026-05-23.md:
  ## Reference patterns (5-10 image links / repos)
  ## Decision matrix (layout / metrics / scope-mode / pills)
  ## Recommended direction (3-4 предложения)
  ## Risk areas (что может сломать regression)

→ AskUserQuestion: approve direction Y/N/modify
→ если Y → single «slides redesign» commit с превью
→ если N → новая итерация research
```

## 4. Open questions — закрыты user-ом

| #   | Вопрос                                                           | Решение                                                                                            |
| --- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Какая модель autosave? A/B/C?                                    | **A** — smart debounce 5s + setQueryData patch (user confirmed 2026-05-23)                         |
| 2   | Wave 2 (#11-#17) — atomic / batch / research?                    | **research first** — research-фаза → approve direction → single commit (user confirmed 2026-05-23) |
| 3   | lock-chip tooltip multi-line?                                    | default `·` separator; multi-line только если useSdlcTooltip умеет                                 |
| 4   | Fill-from dialog: portal vs CSS?                                 | portal (как stage-chip popover)                                                                    |
| 5   | DevRoleSwitcher текст: спрятать?                                 | да, как Logout                                                                                     |
| 6   | seed 5 периодов: где менять?                                     | prisma/seed.ts; читаю перед правкой                                                                |
| 7   | StageMultiSelect: убрать ВСЁ `Scope:` или только когда selected? | только когда `selected.length > 0`; empty-state legend оставить                                    |
| 8   | #10 stage↔section bug — fix scope?                               | investigation first (5 шагов в commit 7); fix scope зависит от находок                             |

## 5. Execution flow

```text
WAVE 1 — atomic commits (form view fixes)
─────────────────────────────────────────
[commit 1: navbar icons-only]        ← #2  (~10 LoC)
   ↓ user проверяет
[commit 2: StageMultiSelect dup]     ← #6  (~10 LoC)
   ↓ user проверяет
[commit 3: lock-chip tooltip]        ← #4  (~10 LoC)
   ↓ user проверяет
[commit 4: Fill From dialog portal]  ← #3  (~30 LoC)
   ↓ user проверяет
[commit 5: seed 5 periods]           ← #5  (~30-50 LoC)
   ↓ user проверяет
[commit 6: Risk-Stage hint (MIN)]    ← #7  (~5 LoC)
   ↓ user проверяет
[commit 7: at-risk warn + corresp]   ← #8+#10 (~80-120 LoC + test)
   ↓ user проверяет
[commit 8: autosave A — debounce]    ← #1  (~80 LoC)
   ↓
[gates: typecheck + lint + test + build]
   ↓
[user re-UAT волны 1]
   ↓
WAVE 2 — slide redesign (#11-#17, research first)
─────────────────────────────────────────────────
[parallel research (4 Haiku агентов)]
   → .planning/research/slide-redesign-2026-05-23.md
   ↓
[AskUserQuestion: approve direction?]
   ↓ user OK
[commit 9: slides redesign (большой, ~300-500 LoC)]
   ↓
[gates + user re-UAT волны 2]
   ↓
WAVE 3 — cross-screen bug + audit (#18-#20)
───────────────────────────────────────────
[investigation #18: dashboard activity row]
   ↓
[commit 10: fix dashboard contentful detection + regression test]
   ↓ user проверяет
[audit pass: skeleton coverage (Haiku) → list пустых экранов]
   ↓
[clarify #20 с user: «что значит сопоставление?»]
   ↓ user уточнил
[commit 11: skeletons + #20 consistency fix (если bug)]
   ↓
[gates + user re-UAT волны 3]
```

После каждого коммита — короткий ответ user-у: «#N сделал, проверь в
браузере». User тестирует в реал-тайме.

## 6. Verification

После каждого коммита (минимум):

```bash
pnpm typecheck                          # 0 errors
pnpm lint                               # clean
```

После всех 8 коммитов волны 1:

```bash
pnpm test                               # 508+/508+ pass (+ new tests #8/#10)
pnpm lint:md                            # 0 errors
pnpm build                              # OK
```

Сценарии вживую (chrome-devtools MCP, headed на :3000):

```text
#  (a) navbar 1728×962: НЕ видно текста «Switch Role / Theme /
#      Language / Logout»; только иконки + accessible names.
#  (b) RiskEditDialog: открыть risk с >1 stage, выбрать 2-3 стадии —
#      убедиться нет дублирующего «Scope: <pill> <pill>» внизу.
#  (c) lock-chip: навести мышью на чужую (locked) стадию — tooltip явно
#      показывает «Locked — owned by <Name>».
#  (d) Fill From: открыть dropdown, нажать на период — dialog центрирован,
#      текст ВНУТРИ белой карточки. Тест на 1728×962 + 1024×768.
#  (e) seed 5 periods: после pnpm db:wipe — Fill From dropdown показывает
#      4 периода (Week 18, 19, 20, 21); включить ArchiveToggle — видно
#      Week 18 + 19 как archived; copy from archived period работает.
#  (f) #7 hint: helper-text под StageMultiSelect содержит «Tip: mark a
#      stage as blocked …»
#  (g) #8 cross-validation: помечаешь Support как at-risk БЕЗ Risks —
#      ⚠ icon появляется в углу chip-а + footer warning в RisksSection.
#  (h) #10 isolation: создать risk на Development в section A — section B
#      Development chip остаётся neutral (не at-risk).
#  (i) autosave (commit 8): поменять item-текст:
#        — «● Pending…» появляется немедленно;
#        — через 5s становится «◐ Saving…» (spinner);
#        — через ~1s становится «✓ Saved at HH:MM»;
#        — экран НЕ мерцает; version-counter НЕ прыгает 4+ единиц;
#        — недавно поменянная стадия НЕ откатывается.
```

После волны 2 (slides redesign, commit 9):

```text
#  (j) #11 дубль AgentReview: на slides только ОДИН AgentReviewComingSoon
#      (в hero), не два.
#  (k) #12 высота: переключение scope Own ↔ By product НЕ меняет высоту
#      slide-frame заметно.
#  (l) #13 alignment: item-text начинается с одной X-координаты независимо
#      от наличия priority pill.
#  (m) #14 layout: current/next и risks/decisions в 2 колонки, slide-frame
#      использует всё доступное полотно.
#  (n) #15 metrics: hover на «On-track %» показывает tooltip с источником
#      числа; tiles в стиле pills.
#  (o) #17 By-product: scope=product рендерится в slide-frame с hero,
#      не как отдельный grid снаружи.
```

## 7. Done definition

### Волна 1 (commits 1-8)

- [ ] commit 1: navbar — 3 (или 4 с DevRoleSwitcher) `<span hidden xl:inline>`
      удалены; sr-only оставлен; aria-label/title сохранены.
- [ ] commit 2: stage-multi-select — нижний `Scope: <pills>` удалён когда
      `selected.length > 0`; empty-state legend оставлен.
- [ ] commit 3: stage-chip locked-tooltip явно содержит «owned by <name>»
      и «no edit permissions» в читаемой форме.
- [ ] commit 4: Fill From dialog — overflow устранён (portal или CSS-fix);
      текст всегда внутри белой карточки на 1728×962 и 1024×768.
- [ ] commit 5: seed создаёт 5 периодов (2 archived, 3 active); Fill From
      dropdown показывает их корректно; archive toggle фильтрует.
- [ ] commit 6: stage-multi-select helper text расширен «Tip: mark a stage
      as blocked first» — MIN-вариант #7.
- [ ] commit 7: `deriveStageValidationWarnings` helper + ⚠ icon в stage-chip +
      footer summary в RisksSection; regression test для stage↔section
      isolation; investigation #10 завершено с конкретным fix scope.
- [ ] commit 8: autosave — debounce 5s, setQueryData patch вместо
      invalidate, auto-snapshot только на «значимых» событиях, badge
      states pending/saving/saved/error. Нет мерцаний; version-counter
      не прыгает.

### Волна 2 (research + commit 9)

- [ ] research memo `.planning/research/slide-redesign-2026-05-23.md`
      с reference patterns, decision matrix, recommended direction.
- [ ] user approved direction (AskUserQuestion после research).
- [ ] commit 9: slides redesign — #11 single AgentReview mount; #12 fixed
      height; #13 item alignment; #14 2-col layout; #15 cohesive metric
      pills с tooltips; #17 By-product в slide-frame с hero.

### Волна 3 (cross-screen, commits 10-11)

- [ ] commit 10: #18 fix — dashboard activity-row корректно отражает
      contentful state после submit; regression test «submit-section →
      dashboard activity contentful».
- [ ] skeleton audit pass: список экранов без skeleton'ов в
      `.planning/research/skeleton-audit-2026-05-23.md`.
- [ ] #20 clarify с user — понять что значит «сопоставление» и есть ли
      реальное расхождение.
- [ ] commit 11: #19 skeletons добавлены consistent во все слабые
      экраны; #20 fix (если bug найден) ИЛИ documentation note.

### Cross-cutting

- [ ] `pnpm typecheck / lint / test / build / lint:md` — все зелёные.
- [ ] chrome-devtools verification (a)…(o) пройдены вживую.
- [ ] Push в origin/main НЕ делаем (SSL заблокирован).
- [ ] `goals/accumulated-work-audit/` НЕ тронут.

## 8. Не входит в этот план (явно)

- Полоска у хеда с архивом — **уже сделано** (head-report-shell.tsx:96-105).
- STAGE-COLOR-SNAPSHOT — **уже сделано** (commit 263b50d).
- Любые новые features (Telegram, AI/RAG, dark theme, fonts).
- Push origin/main — SSL блокер.
- Любая работа в `goals/accumulated-work-audit/` — рабочая зона user-а.
- E2E spec automation — user сказал «E2E пока забьём».
- FULL-вариант #7 (фильтрация stages по chip status) — отдельная ветка
  после волны 2.
- Дальнейшие фидбэки, которые user пришлёт ПОСЛЕ начала execution — будут
  обработаны в новом цикле после текущих 9 коммитов.
