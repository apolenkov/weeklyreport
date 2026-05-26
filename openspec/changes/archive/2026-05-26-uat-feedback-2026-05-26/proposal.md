# UAT Feedback Capture — Wave 1-light

## Problem

У команды осталось ~6% рабочей недели. Полный 5-волновой UAT-план
(`defer-uat-codequality-vercel-2026-05-26`) не умещается в этот бюджет.
Нужно зафиксировать реальное поведение UI по 4 ролям, не делая фиксов в
этой сессии.

## What's inside

**Wave 1-light — ручной клик 4 ролей + feedback-log:**

Войти под каждой ролью через `/auth/dev-login?role=ROLE`, прокликать
основные экраны через Playwright MCP. Каждая находка — одна строка в
`feedback-log.md`. Фиксы в этой сессии не делаем.

Роли и лендинги:

- `lead` → `/lead/report`
- `head` → `/head/dashboard`
- `admin` → `/admin`
- `viewer` → `/reports?tab=published`

## Scope boundary

- Фиксы кода — НЕ в этой сессии (→ Wave 2 в `defer-uat-codequality-vercel-2026-05-26`)
- Code-quality (Wave 3), Vercel (Wave 4), re-sweep (Wave 5) — следующая сессия
- Deferred-specs (21 шт. в `openspec/deferred/`) — игнорировать, кроме явных
  регрессий в видимом UI

## Start condition

Контейнеры уже running (`web :3000`, `api :3002`, `postgres`). Пользователь
одобрил план. Начать немедленно.

## Done when

`feedback-log.md` содержит хотя бы одну проверенную строку на каждую роль
(4 строки минимум), даже если находок нет (статус = OK). Триаж передаётся
в следующую сессию через `defer-uat-codequality-vercel-2026-05-26`.
