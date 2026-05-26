# Deferred: Live UAT + Code-Quality + Vercel

## Problem

Следующий шаг после инвентаризации — полный live-прогон приложения и
code-quality чистка. Это большая работа, которую откладываем до явного «вперёд».

## What's inside

**Wave 1 — Fresh dev server + UAT-свип 4 ролей:**

Запустить свежий dev-сервер (`pnpm dev:fresh`), войти под каждой ролью
через `/auth/dev-login?role=ROLE`, прокликать все экраны через Playwright MCP.
Записать все найденные баги в отдельные openspec changes.

**Wave 2 — Фиксы найденных багов:**

Каждый найденный баг — отдельный openspec change + исправление.

**Wave 3 — Code-quality агенты:**

- `code-simplifier` — убрать лишний код
- `code-modernization` — привести к актуальным паттернам
- `code review` — пройтись по затронутому коду
- ESLint/Prettier до текущих стандартов
- Подтянуть зависимости

**Wave 4 — Vercel best-practices аудит:**

Запустить Vercel best-practice skill: производительность, Core Web Vitals,
Next.js 16 конвенции.

**Wave 5 — Финальные гейты + re-sweep:**

`pnpm typecheck && pnpm lint && pnpm test && pnpm lint:md` — все зелёные.
Повторный Playwright-свип: 0 console-ошибок по всем ролям.

## Start condition

Начать по явному «вперёд» от пользователя.
