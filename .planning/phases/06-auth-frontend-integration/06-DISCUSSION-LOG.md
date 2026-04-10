# Phase 6: Auth & Frontend Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 06-auth-frontend-integration
**Areas discussed:** SAML auth flow, tRPC client setup, localStorage migration, Failing tests fix

---

## SAML Auth Flow

| Option | Description | Selected |
|--------|-------------|----------|
| 1 час | Текущий default в auth.controller.ts. Для внутреннего инструмента оптимально | ✓ |
| 8 часов | Полный рабочий день без перелогина. Менее безопасно | |
| Как в reference-app | Взять точные настройки из reference-реализации | |

**User's choice:** 1 час (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Страница /auth/error | Отдельная страница с человекочитаемым сообщением и кнопкой "Попробовать снова" | ✓ |
| Redirect на login | Молча перенаправить на повторный логин | |
| На усмотрение Claude | Ты решишь как лучше на основе reference-app паттерна | |

**User's choice:** Страница /auth/error (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Без refresh | Простой JWT с фиксированным TTL. При истечении — редирект на Keycloak | ✓ |
| Refresh token | Сервер выдаёт refresh token, клиент обновляет JWT через /auth/refresh | |
| Как в reference-app | Взять паттерн из reference-реализации | |

**User's choice:** Без refresh (Recommended)
**Notes:** —

---

## tRPC Client Setup

| Option | Description | Selected |
|--------|-------------|----------|
| @trpc/react-query | Стандартный tRPC React-клиент с TanStack Query. hooks pattern | ✓ |
| Server Components + fetch | Next.js Server Components вызывают tRPC напрямую через HTTP | |
| На усмотрение Claude | Выбрать оптимальный подход на основе существующего кода | |

**User's choice:** @trpc/react-query (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| apps/web/src/lib/trpc.ts | Клиент в lib/, Provider в layout.tsx — стандартная структура tRPC + Next.js | ✓ |
| packages/shared + apps/web | Клиент в shared-пакете (рядом с router.ts), Provider в web | |
| На усмотрение Claude | Определить по существующей структуре монорепо | |

**User's choice:** apps/web/src/lib/trpc.ts (Recommended)
**Notes:** —

---

## localStorage Migration

| Option | Description | Selected |
|--------|-------------|----------|
| Big-bang замена | Заменить все localStorage вызовы на tRPC hooks за одну фазу. Удалить demo-data | ✓ |
| Feature flag fallback | tRPC по умолчанию, localStorage как fallback. Постепенный переход | |
| На усмотрение Claude | Выбрать стратегию на основе объёма затронутого кода | |

**User's choice:** Big-bang замена (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Удалить | Dev bypass теперь на бэкенде (trpc.context.ts AUTH_DEV_MODE) | ✓ |
| Оставить как fallback | Сохранить для случаев когда API недоступен | |

**User's choice:** Удалить (Recommended)
**Notes:** —

---

## Failing Tests Fix

| Option | Description | Selected |
|--------|-------------|----------|
| MSW (Mock Service Worker) | Перехват HTTP на сетевом уровне — компоненты думают что работают с реальным API | ✓ |
| Мок tRPC Provider | Оборачивать компоненты в мок-провайдер с заготовленными ответами | |
| На усмотрение Claude | Выбрать на основе существующих тестовых паттернов в проекте | |

**User's choice:** MSW (Recommended)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Реальный API + DB | E2E тесты ходят в реальный NestJS с PostgreSQL. Максимальная достоверность | ✓ |
| MSW моки | E2E мокают API через MSW. Быстрее, но не проверяют реальную интеграцию | |
| На усмотрение Claude | Решить исходя из сложности настройки | |

**User's choice:** Реальный API + DB (Recommended)
**Notes:** —

## Claude's Discretion

- tRPC client configuration details (batch size, retry policy, stale time)
- Component refactoring approach during localStorage→tRPC migration
- MSW handler structure and test data fixtures
- Error boundary/loading state patterns for tRPC queries

## Deferred Ideas

None — discussion stayed within phase scope
