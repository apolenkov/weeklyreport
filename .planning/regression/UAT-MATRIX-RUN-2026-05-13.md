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

---

## Phase D — A-bug closures (итог ночи)

37 из 39 A-багов закрыты коммитами на ветке. Полная таблица в `UAT-V7-OPEN-ABUGS.md`.

Ключевые группы:

- **C2 — period-integrity** (A24 + A21): UNIQUE INDEX на Period, дедуп открытого отчёта → `27ece23`
- **A36 seed**: Finance группа + правильное распределение лидов → `3503e12`
- **A3 admin filters**: TabFilter + role filter + text search → `00dabff`
- **A13+A15 form-race**: key-reset + stale deps + useEffect → `c60ccc2`
- **A38 UAT-MATRIX**: scenario catalog + DOM extractor + Playwright generator → `025c5d6`, `7db6d8e`, `ffd5158`
- **A34 presentation**: lead section preview + head presentation mode → `425903d`
- **A17+A20 UX**: FAB hide (CSS :has) + keepPreviousData global → `f433d0a`

Locked-deferred: Phase 54 (AI/RAG), Phase 55 (Telegram), A35 (director testing).

---

## Phase E — Full regression (финал)

| Слой                      | Files | Tests    | Status               |
| ------------------------- | ----- | -------- | -------------------- |
| tsc web                   | —     | —        | ✓ 0 err              |
| tsc api                   | —     | —        | ✓ 0 err              |
| vitest web                | 50    | 392 PASS | ✓                    |
| vitest api                | 78    | 914 PASS | ✓                    |
| Bundle `.next/standalone` | —     | 54 MB    | no delta vs baseline |

Regression vs Phase A baseline: ни один счётчик не уменьшился. Новых TypeScript-ошибок нет.

---

## Phase F — Cross-AI review

### Codex (codex:codex-rescue)

| Severity | Finding                                  | Action                                          |
| -------- | ---------------------------------------- | ----------------------------------------------- |
| RED      | `revalidate-org` POST — no auth          | FIXED → `getServerSession()` в `9b6464c`        |
| RED      | Cyrillic `«Не сдал»` in settings-tab.tsx | FIXED → `'No submission'` в `9b6464c`           |
| YELLOW   | Destructive guard postgres host gap      | DOCUMENTED → H-1 `[hardening: pre-prod-deploy]` |
| YELLOW   | A24 migration hardcoded UUID             | DOCUMENTED → H-3 `[hardening: pre-prod-deploy]` |
| GREEN    | Всё остальное (tRPC guards, Zod, N+1)    | —                                               |

### Sonnet static-check

1. Cyrillic grep на `.tsx` → **найдено** `«Не сдал»` → исправлено
2. `@UseGuards/@Roles` на новых controllers → нет новых → PASS
3. TODO discipline (Phase-54/55) → артефакты корректны → PASS
4. findMany/findFirst в циклах → нет новых → PASS
5. Новые env-vars без `.env.example` → нет → PASS

### advisor()

Вердикт: **GREEN**. H-1/H-2/H-3 не блокируют UAT merge. Push разрешён после документирования H-строк.

---

## Phase G — Push + final state

```
git push origin fix/PRJ-11/uat-v7-2026-05-12
```

Коммитов ahead of main: **39**

### Hardening items (pre-prod-deploy)

| ID  | Описание                              | Действие до прода                                                   |
| --- | ------------------------------------- | ------------------------------------------------------------------- |
| H-1 | Destructive guard `postgres` host gap | Split `isTrulyLocal` / require non-prod suffix when `host=postgres` |
| H-2 | `revalidate-org` CSRF gap             | Add `Origin` allow-list или Next.js Server Action                   |
| H-3 | A24 migration hardcoded UUID          | Replace `DELETE WHERE id='a000...'` with CTID/ROW_NUMBER dedup      |

### Integration test blocker (I-1)

```bash
# Запустить утром:
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="yes" \
E2E_DATABASE_URL="postgresql://customreport:localdev@localhost:5432/customreport_e2e" \
node_modules/.bin/playwright test \
  --config=/home/user/work/customreport/apps/web/playwright.integration.config.ts \
  --reporter=line
```

### Next steps (утро)

```
[HUMAN]  Merge PR #3 → main
[HUMAN]  Run integration tests (команда выше)
[HUMAN]  Decide H-1 — DB rename vs isTrulyLocal split
[HUMAN]  Fix H-3 before prod DB migration
[AGENT]  Director role UAT (A35) — следующий UAT-цикл
[AGENT]  Phase 54 AI — после решения по провайдеру
[AGENT]  Phase 55 Telegram — после решения по боту
```

---

_Night-throw 2026-05-13 завершён. 39 коммитов, 37 A-багов закрыты, 2 locked-deferred, 3 hardening, 1 integration-blocker._
