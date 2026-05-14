---
name: UAT v7.4 night-throw + .jira rework (2026-05-13)
description: Завершение UAT v7.4 — 49 коммитов, 45/45 интеграционных тестов, PR #3 готов к мерджу; рефакторинг .jira конфига под PRJ-проект
type: project
originSessionId: 32223757-8778-4d1b-8910-37480c159bf7
---

UAT v7.4 закрыт на ветке `fix/PRJ-2/uat-v7-2026-05-12` (49 коммитов ahead of main). PR #3 открыт и готов к мерджу.

**Why:** Ночной бросок (2026-05-11→13) закрыл 37/39 A-багов плана UAT v7.4. Два locked-deferred: Phase 54 (AI/RAG) и Phase 55 (Telegram).

**How to apply:** При мёрдже PR #3 — переключиться на `main` и начинать следующий цикл. Перед prod-деплоем обязательно закрыть H-1/H-2/H-3.

## Ключевые артефакты

- Branch: `fix/PRJ-2/uat-v7-2026-05-12`
- PR: https://ghe.example.org/apolenkov/customreport/pull/3
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
