# Page Feedback Plan — `/lead/report/a0000000-0000-…` (shiny-eagle)

**Source:** 2026-05-19 UI annotations on `/lead/report/a0000000-0000-4000-8000-000000000001` (edit + `?mode=slides`).
**Mode:** Demo-plan rich-mode (parallel subagents, balanced cost).
**Plan id:** `shiny-eagle` (continuation of `pure-mist` UAT closure).

---

## 0. TL;DR

### Было

```text
EDIT mode (/lead/report)                          SLIDES mode (?mode=slides)
┌──────────────────────────────────────┐          ┌────────────────────────────────────────┐
│ Маркетинговый портал                 │          │ Blockers · Василий И · lead [3][1][3] │
│  ╴ stages — Дизайн · Разработка ...  │          │ ● Маркетинговый портал  ● CRM-360 ...  │
│  ╴ Other contributors                │          │                                        │
│    Борис С · stages — 3 items, 1 risk│          │ ┌─ Product 1 ─┐    ┌─ Product 2 ─┐    │
│                              readonly↗│          │ │ name        │    │ name        │    │
│                                       │          │ │ CURRENT     │    │ CURRENT     │    │
│ 🔒 Also contributing: Борис С. (4)   │          │ │  ...long... │    │  No current │    │
│                       readonly↗ Hide ▴│          │ │ RISKS       │    │ NEXT FOCUS  │ ← misaligned
│ ┌- dashed embed -─────────────────┐  │          │ │  ...        │    │  ...        │    │
│ │ 🔒 Борис С. — readonly          │  │          │ │ NEXT FOCUS  │    │ RISKS       │    │
│ │ <CurrentWeekSection readOnly/>  │  │          │ │  ...        │    │  No risks   │    │
│ └─────────────────────────────────┘  │          │ │ PRIORITIES  │    │ PRIORITIES  │    │
│ <CurrentWeekSection editable/>       │          │ │  ...        │    │  No prio    │    │
└──────────────────────────────────────┘          │ │ DECISIONS   │    │ DECISIONS   │    │
                                                  │ └─────────────┘    └─────────────┘    │
                                                  └────────────────────────────────────────┘
```

### Проблема

```text
F1 sdlc-pipeline foreign row          F2 dashed inline embed                F3 CrossAuthorHint scope        F4 slide layout
─────────────────────────────         ─────────────────────────             ─────────────────────────        ──────────────────────────────
"readonly ↗" — лишний текст           "📦 карточка" вокруг секции            живёт только в CW и NW           разные Y у CURRENT/RISKS/NEXT
агрегат "1 risk" без какой              ломает зрительное сравнение           Risks/Decisions/Priorities       16px body — слишком крупно
"0 items" ≡ "ещё не заполнено"        чужие строки не выглядят как            не подсвечивают чужие             нет fullscreen кнопки
                                       свои с readonly-маркером              нет multi-contributor seed       широкие пустоты "No current"
```

### Станет

```text
F1 sdlc-pipeline foreign row          F2 inline foreign rows                F3 чужие строки always-on       F4 slide grid + fullscreen
─────────────────────────────         ─────────────────────────             ─────────────────────────        ──────────────────────────────
без слова "readonly"                  убрать dashed-карточку,               Hint (index) во всех 5 секциях   фиксированные ряды на колонки:
chip per risk: ▲ Item X (blocked)     отрендерить тот же list,              БЕЗ Hide/Show: чужие строки      name → stages → chips →
chip per blocker, иконка пустой       пометить каждую строку 🔒+dim         всегда отрендерены inline        CURRENT → NEXT → RISKS → ...
                                                                            с 🔒+dim, multi-contributor      body 13px / title 28px
                                                                            seed: ≥2 readonly contributors   [⛶ Fullscreen]
                                                                                                             adaptive: N≤4 → 2col,
                                                                                                                       N=5-9 → 3col
```

### Pipeline фаз

```text
[P0 plan-self-review]──[P1 W1-pipeline]──[P2 W2-inline]──[P3 W3-hint-sweep]──[P4 W4-slide]──[P5 review]──[P6 commit]
                       │                  │              │                    │              │
                       └─ Haiku scan      └─ Haiku scan  └─ Haiku seed scan   └─ design      └─ /codex:review
                          Sonnet impl       Sonnet impl     Sonnet sweep         Sonnet impl    + pillar gate
```

> «От человека: одобрить две развилки внизу (centralized vs per-section toggle и slide N-handling). Всё остальное агент делает сам.»

---

## 1. Контекст

Пользователь дал четыре пачки UI-фидбэка на странице `/lead/report/<id>`:

- **F1.** `<SdlcPipeline>` рендерит «Other contributors» с агрегатом `3 items, 1 risk` и линком «readonly ↗». Пользователь видит, что (а) слово «readonly» лишнее — он смотрит SDLC чужого продукта, и так понятно; (б) количество рисков без указания **какого именно** — бесполезно; (в) «0 items» неотличимо от «ещё не заполнено».
- **F2.** Внутри `<AccordionSection>` для чужих авторов сейчас рисуется отдельная dashed-bordered «карточка» с заголовком `🔒 Борис С. — readonly` и вложенной `<CurrentWeekSection readOnly>`. Пользователь хочет, чтобы чужие пункты выглядели **как обычные строки списка**, но помечены readonly (замок, ослабленный контраст), а не отдельная коробка.
- **F3.** Полоска `🔒 Also contributing: Борис С. (4 items) readonly ↗ Hide ▴` нравится как «индекс». Просьба: (а) пример seed с **двумя** дополнительными контрибьюторами; (б) Hide/Show раскрывает inline-рендер чужих элементов (см. F2); (в) тот же паттерн в **Next Week, Risks/Blockers, Decisions, Priorities**; (г) подумать — общий «Show all» в toolbar или per-section.
- **F4.** На `?mode=slides` `<LeadSlideArticle>` (status-slide-deck.tsx:516) — секции продуктов сидят на разных вертикальных уровнях, шрифт 16px слишком крупный, нет полноэкранного режима, контент рискует не помещаться. Просят дизайн-аудит и переработку.

Этот план — продолжение `page-feedback-lead-report-a0000000-0000-pure-mist.md` (UAT-закрытие). Не дублирует F1–F13 оттуда; берёт оставшиеся «новые» куски обратной связи.

## 2. Сейчас

```text
branch        : main
last commits  : 1b3d1d4 F15 productSlides fix
                ffbdb3a F14 DB→UI shape mapping
                7815c58 F15+F16 slides scope toggle + visual upgrade
                3652ef6 F14 inline cross-author embeds
                7fbe2fd crossAuthorSections tRPC endpoint
dirty         : .planning/memory/*.md (auto-mirror — не трогаем)
                .planning/plans/page-feedback-lead-report-a0000000-0000-pure-mist.md (uat-closure draft)
                .planning/session-retros/NEXT-ACTIONS.md
clean         : apps/web, apps/api, packages/shared, prisma
target file   : .planning/plans/page-feedback-lead-report-a0000000-0000-shiny-eagle.md (этот)
```

## 3. Architecture context

```text
                     /lead/report/<id>                          /lead/report/<id>?mode=slides
                            │                                              │
                            ▼                                              ▼
                   apps/web/.../app/(app)/lead/report/[reportId]/page.tsx
                            │                                              │
                            ▼                                              ▼
                   <LeadForm mode="edit">                       <LeadForm mode="slides">
                            │                                              │
                            ▼                                              ▼
        ┌─ trpc.leadForm.crossAuthors ───────────────┐      <LeadSlidesClient> → <ReportSlides>
        │  trpc.leadForm.crossAuthorSections (F14)   │              │
        ▼                                            ▼              ▼
  <SdlcPipeline>             5× <AccordionSection>          <StatusSlideDeck mode="lead">
   (F1 fixes)                  ↑ <CrossAuthorHint>                  │
   ↑ stage chips                ↑ inline embed (F2)                 ▼
   ↑ Other contributors            (F2 + F3)                <LeadSlideArticle>  ← F4 redesign
```

**Backend contracts**

- `getCrossAuthors` (lead-form.prisma-repository.ts:444) — текущий aggregate `{itemCount, riskCount}` per `(projectId, authorId)`. Для F1 нужно расширить include до `risks: {select: {severity, text, projectId, stageNames}}` либо переключить F1 на `getCrossAuthorSections`.
- `getCrossAuthorSections` (lead-form.prisma-repository.ts:533) — уже отдаёт `items[]` и `risks[]` с полями. Используется F14 для inline embed; пригоден как single-source-of-truth.

**Design tokens на слайде** — отсутствуют. `.slide-frame` класс есть в JSX, но CSS-правила нет. Это даёт чистое поле для введения design-токенов (`--slide-row-h`, `--slide-pad`).

## 4. Recovered intent

| #   | Feedback                                      | Source DOM                                             | Workstream             |
| --- | --------------------------------------------- | ------------------------------------------------------ | ---------------------- |
| F1  | убрать слово readonly, показать какой risk    | `sdlc-pipeline.tsx:280–287` (Other contributors row)   | **W1**                 |
| F1  | empty-section ≠ filled-but-0-items            | `sdlc-pipeline.tsx:275–279` (aggregate)                | **W1**                 |
| F2  | убрать dashed-карточку, рендерить inline rows | `lead-form.tsx:1580–1596` + `accordion-section.tsx:71` | **W2**                 |
| F3  | Hint (index) для **всех** 5 секций            | `lead-form.tsx:1543, 1637, ~1645, ~1820, ~1910`        | **W3**                 |
| F3  | Чужие строки **always-on** (без Hide/Show)    | inline embed во всех 5 секциях                         | **W3** (Q1 ответ user) |
| F3  | multi-contributor seed                        | `prisma/seed.ts` / fixtures                            | **W3**                 |
| F4  | выровнять CURRENT/NEXT/RISKS/PRIORITIES/DECS  | `status-slide-deck.tsx:309–352`                        | **W4**                 |
| F4  | шрифты ramp 13/32                             | `status-slide-deck.tsx:187, 200, 295, 299`             | **W4**                 |
| F4  | Fullscreen button                             | новый — паттерн из `head-present-client.tsx:66–148`    | **W4**                 |
| F4  | N-products handling (4/6/9)                   | `section-slide-utils.ts:460` paginate                  | **W4** (open Q2)       |

## 5. Boundaries

- **Не трогать**: `apps/api/src/modules/report-sections/lead-form.prisma-repository.ts` структурно (только расширить return shape `getCrossAuthors` или переключить вызов F1 на `getCrossAuthorSections`); сидь production-данных; темизация (research-only по UI-rule).
- **Out-of-scope для shiny-eagle**: F1–F13 из pure-mist; полная переписка `LeadSlidesClient`; director-flow.
- **Stale directions**: dark mode, gradient rebrand — research-only, не реализуем.

## 6. Workstreams

### W1 — SdlcPipeline foreign-author row

**Цель.** Превратить «Other contributors» из техничной строки в визуально читаемый readonly-индикатор с per-risk детализацией и empty-state.

**Files.**

- `apps/web/src/components/lead/sdlc-pipeline.tsx:254–293` — JSX `Other contributors` row.
- `apps/web/src/components/lead/sdlc-pipeline.tsx:8–16` — расширить `CrossAuthorEntry` (add `risks: {severity, text}[]`, `isEmpty: boolean`).
- `apps/web/src/components/lead/lead-form.tsx:412–460` — мэппинг crossAuthors агрегирует `risks[]`/`isEmpty` из `crossAuthorSectionsQ.data` (уже доступно).
- (опционально) `apps/api/src/modules/report-sections/lead-form.prisma-repository.ts:444–531` — расширить include + return shape `getCrossAuthors` если не хватит данных из `getCrossAuthorSections`.

**Изменения.**

```text
Old (текст):                          New (визуальный chip-list):
  Борис С. · Dev · Test —             Борис С. · Dev · Test
     3 items, 1 risk     readonly↗      ├── ▲ blocked: «API контрагента нестабилен»
                                        ├── ▲ at-risk: «нет нагрузочных»
                                        └── (icon-only link →)

  Иван П. · QA —                       Иван П. · QA
     0 items         readonly↗            ⊘ ничего не заполнено  (icon-only link →)
```

- удалить текст `readonly ↗`, оставить **иконку `→`** (или `↗`) с `aria-label="Open ${authorName} section"`;
- per-risk chip: severity icon + truncate text до 60 символов;
- если `isEmpty` (никакой ReportSection не создан) — pill `⊘ not started` neutral grey;
- если `itemCount>0, riskCount=0` — pill `● N items` (без слова risk).

**Verification.**

- `pnpm --filter @customreport/web test -- sdlc-pipeline` (или snapshot test);
- regression Playwright: `pnpm test:e2e -- --grep "cross-author"`.

### W2 — Inline foreign rows (no dashed card)

**Цель.** Убрать визуальную коробку вокруг чужой секции; отрендерить тот же `ItemRow`/`RiskRow`, что и для своих, но с `readOnly + lockBadge + dim`.

**Files.**

- `apps/web/src/components/lead/lead-form.tsx:1580–1596` — удалить wrapper `<div className="rounded-xl border border-dashed ...">`; внутри map отдать **тот же** компонент `<CurrentWeekSection items=… readOnly />`, объединить foreign `items` со своими в общий список (с meta-полем `authorId`) либо рендерить их сразу под `Own` без визуального разделителя.
- `apps/web/src/components/lead/current-week-section.tsx` (и аналогичные `next-week-section`, `risks-section`, `decisions-section`, `priorities-section`) — расширить `Item` prop: `lockBadge?: {authorName: string}`. Item renders маленький `🔒` префикс + `text-muted-foreground`. Никаких dashed-borderов.
- `apps/web/src/components/report-shell/accordion-section.tsx` — без изменений; коробка существует только как обёртка секции, dashed-frame сейчас рисуется в `lead-form.tsx`.

**Acceptance.**

- Чужие строки выглядят как свои, но с `🔒 Борис С.` префиксом, цвет text `var(--color-muted-foreground)`, кнопки edit/delete `aria-hidden + disabled`;
- Drag-handle и hover-actions у чужих скрыты;
- При сворачивании Hide ▴ — чужие строки исчезают, свои остаются в исходных позициях.

### W3 — CrossAuthorHint sweep across all sections

**Цель.** Тот же hint+toggle с inline-разворотом во всех 5 секциях; поддержка нескольких контрибьюторов.

**Files.**

- `apps/web/src/components/lead/lead-form.tsx`:
  - **CW** ~1543 (есть);
  - **NW** ~1637 (есть);
  - **Risks** ~1645–1820 → добавить `<CrossAuthorHint contributors=risksContributors expandable expanded=showCARisks onToggleExpand=…/>` + рендер чужих риск-строк inline;
  - **Decisions** ~1820 → `decisionsContributors`;
  - **Priorities** ~1910 → `prioritiesContributors`.
- `apps/web/src/components/lead/cross-author-hint.tsx` — уже поддерживает `contributors[]` (массив); проверить, что при `contributors.length > 1` рендерятся **отдельные строки** (текущая реализация map'ит, ok).
- `prisma/seed.ts` — добавить тестового второго контрибьютора (`Борис` уже есть; добавить `Семён`) на shared product, чтобы UAT-репорт `a0000000-0000-4000-8000-000000000001` отображал 2 contributors в одной секции.

**Always-on foreign rows (Q1 решение).** Пользователь выбрал: «давай сразу показывать информацию о других людях». Это значит:

- удалить `expandable`/`expanded`/`onToggleExpand` props из `<CrossAuthorHint>` вызовов (оставить как index-only badge);
- удалить `showCAItems` state + `Show details ▾ / Hide ▴` кнопку из `cross-author-hint.tsx:72-81`;
- условие рендера inline foreign rows становится просто `crossAuthorSectionsQ.data && contributors.length > 0` (без `&& showCA*`);
- inline foreign rows показаны **по умолчанию** во всех 5 секциях, под `<CrossAuthorHint>` строкой, в стиле W2 (lock prefix + dim, без dashed-frame);
- порядок: сначала свои строки, ниже разделитель `<div className="my-2 border-t border-dashed border-[var(--color-border)]"/>` (тонкий), потом чужие строки с lock-префиксом.

**Verification.**

- Playwright: открыть `/lead/report/<id>` → во всех 5 секциях чужие строки **видны сразу** без клика;
- 2 contributors → 2 `🔒 Also contributing:` строки в hint stack + 2 группы inline rows;
- regression: existing F14 CW/NW тесты — обновить ассерты «click Show details → rows appear» на «rows visible by default».

### W4 — Slide redesign (LeadSlideArticle)

**Цель.** Выровнять секции по сетке, уменьшить body-шрифт, добавить fullscreen, корректно обработать N=4/6/9.

**Files.**

- `apps/web/src/components/slides/status-slide-deck.tsx:217–399` (`ProductSdlcGroups` + `LeadSlideArticle`) — переход на CSS Grid с **именованными рядами**:

  ```css
  grid-template-rows:
    [title] auto
    [stages] auto
    [chips] auto
    [current] minmax(56px, 1fr)
    [next] minmax(56px, 1fr)
    [risks] minmax(56px, 1fr)
    [priorities] minmax(56px, 1fr)
    [decisions] minmax(56px, 1fr);
  ```

  Каждая ячейка `overflow: hidden`, текст с `text-clamp: 3`.
- Typography ramp (status-slide-deck.tsx:187, 200, 295, 299):

  ```text
  title h3   : text-[28px] font-semibold leading-tight (было text-3xl/32px)
  stages line: text-[12px] font-medium tracking-[0.02em] (было text-sm/14px)
  section hdr: text-[11px] font-bold uppercase tracking-[0.08em] (как было)
  body item  : text-[13px] leading-snug (было text-[15px]/24px)
  empty state: text-[12px] italic muted (было text-sm)
  ```

- N-handling (`section-slide-utils.ts:460` `paginateSectionSlides`) — **adaptive (Q2 решение)**:
  - **N ≤ 4 на странице** → `grid-cols-2` (2×2), body 13px, title 28px;
  - **N = 5–9 на странице** → `grid-cols-3` (3×N rows), body **12px** (auto-reduce), title **24px**;
  - **N > 9** → paginate по 9 продуктов/страница;
  - реализовать через `productsPerPage` = 9 (вместо текущих 4), внутри `ProductSdlcGroups` динамический Tailwind: `${products.length <= 4 ? "grid-cols-2" : "grid-cols-3"}` + класс-вариант `slide-density-compact` для N≥5 с уменьшенным шрифтом.
- Fullscreen button:
  - новый компонент `apps/web/src/components/slides/slide-fullscreen-button.tsx` (15–30 строк): `requestFullscreen()` на root, `fullscreenchange` listener, icon swap `Maximize2 ⇄ Minimize2`;
  - смонтировать в `lead-slides-client.tsx:235–263` справа от scope toggle/pager;
  - keyboard: `f`/`F` toggles (повторить паттерн `head-present-client.tsx:80–97`).
- Design tokens — добавить в `apps/web/src/app/globals.css`:

  ```css
  --slide-pad: 24px;
  --slide-row-min: 56px;
  --slide-title-size: 28px;
  --slide-body-size: 13px;
  ```

**Verification.**

- Visual check via Chrome DevTools MCP: navigate to `?mode=slides`, screenshot pre/post;
- 4 products → выровнены по строкам, 1 viewport (1728×871), нет overflow;
- кнопка Fullscreen → `document.fullscreenElement === slideRoot`;
- Esc возвращает в обычный режим.

## 7. Subagent roadmap

| Stage | Agent        | Model                          | Scope (read-only / write)                                                                                                        | Output contract                                                                                        |
| ----- | ------------ | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 0     | Orchestrator | Sonnet (этот)                  | live repo state, GSD, intake                                                                                                     | этот план + final commit                                                                               |
| 1A    | scan-W1      | Haiku                          | read `sdlc-pipeline.tsx`, `lead-form.tsx:412–460`, `lead-form.prisma-repository.ts:444–531`                                      | список конкретных строк, нужных для расширения `CrossAuthorEntry`                                      |
| 1B    | scan-W2      | Haiku                          | read `lead-form.tsx:1540–1900`, `*-section.tsx` (5 файлов), `accordion-section.tsx`                                              | map: где сейчас рендерятся foreign items + где добавить `lockBadge` prop                               |
| 1C    | scan-W3      | Haiku                          | read `lead-form.tsx:382–500` (contributors maps), `prisma/seed.ts`                                                               | таблица: какой contributors map отсутствует для Risks/Decisions/Priorities + где сидеть второго автора |
| 1D    | scan-W4      | Haiku                          | read `status-slide-deck.tsx`, `lead-slide-hero.tsx`, `section-slide-utils.ts`, `head-present-client.tsx`                         | exact line ranges для CSS-grid, typography, fullscreen паттерн                                         |
| 2     | synthesizer  | Sonnet (этот)                  | merge четырёх scan-отчётов                                                                                                       | финальные diffs / file list / порядок коммитов                                                         |
| 3A    | impl-W1      | Sonnet                         | write `sdlc-pipeline.tsx`, `lead-form.tsx` (только rows ≤460)                                                                    | atomic commit `feat(web): F-shiny-1 sdlc-pipeline foreign row redesign`                                |
| 3B    | impl-W2      | Sonnet                         | write 5× `*-section.tsx` (add `lockBadge`), `lead-form.tsx:1540–1900`                                                            | commit `feat(web): F-shiny-2 inline foreign rows (drop dashed-frame)`                                  |
| 3C    | impl-W3      | Sonnet                         | write `lead-form.tsx` (4 hints), `prisma/seed.ts` (+1 contributor), conditional toolbar                                          | commit `feat(web): F-shiny-3 cross-author hint sweep + seed`                                           |
| 3D    | impl-W4      | Sonnet                         | write `status-slide-deck.tsx`, `lead-slide-hero.tsx`, `lead-slides-client.tsx`, new `slide-fullscreen-button.tsx`, `globals.css` | commit `feat(web): F-shiny-4 slide grid + typography + fullscreen`                                     |
| 4     | reviewer     | `/codex:review` (Codex strong) | pre-commit advisory на каждый из 4 коммитов                                                                                      | PASS/BLOCK + file:line findings                                                                        |
| 5     | verify       | Sonnet                         | `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e --grep "cross-author\|slide"`                                         | final report                                                                                           |

**Parallelism.** Stage 1A–1D — single message, 4 parallel Haiku calls. Stage 3A–3D — может идти parallel **только если** Stage 2 синтез подтвердил отсутствие пересечений по файлам (`lead-form.tsx` пересекается между 3A/3B/3C → нужно sequential для этого файла). Минимум 3D можно гнать параллельно с 3A.

## 8. Token economy

| Work                        | Model                 | Rationale                          |
| --------------------------- | --------------------- | ---------------------------------- |
| 4 scan agents               | Haiku                 | grep + read, классификация         |
| 1 design audit (уже сделан) | Sonnet                | визуальный анализ скриншота        |
| 4 impl agents               | Sonnet                | scoped writes ≤ 200 строк каждый   |
| 4 reviewer calls            | Codex GPT-5 (default) | advisory pre-commit                |
| Synthesis / план            | Sonnet (этот)         | без deep                           |
| Opus                        | **не используем**     | нет verified architecture conflict |

Iteration reserve: ~15% контекста под self-review шаги + один follow-up Haiku запрос, если на reviewer-фазе всплывут unknown'ы.

## 9. Я делаю сам / От тебя

```text
─────────────────────────────────────
✓ Я ДЕЛАЮ САМ
─────────────────────────────────────
  ├── scan W1–W4 (4 параллельных Haiku)              ← next
  ├── синтез + поиск файловых конфликтов              ← step 2
  ├── impl W4 (slide) параллельно с W1                ← step 3a
  ├── impl W1 → W2 → W3 sequential по lead-form.tsx   ← step 3b
  ├── /codex:review на каждый коммит                  ← step 4
  ├── pnpm typecheck + lint + test + e2e              ← step 5
  ├── 4 atomic commits на main или fix/* branch       ← step 6
  └── push origin (если не блокирует SSL)             ← step 7

─────────────────────────────────────
▲ ОТ ТЕБЯ (две развилки до старта)
─────────────────────────────────────
  ├── Q1: centralized "Show foreign" в toolbar — да/нет?  ← решение
  └── Q2: при N=5-9 продуктов — 3-column×N pages или
          2-column×N pages? (плотность vs читаемость)     ← решение
```

## 10. Open questions with defaults

| #   | Question                                          | Default / Status                  | Когда эскалирую                |
| --- | ------------------------------------------------- | --------------------------------- | ------------------------------ |
| Q1  | ~~Centralized toggle vs per-section~~             | **РЕШЕНО: always-on, без toggle** | —                              |
| Q2  | ~~Layout slide при N=5-9~~                        | **РЕШЕНО: adaptive 2col/3col**    | —                              |
| Q3  | Risk chip text truncate length                    | **60 символов + tooltip**         | если user просит full text     |
| Q4  | Slide fullscreen — browser API или CSS-only       | **browser `requestFullscreen()`** | если Safari edge-case всплывёт |
| Q5  | Ветка — `main` или новый `fix/PRJ-2/shiny-eagle`? | **новый fix-ветка → PR**          | если user скажет «на main»     |

## 11. Verification (запускается на stage 5)

```bash
# 1. Type / lint
pnpm typecheck
pnpm lint
pnpm lint:md

# 2. Unit / snapshot
pnpm test
pnpm --filter @customreport/web test -- sdlc-pipeline cross-author-hint

# 3. Regression e2e
pnpm test:e2e
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts \
  --grep "cross-author|slide|readonly"

# 4. Visual smoke (Chrome DevTools MCP)
#   а) /lead/report/<id>           → ≥2 contributors hint строки, lock-префикс на inline-rows
#   б) /lead/report/<id>?mode=slides → выровненные ряды, кнопка ⛶, font 13px body
#   в) ⛶ → document.fullscreenElement === root
```

**Acceptance gates.**

- Все 4 коммита проходят `/codex:review` без BLOCK.
- В DOM нет текста `"readonly ↗"` ни в SdlcPipeline foreign row, ни внутри inline embed.
- На слайде CURRENT/NEXT/RISKS/PRIORITIES/DECISIONS у двух колонок имеют одинаковый `getBoundingClientRect().top`.
- `pnpm lint` показывает `грep -nE '[а-яА-Я]'` совпадения только в data/comments/tests (правило UI-strings).

## 12. Iteration reserve / self-review checklist

- [ ] Plan TL;DR читается без чтения остального? (Было / Проблема / Станет — да)
- [ ] Каждая workstream имеет file:line якоря? (W1 ✓ W2 ✓ W3 ✓ W4 ✓)
- [ ] Subagent table содержит model tier + scope + output contract? (✓)
- [ ] Token economy без Opus без verified conflict? (✓)
- [ ] Open questions имеют defaults? (Q1–Q5 ✓)
- [ ] Verification содержит конкретные команды + acceptance? (✓)
- [ ] Не возрождает stale directions (dark mode, director flow)? (✓ — explicitly out-of-scope)
- [ ] Не пересекается с pure-mist scope? (✓ — pure-mist = F1–F13 UAT closure; shiny-eagle = новые 4 пункта)

## 13. Skill routing

| Skill                            | Зачем                                                 | Возвращает                                                     |
| -------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------- |
| `Demo-plan` rich-mode             | каркас плана + Mermaid/ASCII discipline               | этот документ                                                  |
| `design-audit` (mental)          | 6-pillar audit слайда                                 | Direction/Hierarchy/Typography таблица (см. agent-report выше) |
| `web-design-guidelines`          | typography ramp, brand palette                        | 13/28/11px scale                                               |
| `bencium-controlled-ux-designer` | стиль аккуратной презентации                          | aligned-grid идея                                              |
| `react-best-practices`           | props контракт `lockBadge`                            | сохранить immutable item shape                                 |
| `chrome-devtools-mcp`            | visual smoke до/после на /lead/report?mode=slides     | screenshot + DOM rect                                          |
| `/codex:review`                  | pre-commit advisory на 4 коммита                      | PASS/BLOCK + findings                                          |
| `Demo-verify` (если phase)        | 0–100 rubric — **пропускаем**, нет milestone closeout | —                                                              |

Сознательно **не используем**: `gsd-*` (это не GSD phase), `Demo-confluence`/`Demo-jira` (нет ticket), `gsd-eval-review` (нет AI eval), Opus/deep model.

---

**Файлов под измение:** 8 (4 секции \*-section.tsx, sdlc-pipeline, lead-form, status-slide-deck, lead-slides-client, lead-slide-hero, section-slide-utils, prisma/seed.ts, globals.css, новый slide-fullscreen-button.tsx).

**Ожидаемый суммарный diff:** ~600–900 LOC across 4 atomic commits.

**Risk register (▲ low / ▲▲ medium / ▲▲▲ high):**

- ▲▲ `lead-form.tsx` пересечение между W1/W2/W3 — митигировано sequential порядком 3A→3B→3C.
- ▲ Slide fullscreen в iframe (preview-mode) может быть отклонён браузером — fallback CSS overlay, обработать promise reject.
- ▲ Seed change может сломать существующие e2e fixtures — проверить `e2e/regression/**` на хардкод имён contributors.
