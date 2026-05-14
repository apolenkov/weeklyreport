---
name: Night Marathon 2026-05-14
description: Ночной марафон UAT v7 — 36 feedback-точек, hardening H-1/H-2/H-3, Playwright spec, PR #4
type: project
---

# Night Marathon 2026-05-14 — UAT v7 wrap-up

**Ветка:** `fix/PRJ-2/uat-v7-2026-05-12`  
**PR:** #4 (открыт)  
**Коммиты за ночь:** +7 поверх 43 pre-existing

## Что было сделано

### Hardening (H-1/H-2/H-3) — committed

- H-1 `_destructive-guard.ts`: `postgres` hostname удалён из `isTrulyLocal`; только `_uat/_dev/_test` DB суффикс + consent флаг
- H-2 `/api/revalidate-org`: CSRF Origin проверка — non-origin requests → 403
- H-3 migration: generic ROW_NUMBER dedup перед `CREATE UNIQUE INDEX IF NOT EXISTS Report_one_open_per_boundary`

### Docker DB rename — committed

- `POSTGRES_DB: customreport` → `customreport_uat` в docker-compose.yml и .env
- Разблокирует `wipe-manual-uat` через H-1 guard

### Wave-D — 14 T1 quick fixes — committed (e537866)

D-7 reminders Coming Soon, D-9 CI integrations label, D-13 StageMultiSelect openSeq,
D-14 decision dialog labels, D-15 "All stages" pill, D-23/24 reports search skeleton,
D-25 history sidebar Coming Soon, D-27/36 agentation overlay top-right,
D-30 draft activity row non-clickable, D-35 Recharts SVG aria-hidden/focusable=false

### Wave-E partial — committed (9fc8a50)

- D-20: VersionHistoryNav arrows fire `onVersionChange` callback
- D-21: submit priorities friendly toast (Zod JSON parsed)
- D-32: DEV_SESSION.reportingGroupId → activity panel scoped to head's group

### Wave-F — 6 research memos — committed (9fc8a50)

D-6/D-8/D-16/D-17/D-29/D-34 в `.planning/memory/2026-05-14-D*.md`

### Wave-C — Playwright regression spec — committed (0371223)

`e2e/regression-uat-v7.spec.ts` — 12 specs (D-7/9/11/13/18/20/21/25/27/30/32/35)

### D-11/D-18 — committed (0371223)

- D-11: subtle green gradient на lead report page
- D-18: context strip hidden on mobile (`hidden sm:flex`)

### PR #4 — открыт

- Таблица D-\* статусов в описании
- 50 коммитов ahead of main

## Что осталось

### Требует Docker Desktop (user action)

1. Запустить Docker Desktop
2. `docker compose up -d postgres redis`
3. `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=yes pnpm exec prisma migrate deploy`
4. `docker compose restart api web`
5. Проверить `wipe-manual-uat` через DevRoleSwitcher → success toast

### MCP sweep (после запуска серверов)

- `take_screenshot` на /admin, /lead/report, /head/dashboard, /reports
- `list_console_messages` — проверить errors == 0 на 4 ролях

### UX/UI skills sweep (опционально, не блокирует PR)

4 параллельных агента: Demo-design, Demo-review, gsd-ui-auditor, security-reviewer
→ консолидация в `.planning/memory/2026-05-14-uxui-skills-sweep.md`

### PR #4 — approve

После ручного UAT (15-20 мин по чеклисту в описании PR) — approve в GitHub UI

## Ключевые решения

- D-22 (save version on old version): уже solved — кнопка задизаблена при `!isLatest`
- D-2 (GroupProductsEditor lock): уже реализовано в B1-волне
- D-5 (group change warning): уже реализовано через `window.confirm`
- D-28 (users tab group filter): уже реализовано через `TabFilter`
- D-33 (viewer slides reminder): Coming Soon stub — будет в Phase 60

## Why: docker DB rename

Без суффикса `_uat` — H-1 guard отклоняет wipe (`host=postgres` + `db=customreport` без суффикса).
Решение: переименовать docker DB → `customreport_uat` = явный non-prod суффикс.
