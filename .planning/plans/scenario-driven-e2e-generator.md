# Plan: scenario-driven-e2e-generator

> Branch: TBD · Jira: TBD · Date: 2026-05-22 · Status: scaffold

## 0. TL;DR

### Было

```text
┌─ current state ─────────────────────────────────────────────────┐
│ E2E specs  │ писались вручную per-feature (G8/G9/G10 pattern)   │
│ Source     │ нет single source of truth для regression scope     │
│ Coverage   │ ~28 spec-файлов, нет явного mapping flow → spec     │
│ Sync       │ DOM/logic меняется → specs обновляются вручную      │
│ Generation │ Sonnet пишет spec по описанию в плане (ad-hoc)      │
└─────────────────────────────────────────────────────────────────┘
```

### Станет

```text
┌─ target state ──────────────────────────────────────────────────┐
│ Source     │ .planning/regression-scenarios.md — единый          │
│            │ scenario registry (structured markdown / YAML)      │
│ Pipeline   │ scan code → derive scenarios → walker → emit spec   │
│ Coverage   │ явный mapping: page/flow/role → scenario → spec     │
│ Sync       │ PR-triggered incremental rebuild или full rebuild    │
│ Output     │ apps/web/e2e/regression/auto/ — generated specs     │
└─────────────────────────────────────────────────────────────────┘
```

### Поток выполнения

```text
[wave-0]
  [Haiku: DOM scan apps/web/src] ──┐
  [Haiku: API scan apps/api/src] ──┤
                                   ▼
[wave-1]
  [Sonnet: синтез scenarios.md] ───┐
                                   ▼
[wave-2]
  [Sonnet×N: agent-browser walker] ──→ [emit Playwright spec per scenario]
                                   ▼
[wave-3]
  [Haiku: validate specs via vitest harness]
                                   ▼
  [DONE: apps/web/e2e/regression/auto/ populated]
```

### Одна строка

Генерация Playwright specs из единого scenario-файла через агентный pipeline
вместо ручного написания spec-файлов per-feature.

## 1. Architecture context

### Источники данных

```text
apps/web/src/app/         page routes → role access map
apps/web/src/components/  DOM structure → interactable elements
apps/api/src/modules/     business logic → expected state transitions
packages/shared/          Zod schemas → form field lists
```

### Data flow

```text
[DOM scan]    apps/web/src/app/**/*.tsx
     │           page list, route params, role guards
     ▼
[Logic scan]  apps/api/src/modules/**/*.ts
     │           service methods, guards, state transitions
     ▼
[Synthesizer] Sonnet — .planning/regression-scenarios.md
     │           scenario per flow: role + page + action + expected
     ▼
[Walker]      Sonnet + agent-browser
     │           navigates live app per scenario
     │           records selectors + assertions
     ▼
[Emitter]     tools/generate-e2e-specs.ts
     │           writes Playwright spec per scenario group
     ▼
[Harness]     apps/web/e2e/regression/auto/
              pnpm playwright test --config e2e/regression/...
```

### Интеграция с существующими specs

```text
apps/web/e2e/regression/
  ├── [manual specs — ~28 files]   сохраняются как есть
  └── auto/                        NEW — generated output only
      ├── lead-form.spec.ts
      ├── head-dashboard.spec.ts
      └── ...
```

Ручные specs имеют приоритет при конфликте имён. Generated specs живут в
отдельной директории и не перезаписывают manual.

## 2. Scenario format: открытый вопрос (см. §6)

Три кандидата:

```text
Option A: gherkin-like markdown
  ## Scenario: Lead submits report
  Given role=lead, page=/lead/report/[id]
  When user clicks Submit
  Then status=submitted, toast shown

Option B: structured YAML
  scenarios:
    - id: lead-submit-report
      role: lead
      page: /lead/report/:id
      steps: [click#submit-btn]
      expect: [status=submitted, toast]

Option C: ad-hoc markdown table
  | scenario | role | page | action | expect |
  |---|---|---|---|---|
  | lead-submit | lead | /lead/report/:id | click Submit | status=submitted |
```

Решение по формату требует явного выбора пользователя (см. §8 «От человека»).

## 3. Subagent roadmap

```text
wave-0 (parallel, Haiku)
  A: DOM scan
     - grep pages in apps/web/src/app/
     - extract role guards (middleware.ts, auth checks)
     - list interactable elements per page
  B: Logic scan
     - grep service methods apps/api/src/modules/
     - extract state transitions (status enums, guards)
     - list Zod schemas packages/shared/src/schemas/

wave-1 (Sonnet)
  C: synthesize .planning/regression-scenarios.md
     - merge A+B outputs
     - group by role × page × user flow
     - assign scenario IDs (SCN-001, SCN-002, ...)
     - flag coverage gaps vs existing manual specs

wave-2 (Sonnet×N, parallel per scenario group)
  D1..Dn: agent-browser walker
     - navigate live app per scenario
     - snapshot interactive elements
     - record selectors + sequence
     - emit Playwright spec draft

wave-3 (Haiku)
  E: validate emitted specs
     - lint spec files (eslint + prettier)
     - run typecheck on generated specs
     - dry-run playwright list tests (no server needed)
     - report unresolvable selectors or missing fixtures
```

## 4. Pipeline runner: tools/generate-e2e-specs.ts

### Responsibilities

```text
1. read .planning/regression-scenarios.md
2. parse scenario blocks into ScenarioRecord[]
3. spawn agent-browser walker subagents (wave-2)
4. collect spec drafts → write to apps/web/e2e/regression/auto/
5. run wave-3 validation
6. emit coverage report: scenarios covered / total
```

### CLI interface (draft)

```bash
# full rebuild
pnpm generate:e2e

# incremental (only scenarios modified since last run)
pnpm generate:e2e --since HEAD~1

# dry-run: print what would be generated
pnpm generate:e2e --dry-run

# single scenario
pnpm generate:e2e --scenario SCN-042
```

## 5. Files to create

```text
.planning/regression-scenarios.md          NEW — source of truth (NOT now)
tools/generate-e2e-specs.ts                NEW — pipeline runner
apps/web/e2e/regression/auto/.gitkeep      NEW — output dir marker
apps/web/e2e/regression/auto/              NEW — generated specs land here
```

Existing files to update:

```text
apps/web/package.json                      add "generate:e2e" script
.planning/plans/ (this file)               живёт как scaffold до старта
```

## 6. Open questions

| #   | Вопрос                                                  | Как решу автономно                          | Когда эскалирую                              |
| --- | ------------------------------------------------------- | ------------------------------------------- | -------------------------------------------- |
| Q1  | Format: gherkin vs YAML vs md-table?                    | Предпочту YAML (machine-readable)           | Если у тебя есть предпочтение — до wave-0    |
| Q2  | agent-browser vs Playwright codegen — что emit'ит spec? | agent-browser: snapshot → Sonnet пишет spec | Если codegen лучше покрывает динамику        |
| Q3  | Coverage target: all pages / all flows / risk-driven?   | Risk-driven по ролям lead+head              | Если хочешь full 100% coverage               |
| Q4  | Rebuild strategy: full vs incremental per PR?           | Incremental по умолчанию                    | Если CI time бюджет жёсткий                  |
| Q5  | Generated specs в git или .gitignore?                   | В git (reviewed + stable)                   | Если размер repo станет проблемой            |
| Q6  | Fixtures: real DB seeds vs MSW mocks?                   | Reuse existing seed data                    | Если generation требует изолированного state |

## 7. От человека

```text
┌─ требуется решение ─────────────────────────────────────────┐
│ 1. Format (Q1): YAML / gherkin / md-table?                  │
│ 2. Coverage scope (Q3): risk-driven / all-flows / all-pages │
│ 3. Generated specs в git (Q5): да / нет                     │
│ 4. Milestone target: v8.4 / v8.5 / отдельная ветка?         │
└─────────────────────────────────────────────────────────────┘

Всё остальное — агент делает сам.
```

## 8. Estimate

```text
wave-0 DOM+Logic scan     ~2h   Haiku × 2 parallel
wave-1 scenarios.md       ~1h   Sonnet
wave-2 walker × N         ~4h   Sonnet × ~15 scenario groups
wave-3 validation         ~1h   Haiku
tools/generate-e2e-specs  ~200 LoC TypeScript
generated specs output    ~30+ spec files, ~1500 LoC total

Total wall-clock: ~1 full session (8-10h async)
Milestone: v8.4 отдельным milestone или как phase в v8.5
```

## 9. Verification

```bash
# после wave-3 — все generated specs lint-clean
pnpm lint --filter @customreport/web

# typecheck на auto/ директории
pnpm typecheck

# playwright list (без сервера — только parse + compile)
pnpm --filter @customreport/web exec playwright test \
  --config=e2e/regression/playwright.regression.config.ts \
  --list

# coverage report
pnpm generate:e2e --dry-run --coverage-report
```

Сценарии проверки:

```text
# a. generated specs не конфликтуют с manual specs по именам
# b. все scenario IDs в scenarios.md имеют соответствующий spec-файл
# c. ни один generated spec не импортирует несуществующих fixtures
# d. typecheck passes — нет any-типов в generated output
# e. pnpm lint:md passes на scenarios.md
```

## 10. Side deliverables

```text
- .planning/regression-scenarios.md format decision → зафиксировать в
  CLAUDE.md/CONVENTIONS.md после Q1 ответа
- tools/generate-e2e-specs.ts добавить в pnpm scripts
- README.md обновить раздел E2E testing со ссылкой на scenarios.md
```

## 11. Связанный контекст

```text
Текущие e2e specs:              apps/web/e2e/regression/ (~28 файлов)
Паттерн написания (§22.12):     kurzweil-plan G8/G9/G10 — Sonnet пишет
                                spec по описанию в плане
Playwright config:              apps/web/e2e/regression/playwright.regression.config.ts
agent-browser tool:             agent-browser open / snapshot / click / fill
Existing seed/fixtures:         prisma/seed.ts + e2e/regression/helpers/
```
