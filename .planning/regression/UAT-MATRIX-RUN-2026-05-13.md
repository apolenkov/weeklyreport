# UAT MATRIX run — night-throw 2026-05-13

Branch: `fix/PRJ-11/uat-v7-2026-05-12` · Target: PR #3 → `main`
Plan: `.sisyphus/plans/merry-zooming-blanket.md`

## Phase A — Warmup baseline (2026-05-13, начало ночи)

### Окружение

| Слой                        | Статус                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| docker compose (9 сервисов) | все healthy (api+web restart применён, prisma generate refresh)                                                                                                     |
| rtk CLI                     | присутствует (`/opt/homebrew/bin/rtk`)                                                                                                                              |
| tsx                         | `apps/api/node_modules/.bin/tsx` (root `pnpm uat:parse-dom` сломан — workaround: `pnpm --filter @customreport/api exec tsx ../../tools/uat-extractor/parse-dom.ts`) |

### Baseline tests (Phase A)

| Слой       | Result   | Files | Tests    |
| ---------- | -------- | ----- | -------- |
| tsc web    | ✓ exit 0 | —     | —        |
| tsc api    | ✓ exit 0 | —     | —        |
| vitest web | ✓ exit 0 | 50    | 392 PASS |
| vitest api | ✓ exit 0 | 78    | 914 PASS |

Все green. Pre-existing 8 vitest fails из `AUDIT-2026-05-11.md` (LeadFormSyncBridge, WeeklyReportPage reopen) — **в текущем прогоне отсутствуют**. Счётчики выросли по сравнению с audit'ом (web 357→392, api 891→914).

### Bundle size baseline

| Подкаталог                  | Размер                                      |
| --------------------------- | ------------------------------------------- |
| `apps/web/.next/standalone` | 54 MB                                       |
| `apps/web/.next/server`     | 3.6 MB                                      |
| `apps/web/.next/cache`      | 314 MB (нерелевантно для production bundle) |
| **итог `.next/`**           | **1.6 GB** (включая cache)                  |

Phase E.2 будет сравнивать `standalone` (54 MB) — production-grade bundle.

### Config audit

Файлы существуют:

- `.env`, `.env.example`, `docker-compose.yml`, `docker-compose.dev.yml`, `prisma/schema.prisma`

Сюрпризов нет.

### UAT-MATRIX baseline coverage

После Phase A.7 (`uat:parse-dom`) → `tools/uat-extractor/matrix.json`. Числа фиксируются на следующем шаге.

---

## Phase 0 — Cross-session inventory (стартовал параллельно с Phase A)

W1: 4 параллельных Haiku-агента сканируют 7 непросканированных JSONL.

Промежуточные результаты получены от 3 из 4 агентов:

- **d6bf2f96 + cross-grep по всем 9 JSONL**: новых открытых ID не найдено. UFB-073 (851 mentions), UFB-068, UFB-066 уже в backlog. Phase-54/55 предполагается deferred.
- **d8fd4ba2 + d41f4696**: 2 open (заглушки с `throw new Error('Not implemented')` — это Phase 54/55 которые locked-deferred) + 4 already-committed (A6/A16/A34/A38).
- **8357784d + 299d87c3 + 3c79c32f**: пусто, ничего нового.
- **32223757 (текущая сессия)**: ещё работает.

Промежуточный вывод: **новых забытых хвостов из 7 JSONL не выявлено**. Главное содержание идёт из `bba7038f` + `4a7bc368` уже в digest.

Финальный `CROSS-SESSION-INVENTORY-2026-05-13.md` будет записан после 4-го агента.

---

## Следующие фазы (план)

- Phase B.1 — 3 missing UAT-SCENARIO files (02-auth, 04-admin-users, 08-head-dashboard)
- Phase B.2 — `uat:coverage` скрипт + поправить root `uat:parse-dom` workaround
- Phase B.3 — Regenerate
- Phase C.1 → C.3 — Playwright run + triage + fix waves
- Phase D.1 → D.3 — A-bug excavation + closing
- Phase E → F → G — full regression + cross-AI review + push

Прогресс отслеживается через [S01..S15] tasks.
