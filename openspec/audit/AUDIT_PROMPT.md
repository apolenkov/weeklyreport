# CustomReport — Тотальный аудит 1195 файлов

> **Автор:** Sisyphus (DeepSeek V4 Flash)  
> **Дата:** 2026-07-18  
> **История сессии:** ~200 сообщений, 19 батчей, 4 волны  
> **Проблема:** Session isolation OpenCode вычищает `.audit-tmp/` между контекстами — пиши всё в `openspec/audit/`

---

## 0. ПОЛНЫЙ INVENTORY СКИЛЛОВ

Все скиллы, которые задействованы в этом аудите. Агенты запускаются последовательно в основной сессии через `task(subagent_type="explore"|"librarian", ...)`.

### Скиллы для ревью кода

| Скилл                                       | Когда использовать                                                                                                          | Как вызывать                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **`vercel-react-best-practices`**           | Каждый React/TSX батч — 70 правил (водопады, bundle, сервер, клиент, рендер, JS perf)                                       | `task(subagent_type="explore", load_skills=["vercel-react-best-practices"])` |
| **`vercel-composition-patterns`**           | Каждый React/TSX батч — composition, boolean props, compound components, use() vs useContext                                | `task(subagent_type="explore", load_skills=["vercel-composition-patterns"])` |
| **`web-design-guidelines`**                 | UI-батчи (dashboard, admin, report-sections, shared/ui) — semantic HTML, a11y, ARIA, контраст                               | `task(subagent_type="explore", load_skills=["web-design-guidelines"])`       |
| **`remove-ai-slops`**                       | Финишный проход после всех ревью — on branch changes: performance equivalences, excessive complexity, oversized modules     | Отдельный проход после всех ревью                                            |
| **`security-review` / `security-research`** | Отдельный security-аудит: 3 vulnerability hunters + 2 PoC engineers, доказательство эксплойта. Для API-модулей с PII и auth | Отдельный запуск `/security-review`                                          |
| **`code-review`**                           | Двухосевое ревью (Standards + Spec) diff'а после имплементации фиксов                                                       | `skill(name="code-review")`                                                  |
| **`review-work`**                           | Пост-имплементация: 5 параллельных агентов (Oracle + Codex + Grok) проверяют работу                                         | `skill(name="review-work")`                                                  |

### Скиллы для Council / Adversarial Verification

| Скилл                          | Когда использовать                                                              | Как вызывать                      |
| ------------------------------ | ------------------------------------------------------------------------------- | --------------------------------- |
| **`codex:adversarial-review`** | После сбора всех findings — Codex пытается опровергнуть каждое blocker/critical | `/codex:adversarial-review "..."` |
| **`codex:review`**             | Codex review с фокусом на имплементацию, а не дизайн                            | `/codex:review`                   |
| **`code-review:code-review`**  | GitHub PR review — проверка PR на соответствие стандартам                       | `/code-review:code-review`        |

### Скиллы для Batch-ревью (через task)

| Подтип агента | Когда                   | Загрузка                                                                    |
| ------------- | ----------------------- | --------------------------------------------------------------------------- |
| `explore`     | React/TSX батчи (фронт) | `load_skills=["vercel-react-best-practices","vercel-composition-patterns"]` |
| `explore`     | Pure TS/API батчи (бэк) | Без скиллов                                                                 |

## 1. КОНТЕКСТ ПРОЕКТА

```text
customreport — монорепо (pnpm + Turborepo)
├── apps/web/         — Next.js 16 / React 19 / Tailwind 4
├── apps/api/         — NestJS 11 / tRPC 11 / Prisma 7
├── packages/shared/  — Zod-схемы, tRPC-контракты
├── packages/ui/      — shadcn/ui компоненты
├── prisma/           — schema, seeds, destructive guard
├── e2e/              — Playwright, catalog-sweep
└── openspec/         — specs + backlog
```

### Команды

```bash
pnpm dev:watch          # docker compose dev
pnpm typecheck          # turbo run typecheck
pnpm lint               # eslint . && stylelint && lint:prisma:typecheck
pnpm test               # turbo run vitest
pnpm build              # turbo run build
```

### Роль «MVP Phase»

- Коммит и пуш прямо в main — pre-authorized
- Базы `_dev`/`_test`/`_uat` — одноразовые
- `prisma migrate reset` — ожидаемо и безопасно

---

## 2. 8 ОСЕЙ АУДИТА (Master Checklist)

Перед началом — создать `openspec/audit/MASTER_CHECKLIST.md`:

### Ось 1: TS Strictness (Google TS Guide)

- **1.1 blocker** — NO `any`. Использовать `unknown` + narrowing. `as any` = blocker
- **1.2 blocker** — NO `@ts-ignore` / `@ts-nocheck` / `@ts-expect-error`
- **1.3 critical** — NO non-null assertion (`!`). Вместо этого `?.` или явная проверка
- **1.4 major** — `interface` для публичных API, `type` для unions/intersections
- **1.5 major** — explicit return types на exported функциях
- **1.6 major** — proper generics
- **1.7 critical** — strictNullChecks: все null/undefined обработаны

### Ось 2: Next.js App Router (Vercel 70 Rules)

— Применять к `apps/web/src/**`

**2.1 Eliminating Waterfalls (CRITICAL)**

- `async-parallel` — Promise.all() для независимых
- `async-defer-await` — await только в нужной ветке
- `async-suspense-boundaries` — Suspense для потоковой загрузки
- `async-cheap-condition-before-await` — дешёвую проверку до await
- `async-dependencies` — better-all паттерн для частичных зависимостей (добавлено после ревью)
- `async-start-promises-early` — запуск промисов до await в NestJS контексте (добавлено после ревью)

**2.2 Bundle Size (CRITICAL)**

- `bundle-barrel-imports` — импорт напрямую, не через barrel
- `bundle-dynamic-imports` — next/dynamic для тяжёлых компонентов
- `bundle-defer-third-party` — аналитику после гидрации
- `bundle-analyzable-paths` — статически анализируемые пути
- `bundle-conditional` — загрузка модулей только при активации (добавлено после ревью)

**2.3 Server-Side Performance (HIGH)**

- `server-cache-react` — React.cache() для per-request dedup
- `server-hoist-static-io` — статику на module level
- `server-no-shared-module-state` — без shared module state под RSC
- `server-serialization` — минимум данных в client components
- `server-parallel-fetching` — параллельные fetch через композицию
- `server-after-nonblocking` — after() для неблокирующих операций
- `server-cache-lru` — LRU-кэш между запросами (добавлено после ревью)
- `server-parallel-nested-fetching` — цепочки зависимых fetch на элемент (добавлено после ревью)
- `server-dedup-props` — избежать дублирования сериализации RSC (добавлено после ревью)

**2.4 Client-Side Data Fetching (MEDIUM-HIGH)**

- `client-swr-dedup` — SWR для deduplication (или react-query)
- `client-passive-event-listeners` — `{ passive: true }`

**2.5 Re-render Optimization (MEDIUM)**

- `rerender-memo` — мемоизация тяжёлых компонентов
- `rerender-derived-state-no-effect` — стейт без effect
- `rerender-functional-setstate` — функциональный setState
- `rerender-no-inline-components` — без компонентов внутри компонентов
- `rerender-use-deferred-value` — useDeferredValue для дорогих рендеров
- `rerender-lazy-state-init` — lazy initialization useState
- `rerender-transitions` — startTransition для не-срочного
- `rerender-split-combined-hooks` — разделение хуков
- `rerender-defer-reads` — не подписываться на стейт только для колбэков (добавлено после ревью)
- `rerender-dependencies` — сузить зависимости эффекта до примитивов (добавлено после ревью)
- `rerender-move-effect-to-event` — логику в обработчики событий (добавлено после ревью)
- `rerender-derived-state` — подписка на derived booleans (добавлено после ревью)
- `rerender-memo-with-default-value` — поднять non-primitive props в константы (добавлено после ревью)

**2.6 Rendering Performance (MEDIUM)**

- `rendering-conditional-render` — тернарник, не `&&`
- `rendering-hoist-jsx` — статический JSX вне компонентов
- `rendering-usetransition-loading` — useTransition вместо loading
- `rendering-content-visibility` — content-visibility для длинных списков (добавлено после ревью)

**2.7 JavaScript Performance (LOW-MEDIUM)**

- `js-early-exit` — ранний выход из функций
- `js-index-maps` — Map для O(1) lookups
- `js-set-map-lookups` — Set/Map для поиска
- `js-flatmap-filter` — flatMap для map+filter
- `js-tosorted-immutable` — toSorted() для иммутабельности (добавлено после ревью)

**2.8 Advanced Patterns (LOW)**

- `advanced-init-once` — инициализация один раз
- `advanced-use-latest` — useLatest для стабильных callback refs

### Ось 3: React Composition (Vercel)

- **3.1 high** — `architecture-avoid-boolean-props` — без boolean props для вариантов
- **3.2 high** — `architecture-compound-components` — compound components + shared context
- **3.3 medium** — `state-decouple-implementation` — провайдер не знает про реализацию стейта
- **3.4 medium** — `state-context-interface` — generic interface: state/actions/meta
- **3.5 high** — `state-lift-state` — стейт в provider, не в компоненте
- **3.6 medium** — `patterns-explicit-variants` — явные варианты вместо булевых мод
- **3.7 medium** — `patterns-children-over-render-props` — children вместо renderX
- **3.8 medium** — `react19-no-forwardref` — ref как обычный проп (React 19)
- **3.9 medium** — `react19-use-instead-of-usecontext` — `use()` вместо `useContext()`

### Ось 4: Naming & Clean Code (Airbnb React)

- **4.1 major** — camelCase для переменных/функций
- **4.2 major** — PascalCase для React-компонентов
- **4.3 major** — UPPER_CASE для module-level констант
- **4.4 minor** — никаких сокращений (`argument`, не `arg`)
- **4.5 critical** — NO магические строки/числа → const/enum
- **4.6 major** — absolute imports через `@/`, не `../../../`
- **4.7 major** — no unused imports
- **4.8 major** — осмысленные имена (не `data`, `info`, `temp`)

### Ось 5: Cognitive Complexity (SonarQube)

- **5.1 critical** — guard clauses: ранний return/throw вместо вложенных if-else
- **5.2 major** — длина функции < 40 строк
- **5.3 critical** — NO мёртвый код (console.log, закомментированный код)
- **5.4 major** — NO unused variables
- **5.5 critical** — когнитивная сложность < 10
- **5.6 major** — один уровень абстракции
- **5.7 major** — NO switch > 3 case → Map/Record

### Ось 6: Security (OWASP)

- **6.1 blocker** — Input validation: все входящие данные через Zod
- **6.2 blocker** — SQL injection: проверять raw queries
- **6.3 blocker** — XSS: проверять `dangerouslySetInnerHTML`
- **6.4 blocker** — RLS/exposure: проверка прав в каждом процедуре
- **6.5 critical** — sensitive data: пароли/токены/PII не в логах/URL
- **6.6 critical** — open redirect
- **6.7 major** — rate limiting на мутациях

### Ось 7: UI/UX (Web Design Guidelines)

— Применять к `apps/web` + `packages/ui`

- **7.1 critical** — semantic HTML: `<nav>`, `<main>`, `<section>` вместо `<div>`
- **7.2 critical** — a11y: aria-labels, role, focus management
- **7.3 major** — color contrast: нет hardcoded цветов, только CSS-токены
- **7.4 major** — responsive: нет фиксированных px-ширин
- **7.5 major** — focus management: модалки/drawers ловят фокус
- **7.6 critical** — form labels: каждый input имеет label/aria-label
- **7.7 major** — error states: ошибки видны пользователю
- **7.8 major** — loading states: skeleton/spinner для асинхронных данных

### Ось 8: AI Slop Removal

- **8.1 blocker** — NO `as any`
- **8.2 blocker** — NO `catch(e) {}` без обработки
- **8.3 critical** — NO закомментированный код
- **8.4 critical** — NO `console.log` в production
- **8.5 major** — NO `setTimeout(0)`/`setInterval` без named constants
- **8.6 minor** — NO `// TODO:` / `// FIXME:`
- **8.7 critical** — NO магические литералы
- **8.8 blocker** — NO `any` в параметрах функций

---

## 3. ИНВЕНТАРИЗАЦИЯ (Stage 1)

```bash
# Получить точный список всех .ts/.tsx/.js/.jsx, исключая node_modules, .next, dist, build, .turbo, .d.ts
find . -type d \( -name node_modules -o -name '.next' -o -name '.next-sweep' \
  -o -name dist -o -name build -o -name '.turbo' -o -name '.git' \) -prune -false -o \
  -type f \( -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' \) \
  -not -name '*.d.ts' -not -path '*/__snapshots__/*' -print \
  | sed 's|^\./||' | sort > openspec/audit/FILE_LIST.txt

# Проверить чистоту
grep -c node_modules openspec/audit/FILE_LIST.txt  # должно быть 0
echo "Total: $(wc -l < openspec/audit/FILE_LIST.txt)"  # должно быть ~1195
```

**Ожидаемый результат:** 1195 файлов, 0 node_modules, 0 .next, 0 dist.

---

## 4. СТРУКТУРА БАТЧЕЙ (19 штук)

Группировка по модулям/фичам. **Макс 60 файлов на батч.** Если батч превышает 60 файлов — разделить на подбатчи (05a/05b, 17a/17b).

### Wave 1 (7 батчей, ~230 файлов)

```
Batch 01 — api/period module                    (27 файлов)   — pure TS
Batch 02 — api/reminders module                  (36 файлов)   — pure TS
Batch 03 — web/dashboard feature                 (41 файл)     — React + Vercel skills
Batch 04 — packages/shared schemas               (46 файлов)   — pure TS
Batch 05a — web/lib                              (~45 файлов)  — React + Vercel skills
Batch 05b — web/hooks                            (~39 файлов)  — React + Vercel skills
```

### Wave 2 (6 батчей, ~250 файлов)

```
Batch 06 — api/report-sections module            (45 файлов)  — pure TS + Vercel
Batch 07 — api/review+analytics+telemetry+search (49 файлов)  — pure TS + Vercel
Batch 08 — api/telegram+email+pdf-export+publication+snapshot (45 файлов) — pure TS + Vercel
Batch 09 — api/weekly-report module              (18 файлов)  — pure TS + Vercel
Batch 10 — web/report-sections model+index       (34 файла)   — React + Vercel
Batch 11 — web/report-sections ui part 1         (55 файлов)  — React + Vercel + Design
```

### Wave 3 (7 батчей, ~360 файлов)

```
Batch 12 — web/report-sections ui part 2         (54 файла)   — React + Vercel + Design
Batch 13 — web/admin feature                     (59 файлов)  — React + Vercel + Design
Batch 14 — web/period feature                    (53 файла)   — React + Vercel + Design
Batch 15 — web/slides feature                    (52 файла)   — React + Vercel + Design
Batch 16 — web/review + small features           (59 файлов)  — React + Vercel + Design
Batch 17a — web/shared/ui shell                  (~44 файла)  — React + Vercel + Design
Batch 17b — web/shared/ui ui-kit                 (~43 файла)  — React + Vercel + Design
```

### Wave 4 (2 батча, ~150 файлов)

```
Batch 18 — web/app pages + api app+main+test-utils (75 файлов) — React + Vercel
Batch 19 — packages/ui + prisma + e2e + configs    (53 файла)  — React + Design
```

---

## 5. ФОРМАТ ВЫВОДА (per-file verdict)

Каждый батч → JSONL-файл в `openspec/audit/batch-NN-NAME.jsonl`.

Формат строки (валидный JSON, одна строка — один файл):

```json
{
  "file": "apps/web/src/features/dashboard/ui/dashboard-page.tsx",
  "batch": 3,
  "verdict": "needs-attention",
  "issues": [
    {
      "axis": "nextjs-app-router",
      "rule": "2.5.1",
      "criticality": "major",
      "line": 42,
      "message": "DashboardContent props object recreated every render; missing useMemo",
      "context": "<DashboardContent data={{ reviewQ, ... }} />",
      "fix": "Wrap DashboardContent props in useMemo or split into individual props"
    },
    {
      "axis": "vercel-composition",
      "rule": "3.9",
      "criticality": "medium",
      "line": 32,
      "message": "useContext used instead of React 19 use()",
      "context": "const session = useContext(SessionContext);",
      "fix": "Replace with const session = use(SessionContext);"
    }
  ],
  "summary": "2 issues: 0 blocker, 0 critical, 1 major, 1 medium"
}
```

Если файл идеален:

```json
{
  "file": "apps/api/src/modules/period/index.ts",
  "batch": 1,
  "verdict": "exemplary",
  "issues": [],
  "summary": "CLEAN"
}
```

**CRITICAL RULE:**

- Каждый файл получает verdict. Никаких пропусков.
- `verdict` только: `exemplary` | `good` | `needs-attention` | `defect`
- Если есть blocker → `defect`. Если critical → `needs-attention` или `defect`.
- `summary` формат: `"N issues: B blocker, C critical, M major, m minor"` или `"CLEAN"`

---

## 6. ПРОМПТ ДЛЯ DEEP-АГЕНТА (template)

Каждый батч запускается через `task(category="deep", ...)`.

Промпт для API-батча (pure TS, оси 1,4,5,6,8):

```
Strict code audit. Read MASTER_CHECKLIST.md first at openspec/audit/MASTER_CHECKLIST.md.
Then read ALL listed files completely, analyze each against all applicable axes.
Output ONE JSONL line per file to openspec/audit/batch-NN-NAME.jsonl.

Files:
[file list, one per line]

Focus axes for these API files: 1 (TS Strictness), 4 (Naming), 5 (Cognitive Complexity), 6 (Security), 8 (AI Slop).
For each file: read fully, identify issues with axis/rule/criticality/line/context/fix, assign verdict.
Format: {"file":"path","batch":NN,"verdict":"exemplary|good|needs-attention|defect","issues":[...],"summary":"..."}
```

Промпт для React-батча (добавляет оси 2, 3, 7):

```
Focus axes: 2 (Next.js App Router — server/client, memo, Suspense, waterfalls),
3 (React Composition — boolean props, compound, useContext vs use()),
7 (UI/UX — semantic HTML, a11y, aria, focus management),
plus 1, 4, 5, 6, 8.
Check renderItem inline functions, && vs ternary, hardcoded colors, missing landmarks.
```

### REQUIRED SKILLS LOADING

**React/UI батчи** (все web-батчи + packages/ui + email-шаблоны):

```
load_skills=["vercel-react-best-practices","vercel-composition-patterns","web-design-guidelines"]
```

**Pure TS/API батчи** (api модули, packages/shared, prisma, e2e, конфиги):

```
# load_skills не указывать
```

**После всех ревью, перед хендоффом** — отдельные hard-скиллы:

| Этап       | Скилл                                      | Что делает                                                    |
| ---------- | ------------------------------------------ | ------------------------------------------------------------- |
| Council    | `/codex:adversarial-review "..."`          | Опровергает/подтверждает каждый blocker/critical finding      |
| Council    | `/security-review "API модули с PII: ..."` | 3 хантера + 2 PoC инженера, exploitability audit              |
| Pre-impl   | `/remove-ai-slops`                         | 10 категорий AI-мусора (any, пустые catch, oversized modules) |
| Pre-commit | `/review-work`                             | 5 параллельных агентов проверяют изменения                    |
| Post-impl  | `/code-review`                             | Standards + Spec, две оси                                     |
| PR check   | `/code-review:code-review`                 | GitHub PR review                                              |
| Research   | `/research "..."`                          | Уточнение best practices по неясным вопросам                  |

---

## 7. АРХИТЕКТУРА ЗАПУСКА (Session-proof)

**ВАЖНО:** Файлы, созданные subagent'ами, НЕ сохраняются между сессиями OpenCode. Решение:

1. Subagent пишет JSONL через `write` в `openspec/audit/batch-NN.jsonl`
2. Основная сессия читает файл через `read` (НЕ парсит `background_output`)
3. Накопить все строки в памяти, затем один `write` в конце (не append на каждый файл)
4. Файлы класть только в `openspec/audit/`, а не в `.audit-tmp/`

**Схема цикла:**

```
for wave in 1..4:
    запустить 5-6 батчей (sequential explore/librarian)
    для каждого батча:
        read("openspec/audit/batch-NN.jsonl")
        накопить строки в памяти
    write("openspec/audit/batch-NN.jsonl", all_lines)
```

**Рекомендуется:** все батчи запускать последовательно в основной сессии. Это медленнее, но гарантирует сохранность данных.

### Checkpointing и возобновление

- **CHECKPOINT.md** после каждого батча — фиксировать номер батча, количество файлов, количество найденных issues
- **Перед Council:** `wc -l batch-NN.jsonl` vs `wc -l batch-lists/batch-NN.txt` — проверить, что все файлы обработаны
- **Partial recovery:** `comm -23 <(sort batch-lists/batch-NN.txt) <(sort batch-NN-issues.txt)` для определения пропущенных файлов

### JSONL: накопление и однократная запись

```
- CORRECT: accumulate all lines in memory, then one `write`
- WRONG: `write` after each file (overwrites previous)
- WRONG: `cat >>` from bash (may conflict with permissions)
```

---

## Pre-flight: Проверка доступности инструментов

Перед Council/Security/Grok — проверить, какие инструменты доступны:

```bash
which codex && echo "codex: OK" || echo "codex: SKIP"
which grok && echo "grok: OK" || echo "grok: SKIP"
```

Трёхуровневый fallback для каждого инструмента:

1. Основной инструмент (codex/grok/opencode)
2. Альтернативный CLI
3. Ручной режим (через веб-интерфейс)

---

## 8. COUNCIL (Adversarial Verification)

После всех батчей запустить 4 этапа верификации с использованием всех заявленных скиллов:

### 8.1. Собрать все blocker/critical findings

```bash
grep -o '"criticality":"blocker"\|"criticality":"critical"' openspec/audit/batch-*.jsonl | wc -l
```

### 8.2. `/codex:adversarial-review` — Codex пытается опровергнуть каждую находку

```
/codex:adversarial-review "Read ALL openspec/audit/batch-*.jsonl files. For every finding with criticality=blocker or critical:
1. Read the source file at the given line
2. Determine if the finding is a REAL defect or a false positive (FP)
3. If FP: cite the exact code that makes the observation wrong
4. If CONFIRMED: keep it with reasoning
5. Return per-finding verdict: CONFIRMED | PARTIAL | REFUTED"
```

### 8.3. `/security-review` — Хард security на PII/logging findings

```
/security-review "openspec/audit/batch-*.jsonl findings with axis=security or rule=6.*
Focus on: C01 (leadName in logs), C02 (recipientEmail in logs).
Prove exploitability or refute. Include:
- Data flow: where does PII enter the log sink?
- Classification: information leak vs acceptable debug logging
- Fix: how to eliminate PII (use leadId, hash email, redact)"
```

### 8.4. Opus/Grok параллельно

```bash
grok -p "Review openspec/audit/REGISTRY.md. Spot-check 10 random 'exemplary' files. Any misses?"
```

### 8.5. Completeness audit

Проверить, что каждый файл из `openspec/audit/FILE_LIST.txt` упомянут хотя бы в одном `batch-*.jsonl`.

```bash
comm -23 <(sort openspec/audit/FILE_LIST.txt) <(cat openspec/audit/batch-*.jsonl | python3 -c "
import sys,json; [print(json.loads(l)['file']) for l in sys.stdin]" 2>/dev/null | sort)
```

Должен выдать 0 строк.

---

## 9. ФИНАЛЬНЫЙ REGISTRY

Скомпилировать `openspec/audit/REGISTRY.md` со структурой:

```markdown
# STRICT CODE STYLE REGISTRY

**Дата:** ...  
**Обработано:** N файлов  
**Процесс:** 19 батчей, 4 волны  
**Council:** Codex + Opus + Grok

## Ментальный индекс
```

customreport/
├── apps/web/src/ (607)
│ ├── features/ (~500)
│ ├── lib/ (~70)
│ ├── shared/ui/ (~42)
│ └── app/ (~65)
├── apps/api/src/ (469)
├── packages/shared/ (46)
├── packages/ui/ (27)
├── prisma/ (12)
├── e2e/ (11)
└── корень (12)

```

## Сводная таблица по осям
| Ось | Blocker | Critical | Major | Minor |
|-----|---------|----------|-------|-------|
| 1. TS Strictness | ... | ... | ... | ... |
| 2. Next.js | ... | ... | ... | ... |
| ... | ... | ... | ... | ... |

## Per-blocker таблица (топ-20)
| ID | Файл | Строка | Ось | Описание | Фикс |

## Per-critical таблица (топ-10)

## Per-major таблица (топ-10 function length)

## Mermaid Diagram
\`\`\`mermaid
mindmap
  root((Code Quality))
    ...
\`\`\`

## Priority Recommendations
P0 — Немедленно: 27 blocker
P1 — Высокий: criticals
P2 — Средний: majors
```

---

## 10. ХЕНДОФФ НА ИМПЛЕМЕНТАЦИЮ

После REGISTRY — создать `openspec/audit/HANDOFF_TO_IMPLEMENT.md` с:

### Оркестрация 3 агентов (sequential phases)

**Фаза 1 — Claude (P0+P1 архитектурные):**

- P0 empty catch → logger, P0 as any → generic types
- P1 semantic HTML, P1 useContext → use()
- Декомпозиция жирных компонентов, explicit return types
- → **commit** после фазы

**Фаза 2 — Codex (P1+P2 механические, ТОЛЬКО на untouched файлах):**

- P1 magic strings → shared constants (~60 файлов)
- P1 hex/rgba → CSS var(), P1 && → ternaries
- P2 magic numbers → constants, P2 TODO cleanup
- → **commit** после фазы

**Фаза 3 — Grok (P2 косметика, на untouched):**

- P2 archaeology comments, .js extension consistency
- Лишние eslint-disable
- → **commit** после фазы

**File ownership:** после каждой фазы проверять `git log --oneline -- <file>` для каждого изменённого файла, чтобы убедиться, что фаза не затронула чужие изменения.

### Правила для всех

- Не менять поведение. Только кодстайл/архитектура.
- `pnpm typecheck && pnpm lint` до каждого коммита.
- Прямо в main (MVP phase — pre-authorized).
- UI-строки только English.
- Файлы <250 строк, функции <40 строк, zero any, zero let.

---

## 11. ПОЛНЫЙ СПИСОК ФАЙЛОВ ПО БАТЧАМ

### Batch 01 — api/period (27)

```
apps/api/src/modules/period/__tests__/lifecycle-write-gate.test.ts
apps/api/src/modules/period/application/period-factory.test.ts
apps/api/src/modules/period/application/period-factory.ts
apps/api/src/modules/period/application/period-telemetry.port.ts
apps/api/src/modules/period/application/period.contract.test.ts
apps/api/src/modules/period/application/period.service.test.ts
apps/api/src/modules/period/application/period.service.ts
apps/api/src/modules/period/application/publish-side-effects.ts
apps/api/src/modules/period/domain/period-transition.test.ts
apps/api/src/modules/period/domain/period-transition.ts
apps/api/src/modules/period/index.ts
apps/api/src/modules/period/infrastructure/auto-archiver.scheduler.test.ts
apps/api/src/modules/period/infrastructure/auto-archiver.scheduler.ts
apps/api/src/modules/period/infrastructure/auto-publisher.scheduler.test.ts
apps/api/src/modules/period/infrastructure/auto-publisher.scheduler.ts
apps/api/src/modules/period/infrastructure/period-creator.scheduler.test.ts
apps/api/src/modules/period/infrastructure/period-creator.scheduler.ts
apps/api/src/modules/period/infrastructure/period-prometheus-telemetry.adapter.ts
apps/api/src/modules/period/infrastructure/period-uniqueness.integration.test.ts
apps/api/src/modules/period/infrastructure/period.integration.test.ts
apps/api/src/modules/period/infrastructure/period.prisma-repository.test.ts
apps/api/src/modules/period/infrastructure/period.prisma-repository.ts
apps/api/src/modules/period/infrastructure/period.publish-atomicity.integration.test.ts
apps/api/src/modules/period/infrastructure/period.reopen-atomicity.integration.test.ts
apps/api/src/modules/period/infrastructure/period.single-active-reopen.integration.test.ts
apps/api/src/modules/period/module.ts
apps/api/src/modules/period/period.module.ts
```

### Batch 02 — api/reminders (36)

```
apps/api/src/modules/reminders/index.ts
apps/api/src/modules/reminders/policy-applicator.perf.test.ts
apps/api/src/modules/reminders/policy-applicator.service.ts
apps/api/src/modules/reminders/policy-applicator.test.ts
apps/api/src/modules/reminders/reminders-bullmq-enqueuer.adapter.ts
apps/api/src/modules/reminders/reminders-dedupe-key.ts
apps/api/src/modules/reminders/reminders-due-rules.prisma-query.ts
apps/api/src/modules/reminders/reminders-enqueue.ts
apps/api/src/modules/reminders/reminders-escalation-grouping.ts
apps/api/src/modules/reminders/reminders-execution-pagination.ts
apps/api/src/modules/reminders/reminders-queue-payload.test.ts
apps/api/src/modules/reminders/reminders-queue-payload.ts
apps/api/src/modules/reminders/reminders-reaper.scheduler.test.ts
apps/api/src/modules/reminders/reminders-reaper.scheduler.ts
apps/api/src/modules/reminders/reminders-row-mappers.ts
apps/api/src/modules/reminders/reminders-rule.prisma-query.ts
apps/api/src/modules/reminders/reminders-scope.prisma-query.ts
apps/api/src/modules/reminders/reminders-scope.repository-stub.ts
apps/api/src/modules/reminders/reminders-scope.service.ts
apps/api/src/modules/reminders/reminders-telemetry.adapter.ts
apps/api/src/modules/reminders/reminders.adapters.test.ts
apps/api/src/modules/reminders/reminders.contract.test.ts
apps/api/src/modules/reminders/reminders.dedupe-key.test.ts
apps/api/src/modules/reminders/reminders.errors.ts
apps/api/src/modules/reminders/reminders.integration.test.ts
apps/api/src/modules/reminders/reminders.module.ts
apps/api/src/modules/reminders/reminders.policy.contract.test.ts
apps/api/src/modules/reminders/reminders.policy.integration.test.ts
apps/api/src/modules/reminders/reminders.ports.ts
apps/api/src/modules/reminders/reminders.prisma-repository.integration.test.ts
apps/api/src/modules/reminders/reminders.prisma-repository.ts
apps/api/src/modules/reminders/reminders.scheduler.test.ts
apps/api/src/modules/reminders/reminders.scheduler.ts
apps/api/src/modules/reminders/reminders.service.scope.test.ts
apps/api/src/modules/reminders/reminders.service.test.ts
apps/api/src/modules/reminders/reminders.service.ts
```

### Batch 03 — web/dashboard (42)

```
apps/web/src/features/dashboard/index.ts
apps/web/src/features/dashboard/model/dashboard-counts.ts
apps/web/src/features/dashboard/model/dashboard-escalations.ts
apps/web/src/features/dashboard/model/dashboard-kpi.ts
apps/web/src/features/dashboard/model/dashboard-lead-presentation.ts
apps/web/src/features/dashboard/model/dashboard-lead-priority.ts
apps/web/src/features/dashboard/model/dashboard-lead-rows.ts
apps/web/src/features/dashboard/model/dashboard-leads.ts
apps/web/src/features/dashboard/model/dashboard-queue.fixtures.ts
apps/web/src/features/dashboard/model/dashboard-queue.test.ts
apps/web/src/features/dashboard/model/dashboard.test.ts
apps/web/src/features/dashboard/model/dashboard.ts
apps/web/src/features/dashboard/ui/alert-bar.test.tsx
apps/web/src/features/dashboard/ui/alert-bar.tsx
apps/web/src/features/dashboard/ui/blocked-at-risk-product-card.tsx
apps/web/src/features/dashboard/ui/blocked-at-risk-table.test.tsx
apps/web/src/features/dashboard/ui/blocked-at-risk-table.tsx
apps/web/src/features/dashboard/ui/dashboard-content.tsx
apps/web/src/features/dashboard/ui/dashboard-page.fixtures.ts
apps/web/src/features/dashboard/ui/dashboard-page.test.tsx
apps/web/src/features/dashboard/ui/dashboard-page.tsx
apps/web/src/features/dashboard/ui/dashboard-panel-state.tsx
apps/web/src/features/dashboard/ui/dashboard-queue-mutations.test.tsx
apps/web/src/features/dashboard/ui/dashboard-revoke-all-control.tsx
apps/web/src/features/dashboard/ui/dashboard-skeleton.test.tsx
apps/web/src/features/dashboard/ui/dashboard-skeleton.tsx
apps/web/src/features/dashboard/ui/dashboard-source-slot.tsx
apps/web/src/features/dashboard/ui/kpi-cards.test.tsx
apps/web/src/features/dashboard/ui/kpi-cards.tsx
apps/web/src/features/dashboard/ui/lead-queue-actions.test.tsx
apps/web/src/features/dashboard/ui/lead-queue-actions.tsx
apps/web/src/features/dashboard/ui/lead-queue-detail.tsx
apps/web/src/features/dashboard/ui/lead-summary-table.test.tsx
apps/web/src/features/dashboard/ui/lead-summary-table.tsx
apps/web/src/features/dashboard/ui/remind-lead-button.tsx
apps/web/src/features/dashboard/ui/reopen-requests-card.test.tsx
apps/web/src/features/dashboard/ui/reopen-requests-card.tsx
apps/web/src/features/dashboard/ui/request-changes-button.tsx
apps/web/src/features/dashboard/ui/revoke-lead-button.tsx
apps/web/src/features/dashboard/ui/use-dashboard-data.ts
apps/web/src/features/dashboard/ui/use-dashboard-query-recovery.ts
```

### Batch 04 — packages/shared (46)

```
packages/shared/src/admin/reminder-policy.schema.test.ts
packages/shared/src/admin/reminder-policy.schema.ts
packages/shared/src/auth/index.ts
packages/shared/src/auth/saml-profile.test.ts
packages/shared/src/auth/saml-profile.ts
packages/shared/src/constants.test.ts
packages/shared/src/constants.ts
packages/shared/src/index.ts
packages/shared/src/name/user-name.test.ts
packages/shared/src/name/user-name.ts
packages/shared/src/schemas/analytics.test.ts
packages/shared/src/schemas/analytics.ts
packages/shared/src/schemas/auth.contract.test.ts
packages/shared/src/schemas/auth.test.ts
packages/shared/src/schemas/auth.ts
packages/shared/src/schemas/canonical-status.test.ts
packages/shared/src/schemas/canonical-status.ts
packages/shared/src/schemas/integrations.test.ts
packages/shared/src/schemas/integrations.ts
packages/shared/src/schemas/organization.test.ts
packages/shared/src/schemas/organization.ts
packages/shared/src/schemas/period.schema.test.ts
packages/shared/src/schemas/period.schema.ts
packages/shared/src/schemas/project-activity.schema.ts
packages/shared/src/schemas/project-activity.test.ts
packages/shared/src/schemas/report-primitives.schema.test.ts
packages/shared/src/schemas/report-primitives.schema.ts
packages/shared/src/schemas/report.schema.ts
packages/shared/src/schemas/report.test.ts
packages/shared/src/schemas/report.ts
packages/shared/src/schemas/review.schema.ts
packages/shared/src/schemas/search.test.ts
packages/shared/src/schemas/search.ts
packages/shared/src/schemas/section-validation.schema.ts
packages/shared/src/schemas/section.schema.ts
packages/shared/src/schemas/stage-names.test.ts
packages/shared/src/schemas/stage-names.ts
packages/shared/src/schemas/stage.schema.ts
packages/shared/src/schemas/telemetry.test.ts
packages/shared/src/schemas/telemetry.ts
packages/shared/src/schemas/web-vitals.test.ts
packages/shared/src/schemas/web-vitals.ts
packages/shared/src/time.ts
packages/shared/src/trpc/index.ts
packages/shared/src/trpc/middleware/role.test.ts
packages/shared/src/trpc/middleware/role.ts
```

### Batch 05a — web/lib (~45)

Полный список — см. `apps/web/src/lib/*.ts` из FILE_LIST.txt, примерно 45 файлов.

### Batch 05b — web/hooks (~39)

Полный список — см. `apps/web/src/hooks/*.ts` из FILE_LIST.txt, примерно 39 файлов.

### Batch 06 — api/report-sections (45)

Полный список — все файлы из `apps/api/src/modules/report-sections/`.

### Batch 07 — api/review+analytics+telemetry+project-activity+search (49)

Все файлы из:

- `apps/api/src/modules/review/` (15)
- `apps/api/src/modules/analytics/` (11)
- `apps/api/src/modules/telemetry/` (10)
- `apps/api/src/modules/project-activity/` (6)
- `apps/api/src/modules/search/` (7)

### Batch 08 — api/telegram+email+pdf-export+publication+snapshot (45)

Все файлы из:

- `apps/api/src/modules/telegram/` (10)
- `apps/api/src/modules/email/` (6)
- `apps/api/src/modules/pdf-export/` (15)
- `apps/api/src/modules/publication/` (9)
- `apps/api/src/modules/published-report-snapshot.ts` + characterization test + test (3)
- `apps/api/src/modules/report-escalations.ts` (1)

### Batch 09 — api/weekly-report (18)

Все файлы из `apps/api/src/modules/weekly-report/`.

### Batch 10 — web/report-sections model+index (34)

Все файлы из `apps/web/src/features/report-sections/` кроме `ui/`.

### Batch 11 — web/report-sections ui part 1 (55)

Первая половина файлов из `apps/web/src/features/report-sections/ui/` (первые ~55 по алфавиту от activity-lanes-block до lead-form.tsx).

### Batch 12 — web/report-sections ui part 2 (54)

Вторая половина файлов из `apps/web/src/features/report-sections/ui/` (от lead-section-preview-auth до weekly-report-skeleton).

### Batch 13 — web/admin (59)

Все файлы из `apps/web/src/features/admin/`.

### Batch 14 — web/period (53)

Все файлы из `apps/web/src/features/period/`.

### Batch 15 — web/slides (52)

Все файлы из `apps/web/src/features/slides/`.

### Batch 16 — web/review + small features (59)

- `apps/web/src/features/review/` (32)
- `apps/web/src/features/analytics/` (6)
- `apps/web/src/features/landing/` (8)
- `apps/web/src/features/organization/` (4)
- `apps/web/src/features/pdf-export/` (4)
- `apps/web/src/features/telemetry/ui/web-vitals-reporter.tsx` (1)
- `apps/web/src/features/viewer/` (4)
- `apps/web/src/server/auth/session.ts` (1)

### Batch 17a — web/shared/ui shell (~44)

Все файлы из `apps/web/src/shared/ui/` — report-shell, navigation (первые ~44 по алфавиту).

### Batch 17b — web/shared/ui ui-kit (~43)

Все файлы из `apps/web/src/shared/ui/` — UI-кит (оставшиеся ~43 файла).

### Batch 18 — web/app pages + api remaining (75)

- `apps/web/src/app/` (65)
- `apps/web/src/test-utils/` (5)
- `apps/web/vitest.config.ts` + `vitest.setup.ts` (2)
- `apps/api/src/app.module.ts` + tests + `main.ts` (4)
- `apps/api/src/test-utils/` (6)
- `apps/api/vitest.config.ts` + `vitest.integration.config.ts` (2)

### Batch 19 — packages/ui + prisma + e2e + root configs (53)

- `packages/ui/` (27)
- `prisma/` (12)
- `e2e/` (11)
- `eslint.config.ts` + `prisma.config.ts` + `vitest.prisma.config.ts` (3)

Полные списки файлов — получить через `find` или `git ls-files`, отфильтровав по путям.

---

## 12. ИЗВЕСТНЫЕ РЕЗУЛЬТАТЫ (из первой попытки)

Сканирование через grep по всему дереву дало:

### Blocker (27)

- **7x `as any`** — Test files: `apps/web/src/test-utils/mock-trpc.test.ts` (строки 57,68,88,93,107,171,192) и `apps/web/src/lib/trpc.test.ts` (строка 143)
- **20x empty catch** — через всё дерево (см. STRICT_CODE_STYLE_REGISTRY.md B08-B21)

### Critical (~97)

- **PII в логах:** `leadName` в `reminders-due-rules.prisma-query.ts` (строка 149), `recipientEmail` в `reminders.scheduler.ts` (строка 47)
- **Магические строки/цвета:** статусы `"active"`, `"draft"`, `"published"`, `"deadline"`, `"escalation"`, хардкод цветов `#6366f1`, `rgba(0,0,0,0.02)` и т.д.

### Major (~453)

- **200+ функций >40 строк** — особенно UI компоненты: LeadForm (217), JobsTab (284), RemindersTab (256), ProductsTab (276), useLeadFormAutosave (258), useItemEditDialog (225)
- **Semantic HTML** — div-обёртки вместо section/main в dashboard, admin, report-sections
- **`&&` вместо тернарников** — ~20 мест
- **inline render functions** — renderItem, renderAccordion
- **Относительные импорты `../../../`** — вместо `@/`

### Minor (~270)

- TODO-комментарии (~30)
- switch >3 case (~5)
- `useContext` вместо `use()` (~2)
- `.js` extension inconsistency

---

## 13. ЧТО НЕ ДЕЛАТЬ

❌ **НЕ писать в `.audit-tmp/`** — Session isolation OpenCode вычищает  
✅ Писать в `openspec/audit/`

❌ **НЕ запускать 19 батчей одним махом** — упадёт по лимитам  
✅ Запускать волнами по 5-6 батчей

❌ **НЕ доверять subagent'ам сохранение файлов** — их файлы не видны в следующей сессии  
✅ Сразу после получения результата — сохранять через `write` в основной сессии

❌ **НЕ перепроверять уже готовые результаты grep'ом** — кодграф + grep точнее  
✅ Blockers (as any, empty catch) можно grep'ом, остальное — через полное чтение файлов

❌ **НЕ использовать `any`-фиксы в тестах** — `as any` в mock-trpc.test.ts вызвано ограничениями TRPCProxy типа  
✅ Добавить `// eslint-disable-next-line @typescript-eslint/no-explicit-any` с комментарием, почему

❌ **НЕ заменять пустые catch без анализа** — многие intentional (бесшумная деградация localStorage, сетевые ошибки)  
✅ Добавить комментарий с обоснованием ИЛИ минимальный `logger.error`

---

## 14. ЧЕКЛИСТ ГОТОВНОСТИ ПЕРЕД СТАРТОМ

- [ ] Создана `openspec/audit/` директория
- [ ] Создан `openspec/audit/MASTER_CHECKLIST.md` (раздел 2 этой инструкции)
- [ ] Создан `openspec/audit/FILE_LIST.txt` (раздел 3)
- [ ] Проверено `grep -c node_modules FILE_LIST.txt` = 0
- [ ] Подтверждён `wc -l FILE_LIST.txt` = ~1195
- [ ] Выбрана стратегия сохранения: **пишу через `write` в основной сессии**

---

## 15. RATE LIMITS И УПРАВЛЕНИЕ МОДЕЛЯМИ

### Приоритетная лестница моделей

1. **DeepSeek V4 Flash** (основная)
2. **Claude Haiku 4** (fallback 1)
3. **Grok 3 Mini** (fallback 2)
4. **GPT-5.1 Mini** (fallback 3)

N/A: Kimi K2.7, GLM (known rate limit issues)

### Retry-логика

- При ошибке rate limit: пауза **120 секунд**
- Переключение на следующую модель по приоритетной лестнице
- Если все fallback-модели недоступны — перейти в sequential mode

### Concurrency

- **Макс 3 concurrent** задачи
- Пауза **30 секунд** между волнами

---

_Скомпилировано из 200+ сообщений сессии Sisyphus | 2026-07-18 | От первой inventory до финального registry_
