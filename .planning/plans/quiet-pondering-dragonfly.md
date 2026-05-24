# UAT Feedback Sweep #2 — Plan (v8.4.2)

> **Скоп:** 6 новых пунктов после ручного UAT (v8.4.1 уже зашит).
> Главные темы — Stage ↔ Risk двунаправленный sync, дубль `Current` маркера,
> AgentReview в слайдах, баг с залипшим `Version 1`, и редизайн слайда с
> учётом variable text density.
>
> Старый плановый документ (UAT Feedback Sweep v8.4.1) уже отгружен и
> закрыт коммитами в этой же ветке `fix/PRJ-2/shiny-eagle`. Этот файл
> переиспользует слот для v8.4.2.

---

## 0. Контекст: почему этот план

После того как v8.4.1 (10 пунктов UAT) полностью зашит и pushed в
`fix/PRJ-2/shiny-eagle`, пользователь прошёл повторный manual UAT и собрал
следующую волну feedback'а:

1. **Stage ↔ Risk sync асимметричный.** Risk-диалог уже умеет «pre-select all
   owned stages» (`risk-edit-dialog.tsx:86-93`), но не показывает что
   произойдёт, и не подсказывает что выбранный stage будет помечен at-risk /
   blocked. И наоборот — при mark-as-blocked в SDLC chip пользователь не
   видит связи с risk-объектом.
2. **Dublicate Current marker.** Зелёная точка-bage у `Current` в
   `period-navigator.tsx` дублирует текстовый суффикс `(Current)` в option
   labels. Лишний визуальный шум.
3. **AgentReview placement в slides.** Пользователь хочет, чтобы AgentReview в
   режиме слайдов был «точно так же как в Edit» — один control в page header
   рядом с Fullscreen, а не внутри hero-блока слайда.
4. **Stale Version 1 · 19:09 badge.** В каком-то месте UI рендерит «Version 1»
   тогда как `VersionHistoryNav` рядом показывает «v4». Источник badge не
   найден (sdlc-tooltip — это просто wrapper); требует grep.
5. **Slide redesign.** Текущий 2x2 grid `auto-rows-fr` визуально «едет» при
   разной text density — пустые секции, средние, и переполненные выглядят
   несогласованно. Нужен multi-scale audit перед редизайном.
6. **Variable text density / автодетализация.** Дизайн должен корректно
   масштабироваться при sparse / medium / heavy content per секция.

Дополнительно: ui-ux-pro-max skill вернул паттерн **Data-Dense Dashboard**
(Fira Code/Sans, status colors, content-dense grid) — учесть в Phase 4.

---

## 1. TL;DR

### 1.1 Было / Проблема / Станет

```text
было                                          │  станет
──────────────────────────────────────────────│──────────────────────────────────
1. Risk dialog: silent pre-select             │  preselect + consequence-hint
   нет визуальной связи с SDLC chip           │  «эти этапы будут at-risk/blocked»
                                              │
2. Period chip: «May 18–24 (Current)» +       │  только «(Current)» в label;
   зелёная точка-badge рядом (дубль)          │  badge удалён
                                              │
3. Slides: AgentReview compact в hero-блоке   │  AgentReview в page-header
   (рядом со ScopeToggle и tone pill)         │  рядом с Fullscreen (как в Edit)
                                              │
4. «Version 1 · 19:09» где-то залип на v1     │  badge читает actual version
   при actual v4                              │  из useReportVersionSummary()
                                              │
5. Slide 2x2: пустые / средние / тяжёлые      │  фиксированная grid topology,
   секции ломают визуальный ритм              │  стабильна на 3 density levels
                                              │
6. Нет density-теста дизайна                  │  multi-scale audit (3 density
                                              │  × 3 viewport) перед редизайном
```

### 1.2 Diagnostic note: 4 latent canonicalization gaps

В рамках v8.4.1 был коммит 22d75a77 `fix(stage-tags): canonicalize stage
names in riskCoversStage`. Explore показал — этим коммитом закрыт только ОДИН
call-site (`riskCoversStage`). Остаются 4 точки, где `STAGE_ALIAS` обходится:

| #   | File:line                      | Bug                                                                                                  |
| --- | ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| L1  | `sdlc-pipeline.tsx:97-115+257` | `riskCountByKey` строит ключи без `canonicalStageName` → один stage Dev/Development = 2 разных ключа |
| L2  | `lead-form-sync-bridge.tsx:86` | `riskStageKeys` читает `risk.stageName` (legacy CSV), не `risk.stageIds`                             |
| L3  | `risk-edit-dialog.tsx:152-153` | `deriveSeverityFromStages`: `selectedStageIds.includes(s.stageName)` — нет canonical                 |
| L4  | `risks-section.tsx:161+169`    | Display chips рендерятся raw из `risk.stageIds`                                                      |

Эти баги латентные (UI работает корректно когда seed канонический), но
рискуют sky-rocket при ручном UAT с mixed-case stage names. Чиним заодно в
Phase 3 рамках Stage ↔ Risk sync работ.

### 1.3 Pipeline фаз

```text
[P1 data-fix]──[P2 placement]──[P3 sync+latent]──[P4 redesign]──[P5 verify]
 #2 dup badge   #3 AgentReview   #1 stage<->risk   #5 slide       all manual
 #4 Version     placement        + L1-L4 latents   redesign       UAT 6 cases
 stale find                                        (2-step)
```

P1, P2 параллелятся (разные файлы). P3 — самая объёмная фаза. P4 разбита на
4a (audit) + 4b (redesign). P5 — финальная верификация.

---

## 2. Сейчас (live state)

```text
branch:       fix/PRJ-2/shiny-eagle  (in sync с origin)
ahead main:   ~190 коммитов (после v8.4.1)
PR:           #7 in_review (milestone v8.3 → переименовать в v8.4)
dirty:        .planning/session-retros/NEXT-ACTIONS.md  (unrelated)
              .planning/plans/quiet-pondering-dragonfly.md  (этот план)
              goals/accumulated-work-audit/  (unrelated)
last v8.4.1:  patch shipped (10 items), pushed origin
```

---

## 3. Архитектура изменений — по файлам и фазам

### Phase 1 — Data fixes (parallel-safe)

#### #2 Drop redundant Current badge

**Текущее:** `period-navigator.tsx:99` рендерит inline зелёный badge
`<span className="bg-emerald-50 text-emerald-700">Current</span>` СЛЕВА от
native `<select>`. Внутри select каждый option уже имеет суффикс `(Current)`
(добавлено в v8.4.1).

**Fix:** Удалить inline badge. Оставить только textual `(Current)` в option
label.

- Файл: `apps/web/src/components/lead/period-navigator.tsx`
- Удалить: lines ~88-105 (badge JSX + `currentOptionValue` derivation если
  больше нигде не используется).
- Тест: `period-navigator.test.tsx` — обновить snapshot, проверить что
  `(Current)` suffix остался.

#### #4 Find + fix stale Version badge

**Симптом:** где-то рендерится `Version 1 · 19:09` тогда как актуальная
версия v4. Источник неизвестен — sdlc-tooltip.tsx:61:72 это просто React
wrapper.

**Discovery commands:**

```bash
git grep -nE 'Version\s+[0-9]+' apps/web/src
git grep -nE 'version\s*[0-9]+\s*·' apps/web/src
git grep -n 'useReportVersionSummary\|useDraftSnapshotMeta' apps/web/src
```

Кандидаты для проверки:

| Файл                              | Что искать                                     |
| --------------------------------- | ---------------------------------------------- |
| `lead-slides-client.tsx`          | hero-блок может рендерить metadata от snapshot |
| `lead-slide-hero.tsx`             | «время + версия» под title                     |
| `version-badge.tsx` (если есть)   | candidate компонент                            |
| `draft-status-bar.tsx`            | bar с временем/версией                         |
| `report-meta-row.tsx` (если есть) | row под title                                  |

**Fix:** Когда источник найден, заменить hardcoded или snapshot-stale value
на чтение `currentVersion` из `useReportVersionSummary()` (тот же hook,
который питает `VersionHistoryNav`). Если badge живёт в server component —
прокинуть через props из родителя, который уже знает actual version.

**Тест:** Playwright scenario — открыть report где `versions.length === 4`,
проверить что badge показывает `Version 4`.

### Phase 2 — AgentReview placement

#### #3 AgentReview из slides hero в page header

**Текущее** (`lead-slides-client.tsx:165`):

```tsx
const scopeControls = (
  <div className="flex items-center gap-3">
    <ScopeToggle ... />
    <AgentReviewComingSoon compact />  // ← один instance, prop-drilled
  </div>
);
// scopeControls передаётся как heroControls prop в LeadSlideHero
```

**Architecture choice (рекомендую B):**

| Вариант                                     | Цена           | Эффект                                                                    |
| ------------------------------------------- | -------------- | ------------------------------------------------------------------------- |
| A drop completely                           | minimal        | теряем slides-AgentReview entry-point                                     |
| B (рекомендую) move to ReportSlides toolbar | +1 prop wiring | AgentReview рядом с Fullscreen (как в Edit), один visual home для feature |
| C duplicate в page header AND hero          | confusing      | две кнопки одного и того же действия                                      |

**Реализация B:**

- В `lead-slides-client.tsx`: убрать `<AgentReviewComingSoon compact />` из
  `scopeControls`. ScopeToggle остаётся в `heroControls`.
- В `ReportSlides` / `StatusSlideDeck` (тот, что владеет toolbar с
  Fullscreen): принять prop `toolbarRightControls` или подобный slot и
  смонтировать туда `<AgentReviewComingSoon />` (не compact).
- Проверить что в Edit mode `lead-form.tsx:1431-1448` AgentReview уже там
  где надо (после v8.4.1 #2 swap) — не трогать.

### Phase 3 — Stage ↔ Risk bidirectional sync + latent fixes

#### #1 Bidirectional sync + consequence preview

**Текущее поведение (asymmetric):**

```text
Risk dialog → SDLC chip:
  user выбирает stages в RiskEditDialog
    → onConfirm пишет risk.stageIds[]
    → sync bridge запускает computeUnbackedStages
    → SDLC chip перекрашивается в at-risk / blocked

SDLC chip → Risk dialog:
  user меняет chip status в pipeline
    → НИЧЕГО не происходит с существующими risks
    → если user открывает «add risk», stages pre-selected согласно ownership,
      но не согласно current chip status
```

**Желаемое:**

- При открытии RiskEditDialog (создание нового): pre-select stages, у
  которых текущий effective status = at-risk OR blocked (из
  `Item.stageStatuses` + existing risks).
- Под `StageMultiSelect` показать consequence-hint:
  «Selected stages will be marked at risk» / «will be marked blocked» в
  зависимости от выбранного `severity` toggle.
- При снятии чека со stage в edit-dialog (если этот stage был at-risk ТОЛЬКО
  из-за этого risk) — показать hint «This stage will return to On Track».

**Файлы:**

| Файл                           | Изменение                                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `risk-edit-dialog.tsx:86-93`   | preselect: брать stages с effective status `at-risk` или `blocked`, не только owned                                                              |
| `stage-multi-select.tsx`       | новый prop `previewSeverity?: "at-risk" \| "blocked"` + новый prop `currentStatusByStage?: Record<string, StageStatus>`; render consequence-hint |
| `risk-edit-dialog.tsx:358-374` | прокинуть новые props                                                                                                                            |

**Hint pattern (re-use существующий):** `stage-multi-select.tsx:36-46`
уже имеет inline helper text внизу — добавить туда conditional hint:

```tsx
{
  previewSeverity && value.length > 0 && (
    <p className="mt-1 text-xs text-amber-700">
      {previewSeverity === "blocked"
        ? `These stages will show as Blocked: ${value.join(", ")}`
        : `These stages will show as At Risk: ${value.join(", ")}`}
    </p>
  );
}
```

#### L1-L4 latent canonicalization gaps

Исправляем все 4 точки в одной фазе, чтобы избежать новых regressions:

| #   | File:line                      | Fix                                                                                                                |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| L1  | `sdlc-pipeline.tsx:97-115+257` | в `riskCountByKey` reduce: `key = canonicalStageName(stageId)`                                                     |
| L2  | `lead-form-sync-bridge.tsx:86` | переключить read с `risk.stageName` на `risk.stageIds[].map(canonicalStageName)`                                   |
| L3  | `risk-edit-dialog.tsx:152-153` | в `deriveSeverityFromStages`: `selectedStageIds.map(canonicalStageName).includes(canonicalStageName(s.stageName))` |
| L4  | `risks-section.tsx:161+169`    | display chips: `risk.stageIds.map(canonicalStageName)` перед render                                                |

**Тест:** в `lead-form-sync-bridge.test.ts` добавить case
«mixed-case stage names Dev/Development»: risk created с `stageIds: ["dev"]`,
item имеет `stageStatuses: { Development: "blocked" }` → pipeline должен
показать ОДИН blocked chip, не два.

### Phase 4 — Slide redesign (TWO-step)

#### 4a. Multi-scale consolidation audit (БЕЗ кода)

**Цель:** до редизайна понять как существующий 2x2 grid `auto-rows-fr` ведёт
себя на разных density / viewport комбинациях. Аудит — markdown отчёт, не
PR.

Density levels (создать seed-cases):

| Level  | Content per section                   |
| ------ | ------------------------------------- |
| Sparse | 0-1 items на 4 секции                 |
| Medium | 2-3 items, 1-2 risks/decisions        |
| Heavy  | 4 items (MAX), 3+ risks, 2+ decisions |

Viewports:

| Viewport             | Use case                            |
| -------------------- | ----------------------------------- |
| 1280×800             | laptop standard                     |
| 1728×1080            | desktop large                       |
| Fullscreen 1920×1080 | presentation mode (`:fullscreen_&`) |

**Deliverable:** `.planning/notes/slide-density-audit-2026-05-25.md` с
3×3 матрицей screenshot-эвиденса + ASCII-таблица «что ломается»:

```text
                Sparse   Medium   Heavy
1280×800        ?        ?        ?
1728×1080       ?        ?        ?
Fullscreen      ?        ?        ?
```

**Метод:** Playwright скрипт автоматически открывает 9 комбинаций,
screenshots сохраняет в `.planning/notes/slide-density/`. Запускается из
`tools/uat-screenshots/` (там уже есть скаффолд).

#### 4b. Redesign — incorporates ui-ux-pro-max Data-Dense Dashboard

После audit принимаем решение по 3-м направлениям:

1. **Топология grid:**
   - текущий: `grid grid-cols-2 auto-rows-fr` (2x2 fixed)
   - кандидат A: 4-row vertical stack (предсказуемая height, нет «pull-right»
     overflow)
   - кандидат B: 2x2 с `min-h-[200px]` и явным truncation (`line-clamp-3` per
     item)
   - кандидат C (ui-ux-pro-max): content-dense column-grid с category-icons
     слева, как в monitoring dashboard
2. **Typography scale:**
   - текущий: `text-[11px]` для items
   - ui-ux-pro-max рекомендует: Fira Sans для body, Fira Code для status
     codes / counts, tabular-nums везде где численные данные
3. **Status / severity colors:**
   - текущий: emerald (on-track), amber (at-risk), red (blocked) — adhoc
   - ui-ux-pro-max: token-based palette из CSS variables с явными
     `--status-ontrack`, `--status-atrisk`, `--status-blocked`

**Решение по shipping 4b:**

| Вариант                     | Когда                             | Цена                           |
| --------------------------- | --------------------------------- | ------------------------------ |
| Ship в v8.4.2               | если audit показал критичные баги | +большая PR, риск регрессии    |
| Defer в v8.4.3 (рекомендую) | если audit показал косметику      | v8.4.2 fast-ship, фокус на 1-5 |

См. open question #1 ниже.

### Phase 5 — Verify

```bash
pnpm typecheck
pnpm lint
pnpm --filter @customreport/web test
pnpm --filter @customreport/api test
pnpm --filter @customreport/web test:e2e -- lead-form
pnpm --filter @customreport/web test:e2e -- slides
pnpm --filter @customreport/web test:e2e -- version-history
```

Ручные сценарии:

| #   | Scenario                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------ |
| 1   | Open RiskEditDialog с blocked stage в SDLC → stage pre-checked, hint виден                             |
| 2   | Period select: текстовый «(Current)», нет зелёной точки                                                |
| 3   | Slides: AgentReview справа от Fullscreen в toolbar, НЕ в hero                                          |
| 4   | Open report с v4: badge показывает «Version 4», не «Version 1»                                         |
| 5   | Slides: 3 density × 3 viewport — отсутствие визуальных breaks (если 4b shipped)                        |
| 6   | Risk с `stageIds: ["dev"]` + Item с `stageStatuses.Development: "blocked"` → ОДИН blocked chip, не два |

---

## 4. Файлы по фазам

| Фаза | Файл                                                                                 | #   |
| ---- | ------------------------------------------------------------------------------------ | --- |
| P1   | `apps/web/src/components/lead/period-navigator.tsx`                                  | 2   |
| P1   | `apps/web/src/components/lead/period-navigator.test.tsx`                             | 2   |
| P1   | TBD после discovery grep                                                             | 4   |
| P1   | playwright spec для Version badge                                                    | 4   |
| P2   | `apps/web/src/components/slides/lead-slides-client.tsx`                              | 3   |
| P2   | `apps/web/src/components/slides/status-slide-deck.tsx` или ReportSlides toolbar slot | 3   |
| P3   | `apps/web/src/components/lead/stage-multi-select.tsx`                                | 1   |
| P3   | `apps/web/src/components/lead/risk-edit-dialog.tsx`                                  | 1   |
| P3   | `apps/web/src/components/lead/sdlc-pipeline.tsx` (L1)                                | 1   |
| P3   | `apps/web/src/components/lead/lead-form-sync-bridge.tsx` (L2)                        | 1   |
| P3   | `apps/web/src/components/lead/risks-section.tsx` (L4)                                | 1   |
| P3   | `apps/web/src/components/lead/lead-form-sync-bridge.test.ts`                         | 1   |
| P4a  | `.planning/notes/slide-density-audit-2026-05-25.md`                                  | 5,6 |
| P4a  | `tools/uat-screenshots/slide-density-matrix.ts`                                      | 5,6 |
| P4b  | (TBD после audit) `lead-unified-slide.tsx`, `slide-product-chips.tsx`, CSS tokens    | 5,6 |
| P5   | run tests + UAT manual sweep                                                         | —   |

---

## 5. Subagent roadmap

| Stage | Agent                         | Tier       | Scope                                     | Output                                    |
| ----- | ----------------------------- | ---------- | ----------------------------------------- | ----------------------------------------- |
| 0     | Orchestrator                  | Opus 4.7   | план + integration + final commits        | этот файл                                 |
| 1a    | discovery-version-badge       | Haiku      | grep + classify call-sites                | `.planning/notes/version-badge-source.md` |
| 1b    | discovery-period-badge        | Haiku      | confirm badge removal scope               | один-line confirm                         |
| 2     | implementer-p1-p2             | Sonnet 4.6 | P1 + P2: badge removal + AgentReview move | code + tests                              |
| 3     | implementer-p3                | Sonnet 4.6 | P3: stage<->risk sync + 4 latents         | code + tests                              |
| 4a    | audit-slide-density           | Sonnet 4.6 | Playwright multi-scale screenshots        | markdown report                           |
| 4b    | implementer-p4b (CONDITIONAL) | Sonnet 4.6 | redesign — только если в v8.4.2           | code + tests                              |
| 5     | verifier                      | Sonnet 4.6 | typecheck + lint + tests + e2e            | gate report                               |

Stage 2 и 3 — параллельно (нет file overlap). Stage 4a — параллельно с
2 и 3 (только Playwright + markdown). Stage 4b — после 4a + decision gate.

---

## 6. Token economy

| Stage | Model      | Est. tokens        | Why                                                 |
| ----- | ---------- | ------------------ | --------------------------------------------------- |
| 0     | Opus 4.7   | ~18k               | orchestration + plan revision + merge               |
| 1a-b  | Haiku      | ~3k each           | grep + classify                                     |
| 2     | Sonnet 4.6 | ~15k               | 4 файла, 2 теста                                    |
| 3     | Sonnet 4.6 | ~25k               | 6 файлов, 1 test pass с alias case                  |
| 4a    | Sonnet 4.6 | ~12k               | Playwright spec + 9 screenshots + markdown analysis |
| 4b    | Sonnet 4.6 | ~35k (CONDITIONAL) | redesign 2-3 компонента + CSS tokens                |
| 5     | Sonnet 4.6 | ~10k               | run tests                                           |

Opus только для orchestration. Default — Sonnet implementation, Haiku
discovery.

---

## 7. Agent does / Human does

```text
┌──────────────────────────────────────────────────────┐
│ ✓ AGENT ДЕЛАЕТ САМ                                   │
│   ├── все 6 правок в коде (P1-P3, + 4b если ship)    │
│   ├── 4a density audit + screenshots                 │
│   ├── pnpm typecheck, lint, test                     │
│   ├── e2e regression sweep                           │
│   ├── git commit per phase + push                    │
│   ├── update .planning/STATE.md (v8.4.2 entry)       │
│   └── update NEXT-ACTIONS.md                         │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│ ▲ ОТ ТЕБЯ                                            │
│   ├── ответить на 2 open questions ниже              │
│   ├── approve этого плана (ExitPlanMode)             │
│   ├── после P4a — посмотреть density-audit report и  │
│   │   принять решение ship/defer 4b                  │
│   ├── после P5 — manual UAT 6 сценариев              │
│   └── approve merge PR #7 (если ship 4b → новый PR)  │
└──────────────────────────────────────────────────────┘
```

---

## 8. Locked decisions + remaining defaults

**LOCKED (отвечено до approve):**

| #   | Вопрос                                   | Решение                                                                              |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| 1   | Slide redesign 4b — в v8.4.2 или v8.4.3? | **DEFER в v8.4.3** после density audit. v8.4.2 ships только 1-5 + audit-отчёт (P4a). |
| 2   | AgentReview placement — A / B / C?       | **B: toolbar в ReportSlides рядом с Fullscreen.** ScopeToggle остаётся в hero.       |

**Defaults (агент решает по ходу, эскалирует только при сюрпризе):**

| #   | Вопрос                                                     | Default                                                  | Когда эскалировать                 |
| --- | ---------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------- |
| 3   | Version badge discovery — если найдено >1 источника?       | fix ВСЕ найденные, не только тот, что в feedback         | если >3 источника → отдельный todo |
| 4   | Density audit — Playwright или ручные скрины?              | Playwright (воспроизводимо)                              | если headless падает               |
| 5   | Канонизация — пересоздавать seed с mixed-case stage names? | НЕТ — seed остаётся canonical, тесты добавляют edge case | если seed уже mixed-case           |

---

## 9. Iteration reserve

- Self-review между P3 и P4: smoke test stage<->risk sync на seed Vasily +
  один manual case с blocked PROD_CRM stage.
- Evidence refresh: перед P4a пересмотреть текущие mockups и retro
  screenshots (`.planning/session-retros/`) — может уже есть density data.
- Token reserve: ~30% бюджета Sonnet под 4b если решим ship.

---

## 10. Не трогать

- v8.4.1 коммиты — уже зашиты, не rebase / не amend.
- Production docker (`docker-compose.prod.yml`) — kill-port только в dev.
- Migrate service (`customreport-migrate-1`) — pinned, не трогаем.
- `apps/web/src/components/head/**` — head-report не в скопе.
- Versioning model (Prisma schema, ReportSnapshot) — не трогаем, только UI
  чтение currentVersion в P1 #4.
- TODO(STAGE-NAMING-01) — переименование `stageIds → stageNames` остаётся
  deferred (125 sites, 28 файлов; не в скопе v8.4.2).

---

## 11. Boundaries

- Только UI lead-формы (edit + slides) + risk-dialog + period-navigator.
- Без изменений в auth, dashboard, head-report.
- Без миграций schema.
- Без новых компонентов кроме `StageMultiSelect` props expansion.
- 4b — если ship, ТОЛЬКО visual / typography / grid topology, БЕЗ изменения
  underlying data contracts.

---

## 12. Проверка

### 12.1 Автоматические gates

```bash
pnpm typecheck                                              # 0 errors
pnpm lint                                                   # 0 errors
pnpm --filter @customreport/web test                        # all PASS
pnpm --filter @customreport/api test                        # all PASS
pnpm --filter @customreport/web test:e2e -- lead-form       # PASS
pnpm --filter @customreport/web test:e2e -- version-history # PASS
pnpm --filter @customreport/web test:e2e -- slides          # PASS
```

Новые тесты:

- `period-navigator.test.tsx` — обновить snapshot после удаления badge.
- `lead-form-sync-bridge.test.ts` — case mixed-case stage names (Dev/Development).
- `risk-edit-dialog.test.tsx` — preselect с blocked stage + consequence hint.
- `version-history-display.spec.ts` — Playwright e2e: open v4, проверить badge.

### 12.2 Ручные сценарии — см. Phase 5 выше

---

## 13. Closeout

После approve и landing P1-P3 (+ опционально P4b):

1. `git commit` per phase: data-fix (P1), placement (P2), sync+latents (P3),
   [optional redesign (P4b)].
2. `git push origin fix/PRJ-2/shiny-eagle`.
3. Manual UAT (см. Phase 5).
4. Resolve Bugsink если новые issues всплыли.
5. Update `.planning/STATE.md` — v8.4.2 patch entry.
6. Update `.planning/session-retros/NEXT-ACTIONS.md` — закрыть пункты.
7. `/Demo-retro` короткий summary.
8. Merge PR #7 → tag `v8.4.2`.
9. Если 4b deferred → создать `.planning/todos/pending/2026-05-25-slide-redesign-v8.4.3.md`.

---

## 14. Self-check

- [x] TL;DR с ASCII «было / станет» (6 пунктов)
- [x] Latent gaps L1-L4 явно перечислены с file:line якорями
- [x] Skill routing: Demo-plan rich-mode + ui-ux-pro-max + 3 parallel Explore (после compaction)
- [x] Subagent roadmap по фазам с model tier
- [x] Token economy явная (Haiku/Sonnet/Opus split)
- [x] Agent does / Human does — не перекладывает на человека
- [x] Open questions с defaults — план может ехать автономно
- [x] Файлы по фазам с конкретными file:line якорями
- [x] Verification: автоматика + ручные сценарии
- [x] Live state снят (branch, commits, dirty)
- [x] Boundaries: что не трогать
- [x] Iteration reserve между фазами + decision gate перед 4b
- [x] Variable density audit (#6) встроен как Phase 4a, не как «добавим потом»
- [x] AgentReview placement: 3 варианта с recommendation B
