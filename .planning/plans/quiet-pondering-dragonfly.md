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

### Phase 3.5 — Полная двунаправленная связь pipeline ↔ risk dialog

**Контекст:** L1-L4 закрыты коммитом `f42990c2`. Следующий коммит
`8bddb08c` (pre-select только at-risk/blocked) ввёл **L5** регрессию — фильтр
в `risk-edit-dialog.tsx:97-99` сравнивает короткое `Dev` (из
`seedProduct.stages[].stageName`) с каноническим `Development` (из
`stagesForProduct` → `ownedStagesForProject`). Множества не пересекаются →
пред-выбор не срабатывает.

Параллельно ручной UAT показал, что связь между двумя секциями реализована
**только наполовину**: down-flow (pipeline → dialog) сломан из-за L5, а
up-flow (dialog → pipeline) **не реализован вообще** — пользователь может
сохранить риск с severity Blocked для стадии Dev, а сама Dev в SDLC chip
останется On Track. Это противоречит ментальной модели: «секции взаимосвязаны,
изменение в одной отражается в другой».

#### TL;DR — две стрелки, обе должны работать

```text
БЫЛО                                            СТАНЕТ
─────────────────────────────────────────────   ─────────────────────────────────────────────
                                                ┌─ DOWN-FLOW ─────────────────────────────┐
Pipeline: Dev = Blocked                         │ Pipeline: Dev = Blocked                 │
        │                                       │         │                               │
        ▼                                       │         ▼ canonical match               │
Dialog: stages ☐☐☐☐ (пусто, L5 баг)             │ Dialog: ☑ Development pre-checked       │
                                                │         severity = Blocked (derived)    │
                                                │         context strip:                  │
                                                │         «Маркетинговый портал → Dev      │
                                                │         (Blocked) — из пайплайна»        │
                                                └─────────────────────────────────────────┘

                                                ┌─ UP-FLOW ───────────────────────────────┐
Save risk → pipeline не меняется                │ Save risk: stages=[Dev], severity=Blocked│
(Dev остаётся On Track сверху)                  │         │                               │
                                                │         ▼ promote status                │
                                                │ Pipeline: Dev на on-track? → Blocked    │
                                                │         (если severity риска ≥ severity │
                                                │         текущей стадии)                  │
                                                └─────────────────────────────────────────┘

Empty stageIds = «applies to all»               Stage selection ОБЯЗАТЕЛЕН (валидация).
(скрытый sentinel)                              Save Risk disabled пока не выбрана стадия.
```

#### 1. Down-flow fix (L5 регрессия — две точки канонизации)

| Файл                                   | Строки  | Изменение                                                    |
| -------------------------------------- | ------- | ------------------------------------------------------------ |
| `risk-edit-dialog.tsx` (useState init) | 93-99   | оба `Set` и `filter` пропустить через `canonicalStageName()` |
| `risk-edit-dialog.tsx` (useEffect)     | 127-130 | то же изменение в зеркальном блоке reset                     |

Каноничный код:

```ts
const riskyStages = new Set<string>(
  (seedProduct?.stages ?? [])
    .filter((s) => s.status === "at-risk" || s.status === "blocked")
    .map((s) => canonicalStageName(s.stageName)),
);
return ownedStages.filter((n) => riskyStages.has(canonicalStageName(n)));
```

Импорт `canonicalStageName` из `./stage-tags` уже есть в файле (использован
в `deriveSeverityFromStages` после L3 fix).

#### 2. Context strip в шапке диалога

**Куда:** между `<h2>Add Risk — {productName}</h2>` (≈
`risk-edit-dialog.tsx:240-247`) и `<form>`. Один блок, амбер фон/обводка как
у unbacked-stage banner в `sdlc-pipeline.tsx:119-172` для единства языка.

```text
┌─ контекстная полоска (рендерим ТОЛЬКО когда есть pre-checked stages) ───┐
│ Маркетинговый портал → Dev (Blocked) · Testing (At Risk)                │
│ Pre-selected from SDLC pipeline. Adjust below if needed.                │
└─────────────────────────────────────────────────────────────────────────┘
```

Severity pill переиспользует стиль из `sdlc-pipeline.tsx:147-167`. Если в
пайплайне ничего не отмечено → полоска не рендерится, остаётся как было.

```tsx
const preCheckedStages = useMemo(() => {
  const ownedStages = stagesForProduct?.(seedProduct?.id ?? "") ?? [];
  return (seedProduct?.stages ?? [])
    .filter((s) => s.status === "at-risk" || s.status === "blocked")
    .filter((s) =>
      ownedStages.some(
        (n) => canonicalStageName(n) === canonicalStageName(s.stageName),
      ),
    )
    .map((s) => ({
      name: canonicalStageName(s.stageName),
      severity: s.status,
    }));
}, [seedProduct, stagesForProduct]);

{
  preCheckedStages.length > 0 && (
    <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
      <div className="font-medium text-amber-900">
        {productName} →{" "}
        {preCheckedStages
          .map(
            (s) =>
              `${s.name} (${s.severity === "blocked" ? "Blocked" : "At Risk"})`,
          )
          .join(" · ")}
      </div>
      <div className="mt-0.5 text-[11px] text-amber-700">
        Pre-selected from SDLC pipeline. Adjust below if needed.
      </div>
    </div>
  );
}
```

#### 3. Required stage selection (валидация)

Удаляем sentinel «empty = applies to all». `stageIds.length === 0` теперь —
ошибка валидации.

| Файл                       | Изменение                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `risk-edit-dialog.tsx:207` | убрать `stageIds.length > 0 ? stageIds : undefined`; всегда отдавать массив                               |
| `risk-edit-dialog.tsx`     | в state `errors` добавить ключ `stageIds`; в `handleSave` — `if (!stageIds.length) errors.stageIds = "…"` |
| `stage-multi-select.tsx`   | принимать `error?: string` уже есть (line 22) — пропустить через prop                                     |
| `risk-edit-dialog.tsx`     | Save Risk button: `disabled` пока `!stageIds.length \|\| !text \|\| !impact \|\| !mitigation`             |

Текст ошибки: `"Select at least one stage. Empty selection no longer applies to all."`

#### 4. Up-flow — saving risk promotes stage status

**Где:** save handler в `RiskEditDialog.onSave` пробрасывает выбранные stages +
severity вверх. Родитель (через `LeadFormSyncBridge` /
`computeUnbackedStages`) должен принять это и вызвать `onProductsChange` с
обновлённым `stage.status`.

**Правила промоушена** (от строгого к мягкому):

```text
selected severity          current pipeline status      action
─────────────────────────  ──────────────────────────   ──────────────────────────
blocked                    on-track                     → blocked
blocked                    at-risk                      → blocked
blocked                    blocked                      no-op
at-risk                    on-track                     → at-risk
at-risk                    at-risk                      no-op
at-risk                    blocked                      no-op (не понижаем)
```

Down-graduation (понижение severity, например снятие риска с Dev) рассматриваем
**отдельно в Phase 6** — здесь только promotion. Reason: deletion-вектор хочется
обрабатывать с явной конфирмацией пользователя, не молча.

**Файлы:**

| Файл                            | Изменение                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `risk-edit-dialog.tsx` (onSave) | callback contract уже отдаёт `{stageIds, severity}` — не менять                                                                |
| `lead-form-sync-bridge.tsx`     | в `handleRiskSave` после `onRisksChange` посчитать дельту stage status и вызвать `onProductsChange` с promotion-правилами выше |
| `lead-form-sync-bridge.tsx`     | вынести `promoteStageStatus(currentStatus, riskSeverity)` в pure-функцию для теста                                             |

**Семантика для ownership=locked:** stages с `ownership: "locked"` (Planning,
например) промоушн ИГНОРИРУЕТ — owner головы продукта, не lead. Lead не может
переписать статус через свой риск.

#### 5. Severity управляется пользователем (decouple от stage toggle)

**Bug, найденный page-feedback в UAT 2026-05-25:** пользователь выбрал severity
`Blocked`, кликает на ещё одну stage checkbox в multi-select → severity
автоматически сбрасывается обратно на `At Risk`. Причина — функция
`deriveSeverityFromStages` (закрыта в L3 канонизацией, но логика осталась)
пересчитывает severity из flagged-stages пайплайна на каждом stage toggle и
затирает явный выбор пользователя.

**Желаемое поведение:**

```text
момент              severity действие
──────────────────  ─────────────────────────────────────────────
dialog open         derived ONE TIME из preCheckedStages
                    (макс severity из flagged stages пайплайна,
                    fallback "at-risk" если пусто)
user clicks severity user wins; severity = выбранное значение
user toggles stage  severity НЕ МЕНЯЕТСЯ; user manual override sticky
risk edit (existing) severity = risk.severity (load); user может менять
```

**Изменения:**

| Файл                          | Изменение                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `risk-edit-dialog.tsx`        | удалить `useEffect`/`onChange` хук, который вызывает `deriveSeverityFromStages` при изменении `stageIds`   |
| `risk-edit-dialog.tsx` (init) | `useState<RiskSeverity>(() => risk?.severity ?? deriveFromPreChecked(...))` — derive только в initializer  |
| `risk-edit-dialog.tsx`        | severity buttons (`At Risk` / `Blocked`) обычные кнопки выбора — onClick устанавливает state, ничего более |
| `risk-edit-dialog.tsx`        | `deriveSeverityFromStages` оставляем как pure helper для initial state, но НЕ для onChange-pipeline        |

**Helper `deriveFromPreChecked`:**

```ts
function deriveFromPreChecked(
  product: Product | undefined,
  ownedStages: string[],
): RiskSeverity {
  const flagged = (product?.stages ?? []).filter((s) =>
    ownedStages.some(
      (n) => canonicalStageName(n) === canonicalStageName(s.stageName),
    ),
  );
  if (flagged.some((s) => s.status === "blocked")) return "blocked";
  if (flagged.some((s) => s.status === "at-risk")) return "at-risk";
  return "at-risk"; // default
}
```

**Tests:**

```ts
it("severity stays Blocked after user selects it and then toggles a stage checkbox", () => {
  // setup: pipeline all on-track, dialog open
  // user clicks "Blocked" severity button
  // user clicks "Dev" stage checkbox
  // → severity is STILL "blocked", not flipped to "at-risk"
});

it("derives initial severity from pre-checked stages on dialog open", () => {
  // pipeline: Dev=blocked, Testing=at-risk
  // dialog opens
  // → severity initialState = "blocked" (max of flagged)
});

it("preserves risk.severity when editing existing risk (no derive override)", () => {
  // existing risk with severity="at-risk", stageIds=["Dev"]
  // pipeline current: Dev=blocked
  // dialog opens for edit
  // → severity STAYS "at-risk" (user's previous choice), NOT promoted to blocked
});
```

#### Файлы Phase 3.5

| Файл                                                          | Что меняем                                                             |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `apps/web/src/components/lead/risk-edit-dialog.tsx`           | L5 canonicalization, context strip, required validation, save contract |
| `apps/web/src/components/lead/lead-form-sync-bridge.tsx`      | up-flow promotion после save + pure `promoteStageStatus`               |
| `apps/web/src/components/lead/risk-edit-dialog.test.tsx`      | new tests: down-flow alias, context strip render, required validation  |
| `apps/web/src/components/lead/lead-form-sync-bridge.test.tsx` | new tests: up-flow promotion matrix (5 кейсов из таблицы выше)         |

#### Тесты Phase 3.5

```ts
// risk-edit-dialog.test.tsx

it("pre-selects canonical stage when pipeline uses alias (Dev → Development)", () => {
  // pipeline: stages=[{stageName:"Dev", status:"blocked"}]
  // stagesForProduct returns canonical ["Development","Testing"]
  // → Development должна быть pre-checked
});

it("renders context strip showing pre-selected stages with severity pills", () => {
  // pipeline: Dev=blocked, Testing=at-risk
  // → strip text contains "Dev (Blocked)" AND "Testing (At Risk)"
});

it("hides context strip when no stages are flagged in pipeline", () => {
  // pipeline: all on-track → strip not rendered
});

it("disables Save Risk when no stages selected", () => {
  // user fills text/impact/mitigation but uncheckes all stages
  // → Save Risk button disabled, error "Select at least one stage"
});

// lead-form-sync-bridge.test.tsx (promotion matrix)

describe("promoteStageStatus pure function", () => {
  it.each([
    ["on-track", "blocked", "blocked"],
    ["on-track", "at-risk", "at-risk"],
    ["at-risk", "blocked", "blocked"], // promote
    ["at-risk", "at-risk", "at-risk"], // no-op
    ["blocked", "at-risk", "blocked"], // don't downgrade
    ["blocked", "blocked", "blocked"],
  ])("current=%s + risk=%s → %s", (cur, sev, expected) => {
    expect(promoteStageStatus(cur, sev)).toBe(expected);
  });
});

it("saving risk with stages=[Dev]/severity=Blocked promotes Dev in pipeline from on-track", () => {
  // initial: product.stages = [{stageName:"Dev", status:"on-track"}]
  // user saves risk → onProductsChange called with Dev.status="blocked"
});

it("locked-ownership stages are NOT promoted by risk save", () => {
  // initial: Planning has ownership:"locked"
  // user saves risk with Planning + Blocked
  // → onProductsChange NOT called (or called without Planning change)
});
```

#### Manual UAT (3 scenario)

| #   | Scenario                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Pipeline: Dev=Blocked → `+ Add Risk` → context strip говорит «Маркетинговый портал → Dev (Blocked)»; Development автоматически отмечен |
| B   | Pipeline: всё on-track → `+ Add Risk` → context strip отсутствует; список stages пуст; Save Risk disabled пока не выберешь stage       |
| C   | Pipeline: Dev=on-track → создаём риск с stages=[Dev]/severity=Blocked → закрываем диалог → Dev chip в пайплайне стал Blocked           |

### Phase 3.6 — RiskEditDialog не помещается на экран (UX widen + regroup)

**Контекст (page feedback 2026-05-25, viewport 1728×871):** диалог `max-w-2xl`
(672px) на широком мониторе занимает только ~39% ширины, при этом по высоте
переполнен — Save/Cancel уходят под скролл, пользователь их не видит без
прокрутки. С новыми блоками v8.4.2 (context strip, consequence hint, required
stages error) ситуация ухудшается. Quote: «не помещается полностью на экраны,
скролл появляется, кнопочки не появляются».

#### TL;DR

```text
было                                           │  станет
───────────────────────────────────────────────│──────────────────────────────────────
ширина:    max-w-2xl  (672px)                  │  max-w-4xl  (~896px) на ≥md
layout:    одна колонка, всё вертикально       │  две колонки: контент слева /
           Risk → Impact → Mitigation →        │  meta (stages + severity + product)
           Stages → Severity → Product         │  справа на ≥md; одна колонка на mobile
футер:     inline после Product, скроллится    │  sticky bottom внутри dialog
           вместе с контентом                  │  (Cancel / Save Risk всегда видны)
helper:    длинные параграфы под каждым полем  │  сжать до одной строки; tooltip "?"
                                               │  для расширенного описания
```

#### Изменения

| Файл                                                              | Что менять                                                                                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/lead/risk-edit-dialog.tsx` (root div)    | `max-w-2xl` → `max-w-4xl`; `max-h-[92vh]` оставить                                                                                    |
| `apps/web/src/components/lead/risk-edit-dialog.tsx` (form)        | grid: `grid grid-cols-1 md:grid-cols-[1fr_280px] gap-6`; left = Risk/Impact/Mitigation; right = Stages/Severity/Product               |
| `apps/web/src/components/lead/risk-edit-dialog.tsx` (footer)      | вынести Cancel/Save в `<div className="sticky bottom-0 bg-white border-t pt-3 mt-4 flex justify-end gap-3">`; убрать из inline-потока |
| `apps/web/src/components/lead/risk-edit-dialog.tsx` (helper text) | оставить одну строку; длинные пояснения убрать или перенести в `<span title="...">?</span>`                                           |
| `apps/web/src/components/lead/stage-multi-select.tsx`             | в narrow column (280px) проверить wrap: `flex-wrap gap-1.5` чтобы 4 чипа Development/Testing/DevOps/Support не вылазили               |

#### Правило раскладки

```text
md (≥768px):
┌─ Add Risk — Маркетинговый портал ─────────────────────────────────────┐
│ (context strip if any)                                                  │
├──────────────────────────────┬──────────────────────────────────────────┤
│ Risk *                       │ SDLC Stages                              │
│ [textarea]                   │ ☑ Development                            │
│                              │ ☐ Testing                                │
│ Impact *                     │ ☐ DevOps                                 │
│ [textarea]                   │ ☐ Support                                │
│                              │                                          │
│ Mitigation *                 │ Severity                                 │
│ [textarea]                   │ ( ! At Risk )  ( ✕ Blocked )             │
│                              │                                          │
│                              │ Product                                  │
│                              │ [select ▾]                               │
├──────────────────────────────┴──────────────────────────────────────────┤
│  sticky footer:                              [ Cancel ]  [ Save Risk ]  │
└─────────────────────────────────────────────────────────────────────────┘

<md (mobile / tablet):
одна колонка как сейчас, sticky footer всё равно прикреплён внизу.
```

#### Acceptance

- На 1728×871 viewport кнопки Cancel/Save Risk видны без скролла когда все 3
  textarea заполнены (одна-две строки) и SDLC strip отрисован.
- На 768px (mobile) layout остаётся одно-колоночным, ничего не вылазит за
  ширину контейнера, sticky footer работает.
- Stage chips на 280px-колонке wrap правильно (4 chip в 2 рядах).
- Никакой регрессии для Phase 3.5 поведений (context strip, required stage,
  severity decouple, up-flow promote) — функциональность не меняется, только
  размещение.

#### Тесты Phase 3.6

```ts
// risk-edit-dialog.test.tsx (visual smoke)
it("renders Save Risk and Cancel buttons in the sticky footer", () => {
  render(<RiskEditDialog open ... />);
  const save = screen.getByRole("button", { name: /Save Risk/i });
  const cancel = screen.getByRole("button", { name: /Cancel/i });
  // both must be inside the same sticky container
  expect(save.parentElement).toHaveClass("sticky");
  expect(cancel.parentElement).toBe(save.parentElement);
});

it("uses two-column grid on md+ viewports", () => {
  render(<RiskEditDialog open ... />);
  const form = screen.getByRole("form") ?? document.querySelector("form");
  expect(form?.className).toMatch(/md:grid-cols-\[1fr_280px\]/);
});
```

Visual regression — manual UAT (см. Phase 5 ручные сценарии: добавить кейс
«Add Risk dialog на 1728×871: Cancel/Save Risk видны без скролла»).

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

### Phase 3.7 — Versioning/Autosave UX-fix + FillFromButton (v8.4.2)

**Контекст (UAT 2026-05-25):** пользователь сформулировал три симптома, у
которых под капотом одна общая болячка — «логические связи между объектами
неявные», и UI не помогает их увидеть:

1. «давай вренс кнопку сейв — чтобы мне не ждать автосохранение… и когда
   сохраняется показывать процесс типа анимации кружочка». Текущий autosave
   debounce 5 с создаёт ощущение «работает оно или нет?». В badge есть текст
   `↻ Saving…` / `● Pending…` / `Version N · HH:MM`, но нет ни большой
   видимой кнопки `Save now`, ни анимации-spinner.
2. «ничего не показывает — хотя ты сделал показ архивов… опять проблема
   логической связности». `FillFromButton` (`fill-from-button.tsx:100:72`)
   рендерится, открывается popover/dropdown, но список архивов пустой.
3. «нужно прям проверить всё на логической связности — по-хорошему БД в
   первую очередь должна нам это диктовать». Системная жалоба — переезжает в
   v8.5 outline (см. раздел 15). Здесь чиним UX-симптомы, схему не трогаем.

**Locked direction (ответ пользователя):** «Гибрид — UX-fix сейчас, БД-reshape
отдельной фазой». То есть Phase 3.7 — это поверхностный UX-патч в v8.4.2,
а реальный рефакторинг ownership/OCC/snapshot semantics уезжает в v8.5
(раздел 15).

#### TL;DR

```text
было                                            │  станет
────────────────────────────────────────────────│──────────────────────────────────────
1. Только тонкий autosave-badge в header        │  Visible "💾 Save now" кнопка
   `↻ Saving…` — пользователь не уверен,        │  + animated spinner во время write,
   что нужно ему делать                         │  badge подтверждает результат
                                                │
2. FillFromButton клик → пустой dropdown        │  Дебаг: либо empty-state с текстом
   (архивы есть в DB, но не показываются)       │  «No past reports found», либо fix
                                                │  query — depending on root cause
                                                │
3. Autosave каждые 5 с создаёт snapshot         │  Throttle: snapshot создаётся не
   на ЛЮБОЙ saveDraft → инфляция версий         │  чаще раза в 60 с (server-side
                                                │  dedup); + skip когда `data`
                                                │  идентичен предыдущему snapshot
                                                │  (минимально-инвазивно, без OCC)
```

#### 1. Save button + spinner (Visible Save now control)

**Где разместить:** в `VersionHistoryNav` (`version-history-nav.tsx`) рядом с
`‹ ›` стрелками, ИЛИ в `ReportToolbar` (`report-toolbar.tsx`) как
`leadingControls`. Рекомендую второй вариант — toolbar уже держит автосейв-
badge, держим связанные controls в одном месте.

| Вариант                               | Цена                           | Эффект                               |
| ------------------------------------- | ------------------------------ | ------------------------------------ |
| A. Кнопка в VersionHistoryNav         | +1 ширина в pill               | смешиваем «версии» и «сохранить»     |
| B (рекомендую) Кнопка в ReportToolbar | +1 leadingControl slot         | Save + autosave-badge рядом, логично |
| C. Floating bottom-right              | +1 portal, +1 z-index conflict | бросается в глаза, но мобильный риск |

**Поведение Save button:**

```text
[Save Now] ←─ default state, enabled when state ∈ {pending, error}
              disabled когда state ∈ {idle, saving, saved}
              click → forceSave() (см. хук ниже)
              иконка: 💾 (или `Save` lucide)

[⟳ Saving…] ←─ во время mutation (replace label + spinner animation)
              disabled, не реагирует на click
              spinner: SVG @keyframes spin 1s linear infinite

[✓ Saved]   ←─ 1.5 секунды после success, потом снова [Save Now]
              иконка: ✓ (зелёная), label «Saved» (приглушённый)
```

**Изменения в хуке** (`use-lead-form-autosave.ts`):

| Что             | Сейчас                               | Станет                                                                    |
| --------------- | ------------------------------------ | ------------------------------------------------------------------------- |
| Public API      | `{state, lastSavedAt, errorMessage}` | + `forceSave: () => Promise<void>` — отменяет debounce и save immediately |
| Spinner state   | строка badge меняется                | + флаг `isInFlight` (true когда mutation в воздухе)                       |
| Force-save call | нет                                  | clearTimeout(timer) → runSave(payload) сразу                              |
| Re-entrancy     | один setTimeout                      | если `forceSave` пока in-flight — queue payload, fire после success       |

**Tests:**

```ts
// use-lead-form-autosave.test.ts
it("forceSave() bypasses debounce and triggers immediate save", async () => {
  // setup hook with debounceMs=5000, dirty payload
  // call forceSave() at t=0
  // assert mutation fired by t<100ms (not waiting 5s)
});

it("Save button disables itself while save is in flight", async () => {
  // render ReportToolbar with autosave hook
  // click Save now → expect button [disabled]
  // resolve mutation → expect button re-enabled
});

it("Save button shows ✓ Saved for ~1500ms then reverts", async () => {
  // render → click → resolve mutation
  // immediately check: label = "Saved", icon = ✓
  // advance timers 1500ms → label back to "Save now"
});
```

#### 2. FillFromButton — debug «empty dropdown» bug

**Симптом:** кнопка `[Choose past report to fill from]` отображается, при
клике dropdown открывается, но список пуст несмотря на то что archives
существуют в DB.

**Hypotheses (в порядке вероятности — debug step-by-step):**

| #   | Гипотеза                                                                      | Как проверить                                                                                                                                       |
| --- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | Query на бекенде фильтрует по неправильному `productId`                       | Открыть DevTools → Network → найти запрос `fill-from`/`history`/`my-history` → посмотреть response. Если `[]` пришёл с сервера — это backend filter |
| H2  | UI получает данные, но `.filter()` на клиенте лишний раз режет                | Поставить `console.log` в `fill-from-button.tsx:100` где данные мапятся                                                                             |
| H3  | `productId` пропусается из props/context как `undefined`                      | grep вызовы `<FillFromButton`; убедиться что productId всегда передан                                                                               |
| H4  | Foreign-author cross-project архивы фильтруются `currentUser.id !== authorId` | то же место — но это правильное поведение, тогда пишем empty-state                                                                                  |

**Acceptance:**

- Open `lead-form` где `myHistory` возвращает ≥1 archive → клик
  `[Choose past report to fill from]` → dropdown показывает minimum 1 row.
- Если архивов нет (новый user) → dropdown показывает empty-state
  `No past reports found` (не пустой dropdown без объяснений).
- Если query упала с ошибкой → dropdown показывает `Failed to load` + retry
  button.

**Файлы:**

| Файл                                                           | Изменение                                                               |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `apps/web/src/components/lead/fill-from-button.tsx`            | debug query + добавить empty/error states                               |
| `apps/web/src/components/lead/fill-from-button.test.tsx` (new) | 3 теста: data → render list / empty → empty-state / error → error-state |

#### 3. Snapshot throttle (минимально-инвазивно)

**Симптом (из Agent A/B reports):** `createSnapshot` сейчас вызывается на
КАЖДЫЙ успешный autosave (`lead-form.tsx:675-682`). Debounce 5 с → один
snapshot каждые ~5-10 с активной правки. За час правки = ~360 snapshots,
многие идентичны.

**Текущая retention** (`lead-form.prisma-repository.ts:446-486`) собирает их
по hourly/daily buckets, но это работает только после 24 ч. В первые сутки
все 360 строк живут в `VersionSnapshot`, занимают JSON, замедляют
`leadForm.versions` query.

**Минимальный fix (не трогает schema):**

| Что                                                     | Где                                             |
| ------------------------------------------------------- | ----------------------------------------------- |
| Server-side throttle: «не чаще раза в 60 с per section» | `lead-form.service.ts:253-273` (createSnapshot) |
| Content-based dedup: если `data` идентичен последнему   | `lead-form.prisma-repository.ts:381-443`        |
| snapshot — не пишем новую строку                        | (createVersionSnapshot)                         |

Throttle логика:

```ts
// в LeadFormService.createSnapshot
const lastSnapshot = await repository.getLatestSnapshot(sectionId);
if (lastSnapshot) {
  const ageMs = Date.now() - lastSnapshot.createdAt.getTime();
  if (ageMs < 60_000) {
    // skip silently — autosave-driven, не surface ошибку
    return { skipped: true, reason: "throttled" };
  }
  // content dedup: stableStringify обоих JSON, сравнить
  if (stableStringify(lastSnapshot.data) === stableStringify(currentData)) {
    return { skipped: true, reason: "no-change" };
  }
}
return repository.createVersionSnapshot(sectionId, currentData);
```

Это снижает row count в ~6-12× при тех же гарантиях восстановления (если
правки идут одна за другой — собираем их в одну версию; если пауза >60 с — у
нас точный checkpoint).

**Tests:**

```ts
// lead-form.service.test.ts
it("createSnapshot skips when called within 60s of previous snapshot", async () => {
  // first call → row created
  // second call at t=30s → returns {skipped: true, reason: "throttled"}
  // third call at t=70s → row created
});

it("createSnapshot skips when data is byte-identical to latest snapshot", async () => {
  // first call with payloadA → row created
  // second call at t=120s with same payloadA → {skipped: true, reason: "no-change"}
});
```

#### Файлы Phase 3.7

| Файл                                                                  | Что меняем                                                 |
| --------------------------------------------------------------------- | ---------------------------------------------------------- |
| `apps/web/src/hooks/use-lead-form-autosave.ts`                        | + `forceSave()` API + `isInFlight` flag                    |
| `apps/web/src/components/report/report-toolbar.tsx`                   | новый `<SaveNowButton>` в leadingControls (вариант B)      |
| `apps/web/src/components/report/save-now-button.tsx` (new)            | 💾 / spinner / ✓ Saved transitions; consumes autosave hook |
| `apps/web/src/components/lead/fill-from-button.tsx`                   | debug + empty-state + error-state                          |
| `apps/api/src/modules/report-sections/lead-form.service.ts`           | throttle (60 с) + content-dedup в createSnapshot           |
| `apps/api/src/modules/report-sections/lead-form.prisma-repository.ts` | + `getLatestSnapshot(sectionId)` helper                    |
| `apps/web/src/hooks/use-lead-form-autosave.test.ts`                   | new tests: forceSave / spinner state / re-entrancy queue   |
| `apps/web/src/components/report/save-now-button.test.tsx` (new)       | render states: idle / saving / saved → revert              |
| `apps/web/src/components/lead/fill-from-button.test.tsx` (new)        | data / empty / error states                                |
| `apps/api/src/modules/report-sections/lead-form.service.test.ts`      | throttle + content-dedup cases                             |

#### Что Phase 3.7 НЕ делает (deferred в v8.5)

- НЕ добавляет OCC (`version`/`updatedAt`/ETag/If-Match на wire).
- НЕ меняет `saveSection` wipe-and-recreate → merge.
- НЕ адресует multi-tab last-writer-wins.
- НЕ унифицирует `products[].stages.filter(ownership==="mine")` и
  `draftSection.projects[].ownedStages`.
- НЕ адресует «lead autosave vs head publish» race window.

Эти пункты — отдельная phase в v8.5 (см. раздел 15).

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

| #   | Scenario                                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Open RiskEditDialog с blocked stage в SDLC → stage pre-checked, hint виден                                                                                                                               |
| 2   | Period select: текстовый «(Current)», нет зелёной точки                                                                                                                                                  |
| 3   | Slides: AgentReview справа от Fullscreen в toolbar, НЕ в hero                                                                                                                                            |
| 4   | Open report с v4: badge показывает «Version 4», не «Version 1»                                                                                                                                           |
| 5   | Slides: 3 density × 3 viewport — отсутствие визуальных breaks (если 4b shipped)                                                                                                                          |
| 6   | Risk с `stageIds: ["dev"]` + Item с `stageStatuses.Development: "blocked"` → ОДИН blocked chip, не два                                                                                                   |
| 7   | Open Add Risk на viewport 1728×871: Cancel/Save Risk видны без скролла; layout 2-колонки; на mobile 768px — 1 колонка, sticky footer всё равно прикреплён                                                |
| 8   | Lead form: правлю textarea → жму Save Now → spinner крутится → ✓ Saved → через ~1.5 с обратно `Save now`; badge в header показывает «Version N+1 · HH:MM»                                                |
| 9   | FillFromButton: открываю lead, у которого есть ≥1 архив → клик `[Choose past report to fill from]` → dropdown показывает ≥1 row; на новом lead'е без архивов → видно empty-state `No past reports found` |
| 10  | Snapshot throttle: правлю lead подряд 5 раз с паузой 10 с → проверяю `SELECT count(*) FROM "VersionSnapshot" WHERE "reportSectionId" = '…'` → +1, не +5 (или максимум +1-2 если контент менялся)         |

---

## 4. Файлы по фазам

| Фаза | Файл                                                                                 | #      |
| ---- | ------------------------------------------------------------------------------------ | ------ |
| P1   | `apps/web/src/components/lead/period-navigator.tsx`                                  | 2      |
| P1   | `apps/web/src/components/lead/period-navigator.test.tsx`                             | 2      |
| P1   | TBD после discovery grep                                                             | 4      |
| P1   | playwright spec для Version badge                                                    | 4      |
| P2   | `apps/web/src/components/slides/lead-slides-client.tsx`                              | 3      |
| P2   | `apps/web/src/components/slides/status-slide-deck.tsx` или ReportSlides toolbar slot | 3      |
| P3   | `apps/web/src/components/lead/stage-multi-select.tsx`                                | 1      |
| P3   | `apps/web/src/components/lead/risk-edit-dialog.tsx`                                  | 1      |
| P3   | `apps/web/src/components/lead/sdlc-pipeline.tsx` (L1)                                | 1      |
| P3   | `apps/web/src/components/lead/lead-form-sync-bridge.tsx` (L2)                        | 1      |
| P3   | `apps/web/src/components/lead/risks-section.tsx` (L4)                                | 1      |
| P3   | `apps/web/src/components/lead/lead-form-sync-bridge.test.ts`                         | 1      |
| P3.6 | `apps/web/src/components/lead/risk-edit-dialog.tsx` (width + grid + sticky footer)   | 7      |
| P3.6 | `apps/web/src/components/lead/stage-multi-select.tsx` (narrow-column wrap)           | 7      |
| P3.6 | `apps/web/src/components/lead/risk-edit-dialog.test.tsx` (footer + grid smoke)       | 7      |
| P3.7 | `apps/web/src/hooks/use-lead-form-autosave.ts` (+ `forceSave`, `isInFlight`)         | 8,9,10 |
| P3.7 | `apps/web/src/components/report/save-now-button.tsx` (new)                           | 8      |
| P3.7 | `apps/web/src/components/report/report-toolbar.tsx` (mount Save button)              | 8      |
| P3.7 | `apps/web/src/components/lead/fill-from-button.tsx` (debug + empty/error states)     | 9      |
| P3.7 | `apps/api/src/modules/report-sections/lead-form.service.ts` (throttle + dedup)       | 10     |
| P3.7 | `apps/api/src/modules/report-sections/lead-form.prisma-repository.ts` (+ helper)     | 10     |
| P3.7 | `apps/web/src/hooks/use-lead-form-autosave.test.ts` (+ forceSave / spinner tests)    | 8      |
| P3.7 | `apps/web/src/components/report/save-now-button.test.tsx` (new)                      | 8      |
| P3.7 | `apps/web/src/components/lead/fill-from-button.test.tsx` (new)                       | 9      |
| P3.7 | `apps/api/src/modules/report-sections/lead-form.service.test.ts` (throttle/dedup)    | 10     |
| P4a  | `.planning/notes/slide-density-audit-2026-05-25.md`                                  | 5,6    |
| P4a  | `tools/uat-screenshots/slide-density-matrix.ts`                                      | 5,6    |
| P4b  | (TBD после audit) `lead-unified-slide.tsx`, `slide-product-chips.tsx`, CSS tokens    | 5,6    |
| P5   | run tests + UAT manual sweep                                                         | —      |

---

## 5. Subagent roadmap

**Hard routing rule (locked 2026-05-25):** Opus 4.7 — ТОЛЬКО оркестрация,
финальный merge, plan revision. ЛЮБАЯ реализация (code + tests) идёт через
Sonnet 4.6 субагент. ЛЮБАЯ разведка (grep, classify, type read, integration
test fixture survey) — через Haiku 4.5 субагент. Никаких inline-edit'ов
оркестратором — если это >5 строк, спавним Sonnet.

| Stage | Agent                         | Tier       | Scope                                                           | Output                                    |
| ----- | ----------------------------- | ---------- | --------------------------------------------------------------- | ----------------------------------------- |
| 0     | Orchestrator                  | Opus 4.7   | план + integration + final commits                              | этот файл                                 |
| 1a    | discovery-version-badge       | Haiku      | grep + classify call-sites                                      | `.planning/notes/version-badge-source.md` |
| 1b    | discovery-period-badge        | Haiku      | confirm badge removal scope                                     | один-line confirm                         |
| 2     | implementer-p1-p2             | Sonnet 4.6 | P1 + P2: badge removal + AgentReview move                       | code + tests                              |
| 3     | implementer-p3                | Sonnet 4.6 | P3: stage<->risk sync + 4 latents                               | code + tests                              |
| 3.7a  | discovery-fillfrom            | Haiku      | DevTools network + console; classify root cause из 4 hypotheses | `.planning/notes/fillfrom-bug-source.md`  |
| 3.7b  | implementer-p3.7-ui           | Sonnet 4.6 | Save button + spinner + хук + FillFrom fix                      | code + tests                              |
| 3.7c  | implementer-p3.7-api          | Sonnet 4.6 | snapshot throttle + content dedup + helper                      | code + tests                              |
| 4a    | audit-slide-density           | Sonnet 4.6 | Playwright multi-scale screenshots                              | markdown report                           |
| 4b    | implementer-p4b (CONDITIONAL) | Sonnet 4.6 | redesign — только если в v8.4.2                                 | code + tests                              |
| 5     | verifier                      | Sonnet 4.6 | typecheck + lint + tests + e2e                                  | gate report                               |

Stage 2 и 3 — параллельно (нет file overlap). Stage 4a — параллельно с
2 и 3 (только Playwright + markdown). Stage 4b — после 4a + decision gate.

**Phase 3.7 параллелизация:** 3.7a (Haiku discovery FillFrom) → 3.7b и 3.7c
параллельно (нет file overlap: 3.7b трогает `apps/web/**`, 3.7c трогает
`apps/api/**`). Orchestrator только подбирает diff и коммитит.

---

## 6. Token economy

| Stage | Model      | Est. tokens        | Why                                                 |
| ----- | ---------- | ------------------ | --------------------------------------------------- |
| 0     | Opus 4.7   | ~18k               | orchestration + plan revision + merge               |
| 1a-b  | Haiku      | ~3k each           | grep + classify                                     |
| 2     | Sonnet 4.6 | ~15k               | 4 файла, 2 теста                                    |
| 3     | Sonnet 4.6 | ~25k               | 6 файлов, 1 test pass с alias case                  |
| 3.7a  | Haiku      | ~4k                | DevTools network sniff + classify 4 hypotheses      |
| 3.7b  | Sonnet 4.6 | ~18k               | хук + Save button + FillFrom UI fix + 3 test файла  |
| 3.7c  | Sonnet 4.6 | ~12k               | throttle/dedup в API + helper + test файл           |
| 4a    | Sonnet 4.6 | ~12k               | Playwright spec + 9 screenshots + markdown analysis |
| 4b    | Sonnet 4.6 | ~35k (CONDITIONAL) | redesign 2-3 компонента + CSS tokens                |
| 5     | Sonnet 4.6 | ~10k               | run tests                                           |

Opus — только orchestration (план, integration merge, conflict resolution).
Default — Sonnet implementation, Haiku discovery. Inline-edit оркестратором
запрещён для блоков >5 строк (locked 2026-05-25 по user feedback).

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
- [x] Phase 3.7 (UX-fix Save+spinner+FillFrom+snapshot throttle) добавлена; v8.5 outline вынесен в раздел 15
- [x] 3 manual scenarios (8, 9, 10) добавлены в Phase 5 под Phase 3.7

---

## 15. v8.5 outline — DB-as-source-of-truth reshape (deferred)

> **Скоп:** НЕ реализуется в v8.4.2. Этот раздел фиксирует все архитектурные
> долги, найденные тремя Explore-разведками (versioning, autosave, multi-
> author concurrency) на 2026-05-25, чтобы они не потерялись и были готовы
> к фазированию в следующем minor-релизе.

### 15.1 Контекст и pull quote

Пользователь сформулировал источник проблемы:

> «нужно прям проверить всё на логической связности и по-хорошему БД в первую
> очередь должна нам это диктовать»

Это не один баг, а серия. Все три разведки (см. notification messages выше в
этой сессии) подтвердили: схема Prisma + сервисный слой + UI-mappers имеют
несколько мест, где «одна сущность — несколько источников правды», и UI
старается их склеить ad-hoc. Phase 3.7 чинит симптомы (visible Save, spinner,
empty FillFrom, snapshot throttle) — но корень в schema/contract design.

### 15.2 TL;DR — три кластера долгов

```text
кластер                         │  что сломано                       │  v8.5 фикс
────────────────────────────────│────────────────────────────────────│──────────────────────────────
A. Optimistic concurrency        │ saveDraft = wipe + recreate БЕЗ   │ + ReportSection.version (int)
   (lost-update protection)     │ ETag/If-Match → multi-tab          │ + If-Match check в saveDraft
                                 │ last-writer-wins silently          │ → 409 при mismatch + UI dialog
                                 │                                    │
B. Snapshot semantics            │ snapshot на КАЖДЫЙ autosave;      │ explicit semantic:
                                 │ ZERO дедупа; нет «pin»;            │ - autosave → checkpoint (cheap)
                                 │ stale comment про «50 max»         │ - submit → milestone
                                 │ vs. реально time-based retention   │ - manual ★ → pinned (sticky)
                                 │                                    │
C. Ownership source-of-truth     │ products[].stages.filter(           │ единый ownership-derive в
                                 │ ownership==="mine") ≠              │ shared/mappers; убрать
                                 │ draftSection.projects[].ownedStages │ дублирование; e2e на
                                 │ → ItemEditDialog видит другой       │ совпадение
                                 │ список stages чем SDLC chips        │
```

### 15.3 Кластер A — Optimistic Concurrency Control (OCC)

#### Что сломано (evidence из Agent C + Agent B)

- `ReportSection` имеет `updatedAt @updatedAt` (Prisma auto-manage), но
  НЕТ `version Int` / `lockVersion` / `etag` колонки
  (`prisma/schema.prisma:222-256`).
- `draftSaveSchema` (`packages/shared/src/schemas/report.ts:124-132`) НЕ
  принимает `version` / `If-Match` / `updatedAt`. Нечего проверять.
- `ReportSectionsPrismaRepository.saveSection`
  (`report-sections.prisma-repository.ts:297-398`) делает `update` без
  `where: { updatedAt }`, затем `deleteMany` + `createMany` без advisory lock.
- Multi-tab симптом: два таба одного user'а правят один section,
  оба видят зелёный `Saved`. На сервере — только последний payload.
- Lead vs head publish race: lead в debounce-окне 5 с правит, head жмёт
  Publish → `publishedSnapshot` снимается БЕЗ in-flight правок lead'а, а
  следующий saveDraft 403'ит с `SECTION_ALREADY_SUBMITTED`. Правки тихо
  теряются.

#### Что делает v8.5

| Шаг | Изменение                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `prisma migration`: `ReportSection.version Int @default(1)`. Backfill = 1.                                                         |
| A2  | `draftSaveSchema` + `submitSchema` принимают обязательный `version: number` (If-Match).                                            |
| A3  | `saveSection` обёрнуть в `prisma.$transaction([                                                                                    |
|     | prisma.reportSection.update({ where: {id, version: clientVersion}, data: {version: {increment: 1}, ...}}),                         |
|     | ...deleteMany, ...createMany                                                                                                       |
|     | ])`. Если`version`rejected (Prisma бросает`RecordNotFound`) → throw`OptimisticLockError`.                                        |
| A4  | tRPC error mapping: `OptimisticLockError` → 409 (`code: "CONFLICT"`) с current server `version` + diff hint.                       |
| A5  | UI: `useLeadFormAutosave.onError` ловит 409, показывает `ConflictResolutionDialog` («Кто-то изменил эту секцию. Перезагрузить?»).  |
| A6  | `LeadFormService.publishReport` берёт advisory lock на все sections отчёта (`pg_advisory_xact_lock`), waiting period для in-flight |
|     | saveDraft (max 2 с), затем snapshot — это закрывает «lead-vs-head» race window.                                                    |

#### Tests v8.5-A

```ts
// integration test
it("saveDraft with stale version rejects with 409 + current version", async () => {
  // initial: section.version = 5
  // client A reads v5, mutates locally, sends saveDraft({version: 5}) → success, server now v6
  // client B (loaded v5 earlier) sends saveDraft({version: 5}) → expect 409 with {currentVersion: 6}
});

it("Publish waits for in-flight saveDraft (advisory lock test)", async () => {
  // start saveDraft, hold mutex
  // simultaneously trigger publish → publish blocks
  // resolve saveDraft → publish completes with updated snapshot containing saveDraft changes
});
```

### 15.4 Кластер B — Snapshot semantics overhaul

#### Что сломано

- `lead-form.service.ts:247` — комментарий «every N=10» противоречит реальной
  реализации (snapshot на КАЖДЫЙ autosave success).
- `lead-form.prisma-repository.ts:381-443` — `createVersionSnapshot` читает
  `max(version)` без advisory lock → две параллельные saveDraft на разные
  таба могут попытаться записать одинаковый `version` → unique constraint
  violation. Сейчас swallow'ится `createSnapshotMut.onError: () => {}`.
- Comment «50 max per section» в `lead-form.service.ts:252` — STALE
  относительно `lead-form.prisma-repository.ts:446-486` (там реально
  time-based retention, не count-based).
- Pin/unpin был реализован, потом откатан (`a95681f5`, `6d4726fe`). User
  снова хочет манульный ★ control (по UAT 2026-05-24).

#### Что делает v8.5

| Шаг | Изменение                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------- |
| B1  | `VersionSnapshot.kind` enum: `autosave` (default)                                                                               | `submit` (manual milestone) | `pinned` (★ sticky, retention ignores). |
| B2  | `VersionSnapshot.createdById String` — кто создал (lead                                                                         | head на reopen              | system auto-publish).                   |
| B3  | Pin/unpin mutation: `leadForm.pinVersion({sectionId, version, pinned: boolean})` — author-only.                                 |
| B4  | UI: ★ кнопка в `VersionHistoryNav` рядом с restore (только когда `kind !== "pinned"`).                                          |
| B5  | Retention: kind=pinned ИГНОРИРУЕТСЯ всеми retention buckets. kind=submit — keep forever. kind=autosave — текущий time-based.    |
| B6  | Transactional snapshot: переписать `createVersionSnapshot` в `$transaction`, использовать `INSERT … ON CONFLICT DO NOTHING` для |
|     | устранения race на `(reportSectionId, version)` unique.                                                                         |
| B7  | Удалить stale comment в `lead-form.service.ts:252`.                                                                             |

### 15.5 Кластер C — Unified ownership source-of-truth

#### Что сломано

В коде существуют ДВА источника правды о «какие stages принадлежат lead'у в
этом продукте»:

1. **`products[].stages.filter(s => s.ownership === "mine")`** — питает SDLC
   pipeline chips в `sdlc-pipeline.tsx`. Источник:
   `lead-form.ts:mapStageOwnership` → читает `Item.assigneeId === userId`.
2. **`draftSection.projects[].ownedStages: string[]`** — питает stage
   selector в `ItemEditDialog` / `RiskEditDialog` через
   `stagesForProduct(productId)`. Источник:
   `ownedStagesForProject(draftSection, productId)` в маппере lead-form.

Эти два набора расходятся когда:

- Lead имеет item ON stage X (ownership = "mine"), но `ownedStages` его не
  включает (out-of-band сборка набора).
- Lead имеет stage в `ownedStages`, но ни одного item — chip в pipeline не
  виден, а в диалоге checkbox есть.

UAT-симптом: пользователь сказал «при выборе продукта надо ограничивать
стадии доступные» — ItemEditDialog предлагал stages, которых нет в pipeline.

#### Что делает v8.5

| Шаг | Изменение                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Единый shared helper в `packages/shared`: `getOwnedStagesForProject(report, userId, productId): readonly string[]`.                      |
| C2  | Источник: `Item.assigneeId === userId WHERE productId = X` — ТОТ ЖЕ запрос что и для pipeline ownership.                                 |
| C3  | Backend `lead-form.service.getByPeriod` — больше НЕ возвращает `ownedStages` отдельно; UI вычисляет через helper из `products[].stages`. |
| C4  | UI: `stagesForProduct(productId)` (передаётся в `LeadFormSyncBridge.Provider`) реализован через тот же helper.                           |
| C5  | E2E: assert что для каждого product набор stages в SDLC pipeline === набор checkbox'ов в RiskEditDialog.                                 |

### 15.6 Multi-tab realtime invalidation

#### Что сломано

`useLeadFormAutosave.onSuccess` НЕ вызывает `invalidateLeadForm(qc, trpc)` —
другие табы того же user'а не видят свежие данные. `byPeriod` имеет
`staleTime: Infinity` и no `refetchOnWindowFocus` — даже focus tab B после
правки в tab A не подтягивает changes.

#### Что делает v8.5

| Шаг | Изменение                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `useLeadFormAutosave.onSuccess` → `invalidateLeadForm(qc, trpc, {reportSectionId})`.                                                      |
| D2  | `byPeriod` query: `refetchOnWindowFocus: true` + `staleTime: 30_000` (вместо Infinity).                                                   |
| D3  | (Optional) `BroadcastChannel('lead-form-updates')` — tab A после save → broadcast → tab B инвалидирует cache не дожидаясь focus.          |
| D4  | UI: при detected remote change (cache updated while viewing) — toast «Section was updated by another tab. Refresh to see latest changes». |

### 15.7 Phasing предложение (v8.5 → v8.5.1)

```text
v8.5.0:  Кластер A (OCC) + Кластер C (ownership) — фундаментальные.
         OCC закрывает silent data loss; ownership unifies UI/DB.
         Migration window. Должно быть behind feature flag первые 2 недели.

v8.5.1:  Кластер B (snapshot semantics) + кластер D (multi-tab invalidation).
         Зависит от A (OCC контекст нужен для kind=submit semantics).
         Pin/unpin UI восстанавливается с правильным data model.
```

### 15.8 Что v8.5 НЕ делает (deferred ещё дальше)

- НЕ переходит на CRDT/Yjs для true real-time collab.
- НЕ строит WebSocket subscription channel.
- НЕ адресует cross-period invariants (например, periodN.priorityRank
  uniqueness across N+1).
- НЕ меняет публикационный snapshot format (Phase 65 / D-6).

### 15.9 Ссылки на evidence

- Agent A (versioning) — task `aafb802ab73bc82c2`, completed 2026-05-25.
- Agent B (autosave) — task `ab3d06e241a690e0d`, completed 2026-05-25.
- Agent C (multi-author concurrency) — task `a93e8e48ecddb6832`, completed
  2026-05-25.
- File anchors процитированы inline в 15.3-15.6.
