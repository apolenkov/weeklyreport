# DIFF v1 → v2 — 10 изменений AUDIT_PROMPT.md

> **Дата:** 2026-07-18
> **План:** `.omo/audit-prompt-plan.md` > **v1:** 883 строки → **v2:** 971 строка (+88)

---

### 1. [BLOCKER] Section 0 — Inventory скиллов переписан

- `category="deep"` + `load_skills` заменены на `subagent_type="explore"` + `load_skills`
- Убрано упоминание batch-агентов с `category="deep"` — всё ревью sequential в основной сессии
- Таблица скиллов: колонка «Категория» → «Подтип агента», ссылки на `task(subagent_type="explore", ...)`

### 2. [CRITICAL] Section 2 — Добавлено 13 пропущенных Vercel правил

- **2.1 Waterfalls:** `async-dependencies`, `async-start-promises-early`
- **2.2 Bundle:** `bundle-conditional`
- **2.3 Server:** `server-cache-lru`, `server-parallel-nested-fetching`, `server-dedup-props`
- **2.5 Re-render:** `rerender-defer-reads`, `rerender-dependencies`, `rerender-move-effect-to-event`, `rerender-derived-state`, `rerender-memo-with-default-value`
- **2.6 Rendering:** `rendering-content-visibility`
- **2.7 JS Perf:** `js-tosorted-immutable`
- Каждое с пометкой _(добавлено после ревью)_

### 3. [CRITICAL] Fix criticality

- **7.1:** `major` → `critical` (semantic HTML — WCAG requirement)
- **5.7:** `minor` → `major` (switch >3 case нарушает Open/Closed Principle)

### 4. [BLOCKER] Section 7 — Save protocol переписан

- **Было:** Subagent → `background_output` → парсинг → `write` (хрупко)
- **Стало:** Subagent пишет JSONL через `write` → основная сессия читает через `read`
- Accumulate все строки в памяти, `write` один раз в конце
- Удалены «Альтернатива А/Б» и гибридная рекомендация

### 5. [CRITICAL] Split крупных батчей

- **Batch 05** (84 файла) → **05a lib** (~45) + **05b hooks** (~39)
- **Batch 17** (87 файлов) → **17a shell** (~44) + **17b ui-kit** (~43)
- Добавлено правило: макс 60 файлов на батч
- Wave 1: 6→7 батчей, Wave 3: 6→7 батчей

### 6. [CRITICAL] +Section 15: Rate Limits

- Model priority ladder (DeepSeek V4 Flash → Claude → Grok → GPT)
- Retry: 120s пауза → fallback модель → sequential mode
- Concurrency: макс 3, пауза 30s между волнами
- N/A: Kimi K2.7, GLM (known rate limit issues)

### 7. [CRITICAL] +Checkpointing/Resume

- CHECKPOINT.md после каждого батча
- `wc -l batch-NN.jsonl` vs `wc -l batch-lists/batch-NN.txt` перед Council
- Partial recovery: `comm -23` для недостающих файлов

### 8. [CRITICAL] Sequential cross-agent orchestration

- **Было:** Параллельные агенты (Claude + Codex + Grok одновременно)
- **Стало:** 3 последовательные фазы с commit после каждой:
  1. Claude (P0+P1 архитектурные) → commit
  2. Codex (P1+P2 механические, untouched файлы) → commit
  3. Grok (P2 косметика, untouched) → commit
- Добавлено: File ownership через `git log --oneline -- file` после каждой фазы

### 9. [MAJOR] +Pre-flight tool check

- Перед Council/Security/Grok: `which codex && echo "codex: OK" || echo "codex: SKIP"`, `which grok`
- Трёхуровневый fallback для каждого инструмента

### 10. [CRITICAL] JSONL accumulate-then-write-once

- CORRECT: накопить все строки в memory, затем один `write`
- WRONG: `write` после каждого файла (перезаписывает)
- WRONG: `cat >>` из bash (конфликт прав)

---

## Статистика

| Метрика      | v1  | v2  | Δ   |
| ------------ | --- | --- | --- |
| Строки       | 883 | 971 | +88 |
| Секции       | 14  | 15  | +1  |
| Vercel rules | 33  | 46  | +13 |
| Батчей       | 19  | 21  | +2  |
