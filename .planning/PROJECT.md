# CustomReport

## What This Is

Веб-приложение для автоматизации сбора еженедельных статус-отчётов от тимлидов департамента Development. Каждый из 6 лидов заполняет свою секцию через структурированную форму (светофоры проектов, текущая/следующая неделя, риски, решения для руководства). Система собирает всё в единый красивый отчёт с экспортом в PDF. Руководитель (head) ревьюит и публикует финальный отчёт для директора и других подразделений.

## Core Value

Лиды заполняют свои секции независимо через удобную форму, система автоматически собирает единый отчёт — без конфликтов редактирования, с историей и аналитикой.

## Current State: v4.0 SHIPPED (2026-04-25)

**What was delivered:**
- 19 Prisma models, 36 tRPC endpoints (full API surface)
- 7 frontend pages with Starbucks design system (cream/teal/gold, Lexend + Source Sans 3)
- 129 Playwright E2E tests, 382 API unit tests, 35 integration tests
- Complete documentation: API reference, deployment guide, developer + user guides
- 56/56 requirements satisfied

**Tech debt (v5.0 scope):**
- Wire tRPC client (replace mock data with real API calls)
- Add auth session guards to app routes
- Align mock types with Zod schemas
- Rework E2E tests for real API integration

## Next Milestone: v5.0 (not started)

Goals TBD. Candidates:
- tRPC integration (wire frontend to real API)
- Full Keycloak SAML SSO
- Real-time features
- Analytics/trends

## Requirements

### Validated

Shipped in v1.0-v3.0:
- ✓ Domain services with repository interfaces — v1.0
- ✓ Zod schemas (shared types) — v1.0
- ✓ Prisma schema (14 models, all enums) — v2.0
- ✓ NestJS tRPC API (20+ endpoints) — v2.0
- ✓ SAML SSO via Keycloak — v2.0
- ✓ Lead: заполнение секции (items, risks, decisions, priorities) — v1.0-v2.0
- ✓ Lead: светофоры проектов — v1.0-v2.0
- ✓ Lead: submit с валидацией — v1.0-v2.0
- ✓ Head: dashboard, assembled report, publish — v1.0-v2.0
- ✓ Head: PDF export (BullMQ async) — v2.0
- ✓ Head: admin CRUD (users, projects, periods, reminders) — v1.0-v2.0
- ✓ Head: carry-over, email reminders — v1.0-v2.0
- ✓ Viewer: archive list/detail — v1.0-v2.0
- ✓ Auto-create weekly report for leads on login — v3.0+
- ✓ Dynamic priorities (1+ instead of fixed 3) — v3.0+
- ✓ Cursor pagination (archive, reminders) — v3.0+
- ✓ 422 unit tests passing — v3.0+
- ✓ API contracts documented (docs/api/) — v3.0+
- ✓ Dark theme, collapsible sections — v3.0

### Active (v4.0)

- [ ] Prisma migration for reminder schema (kind/fireAt/timezone/status/version)
- [ ] Backend edge-cases: all 81 regression scenarios pass
- [ ] UI redesign from scratch via design skills
- [ ] E2E Playwright tests: lead journey, head journey, viewer journey
- [ ] E2E: cross-role scenarios (full lifecycle)

### Out of Scope

- Интеграция с Jira/GitLab для автоматического подтягивания данных — пока ручной ввод
- Мобильное приложение — web-first
- Real-time совместное редактирование — каждый лид работает в своей секции
- Аналитика трендов (как менялись светофоры по неделям) — v2
- Telegram/Slack уведомления — только email для v1

## Context

- Департамент Development, ~6 тимлидов, руководитель департамента (Барханов) + директор и другие подразделения как читатели
- Текущий процесс: все лиды пишут в один файл OnlyOffice каждую пятницу
- Боли: конфликты редактирования в одном файле, нет истории, неудобно
- Отчёт используется всем департаментом и полезен другим подразделениям
- Формат отчёта хорошо формализован (PDF-пример: светофоры, Current/Next Week, Risks, Management Attention, Top 3 Priorities)
- Деплой на внутренний корпоративный CSP (Docker Compose, позже Kubernetes)
- SAML SSO через Keycloak уже есть в организации

## Constraints

- **Tech stack**: Next.js + NestJS + TypeScript + PostgreSQL + Redis + BullMQ + Turborepo monorepo + pnpm
- **UI**: shadcn/ui + Tailwind CSS
- **API**: tRPC (type-safe, shared types между фронтом и бэком)
- **ORM**: Prisma
- **PDF**: Puppeteer/Playwright (рендер HTML в PDF)
- **Auth**: SAML via `@node-saml/passport-saml` + Keycloak IdP
- **Email**: SMTP корпоративный сервер
- **Validation**: Zod (shared schemas в пакете `packages/shared`)
- **Deploy**: Docker Compose (production), Kubernetes — позже
- **Quality gates**: TypeScript strict, ESLint + Prettier, Husky + lint-staged, Vitest (unit), Playwright (E2E)
- **Standards**: best practices April 2026, максимальная безопасность

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| shadcn/ui вместо Ant Design | Лучше для AI-генерации кода, composable, Tailwind-native | — Pending |
| tRPC вместо REST + Swagger | Type-safe API без кодогенерации, идеально для монорепо Next.js + NestJS | — Pending |
| Структурированные айтемы (Вариант A) | Позволяет фильтрацию, группировку, аналитику в будущем | — Pending |
| BullMQ для очередей | На Redis (уже в стеке), нативная интеграция с NestJS (@nestjs/bullmq) | — Pending |
| Prisma ORM | Type-safe, отличные миграции, хорошо с PostgreSQL | — Pending |
| Docker Compose → Kubernetes | Начинаем просто, мигрируем на K8s когда появится потребность | — Pending |
| Item вместо WeekItem | Универсальная модель — период отчёта может быть не только неделя | — Pending |

## Data Model

```
Report (отчётный период)
├── period: { start, end }
├── deadline: date
├── status: draft | published
├── publishedAt: date | null
├── publishedBy: userId | null
│
├── ReportSection (секция лида)
│   ├── authorId (lead)
│   ├── status: draft | submitted
│   ├── submittedAt: date | null
│   │
│   ├── ProjectStatus[]
│   │   ├── projectId
│   │   └── status: green | yellow | red
│   │
│   ├── Item[]
│   │   ├── type: current | next
│   │   ├── projectId
│   │   ├── text: string
│   │   ├── tag: feature | bugfix | infra | ops
│   │   ├── itemStatus: done | in-progress | blocked
│   │   ├── carriedOver: boolean
│   │   └── completed: boolean | null
│   │
│   ├── Risk[]
│   │   ├── projectId
│   │   ├── risk: string
│   │   ├── impact: string
│   │   └── mitigation: string
│   │
│   ├── Decision[]
│   │   ├── text: string
│   │   ├── owner: string
│   │   ├── deadline: string
│   │   ├── impact: string
│   │   └── resolvedAt: date | null
│   │
│   └── Priority[]
│       └── text: string (Top 3)
│
├── Project
│   ├── name: string
│   ├── leadId: userId
│   └── archived: boolean
│
└── User
    ├── email: string
    ├── name: string
    ├── role: lead | head | viewer
    └── samlId: string
```

## Monorepo Structure

```
apps/
  web/          ← Next.js (фронт + SSR)
  api/          ← NestJS (REST/tRPC API)
packages/
  shared/       ← Zod-схемы, типы, утилиты, tRPC router definitions
  ui/           ← shadcn/ui компоненты, design tokens
  config/       ← ESLint, TypeScript, Prettier shared configs
```

## Roles

| Role | Capabilities |
|------|-------------|
| `lead` | Заполняет свою секцию, ставит светофоры, добавляет риски/решения, top priorities |
| `head` | Всё что lead + админка + ревью + публикация финального отчёта |
| `viewer` | Только чтение опубликованных отчётов, PDF скачивание |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-21 after milestone v4.0 start*
