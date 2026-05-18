---
name: PRJ-2 UAT v7 — консолидация 2026-05-17
description: Ветка fix/PRJ-2/uat-v7-2026-05-12 консолидирована (13 коммитов), PR #5 готов к merge после SSL восстановления
type: project
originSessionId: 32223757-8778-4d1b-8910-37480c159bf7
---

PRJ-2 v7 консолидация завершена (2026-05-17). Ветка `fix/PRJ-2/uat-v7-2026-05-12`,
13 коммитов выше `6eb0184`. PR #5 открыт. `git push` заблокирован SSL (`forge.example.org`).

Все проверки зелёные: typecheck 0, lint 0, vitest 42/42 PASS.

Незакрытые задачи после merge:

- `stageName` депрекация в `lead-form.tsx:1187`
- UI-аудит `ethereal-growing-brooks.md`: F1 (toolbar labels), F2 (SDLC), Q4a/Q4b
- V1–V5 UNFILED: `.planning/todos/pending/2026-05-16-fit2-v7-uat-verify-items.md`

--- история до консолидации ---

UAT v7.4 закрыт на ветке `fix/PRJ-2/uat-v7-2026-05-12`. PR #3 → PR #5.

**Why:** Ночной бросок (2026-05-11→13) закрыл 37/39 A-багов плана UAT v7.4. Два locked-deferred: Phase 54 (AI/RAG) и Phase 55 (Telegram).

**How to apply:** При мёрдже PR #3 — переключиться на `main` и начинать следующий цикл. Перед prod-деплоем обязательно закрыть H-1/H-2/H-3.

## Ключевые артефакты

- Branch: `fix/PRJ-2/uat-v7-2026-05-12`
- PR: https://forge.example.org/apolenkov/customreport/pull/3
- Integration tests: 45/45 PASS (playwright.integration.config.ts)
- Open bugs: `.planning/regression/UAT-V7-OPEN-ABUGS.md`

## .jira конфиг (PRJ-проект)

Конвенция лейблов: `prj:<codename>` где codename = маркетинговое имя продукта.

- customreport → `prj:pulse` (не `prj:customreport`!)
- aiLabel: `prj:ai-integration`
- Tempo НЕ используется в PRJ-проекте → `noTimeLog: true` для всех типов
- Worklog/Account/ФНС/Service Object — не выставляемы через REST API (Tempo плагин, только CP-проект)

## GitHub branch rename

`POST /repos/{owner}/{repo}/branches/{branch}/rename` автоматически обновляет голову всех открытых PR. Единственный способ переименовать ветку с открытым PR без пересоздания.

## Hardening (блокируют prod-деплой)

- H-1: `prisma/_destructive-guard.ts` — postgres host gap (разделить isTrulyLocal + isDockerInternal)
- H-2: `apps/web/src/app/api/revalidate-org/route.ts` — CSRF Origin check отсутствует
- H-3: `prisma/migrations/20260512110000_c2_report_open_unique/migration.sql` — hardcoded UUID в DELETE
