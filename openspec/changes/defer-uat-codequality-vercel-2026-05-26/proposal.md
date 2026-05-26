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

Скиллы-эксперты Wave 3 (параллельный запуск):

- `/typescript-expert` — TypeScript строгость, типы, дженерики
- `/typescript-pro` — TypeScript advanced patterns
- `/nestjs-expert` — NestJS модули, DI, guards, interceptors
- `/react-best-practices` — React паттерны, хуки, производительность
- `/postgres-pro` — запросы, индексы, схема
- `/postgresql-optimization` — медленные запросы, планы выполнения
- `/observability-engineer` — логирование, метрики, трейсинг
- `/docker-expert` — Dockerfile, compose, слои образов

**Wave 4 — Vercel best-practices + UI/UX аудит:**

Запустить Vercel best-practice skill: производительность, Core Web Vitals,
Next.js 16 конвенции.

Скиллы-эксперты Wave 4 (параллельный запуск):

- `/ui-ux-pro-max` — UI/UX аудит, доступность, иерархия
- `/slides` — слайд-дека (StatusSlideDeck, SummarySlide, DecisionSlide)
- `/react-view-transitions` — анимации, View Transitions API
- `/frontend-design` — визуальный дизайн, токены, типографика

**Wave 5 — Финальные гейты + re-sweep:**

`pnpm typecheck && pnpm lint && pnpm test && pnpm lint:md` — все зелёные.
Повторный Playwright-свип: 0 console-ошибок по всем ролям.

## Wave 1 split

Wave 1-light выделена в отдельный change `uat-feedback-2026-05-26`
(feedback only, без фиксов, 2026-05-26). Wave 2–5 ждут следующей сессии.

## Start condition

Начать по явному «вперёд» от пользователя.
