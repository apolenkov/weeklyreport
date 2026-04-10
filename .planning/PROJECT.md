# CustomReport

## What This Is

Веб-приложение для автоматизации сбора еженедельных статус-отчётов от тимлидов департамента Development. Каждый из 6 лидов заполняет свою секцию через структурированную форму (светофоры проектов, текущая/следующая неделя, риски, решения для руководства). Система собирает всё в единый красивый отчёт с экспортом в PDF. Руководитель (head) ревьюит и публикует финальный отчёт для директора и других подразделений.

## Core Value

Лиды заполняют свои секции независимо через удобную форму, система автоматически собирает единый отчёт — без конфликтов редактирования, с историей и аналитикой.

## Current Milestone: v2.0 Infrastructure Integration

**Goal:** Превратить domain-logic прототип в работающее приложение с реальной БД, API, авторизацией и контейнеризацией.

**Target features:**
- Docker Compose (PostgreSQL + Redis + API + Web), Dockerfiles для всех сервисов
- Prisma миграции + seed data
- NestJS HTTP bootstrap с tRPC endpoints
- Prisma repository implementations для всех 8 сервисов
- Frontend: заменить localStorage на tRPC-вызовы к API
- SAML авторизация через Keycloak + JWT sessions + role guards
- BullMQ интеграция для PDF export и email jobs
- Observability: health checks, metrics endpoints, structured error handling
- Quality gates: fix falling tests, lint/typecheck clean across monorepo

## Requirements

### Validated

Shipped in v1.0 (domain logic layer):
- ✓ Domain services with repository interfaces — v1.0 Phase 1-3
- ✓ Zod schemas (shared types) — v1.0 Phase 1
- ✓ Frontend UI components (localStorage prototype) — v1.0 Phase 1-3
- ✓ Prisma schema (data model definition) — v1.0 Phase 1
- ✓ Centralized structured JSON logging — v1.0 Phase 4
- ✓ 51 backend unit tests passing — v1.0 Phase 1-4

### Active

- [ ] Лид может заполнить секцию отчёта за свои проекты (структурированные айтемы: проект, текст, тег, статус)
- [ ] Лид может проставить светофор (green/yellow/red) для каждого своего проекта
- [ ] Лид может добавить риски (проект, риск, влияние, митигация)
- [ ] Лид может добавить решения для руководства (Management Attention: текст, owner, deadline, impact)
- [ ] Незакрытые решения автоматически переносятся в следующий отчёт
- [ ] Айтемы "следующая неделя" автоматически переносятся в "текущая неделя" нового отчёта
- [ ] Лид может отметить перенесённые айтемы как выполненные или невыполненные
- [ ] Лид может указать Top 3 priorities
- [ ] Portfolio Status Overview собирается автоматически из светофоров лидов
- [ ] Head может просматривать кто из лидов сдал секцию, кто нет
- [ ] Head может ревьюить собранный отчёт и публиковать его
- [ ] Система отправляет email-напоминания лидам о заполнении (по расписанию)
- [ ] Опубликованный отчёт доступен в веб-формате
- [ ] Опубликованный отчёт можно экспортировать в PDF (визуально как текущий формат)
- [ ] История всех прошлых отчётов с возможностью просмотра
- [ ] SSO SAML авторизация через Keycloak
- [ ] Админ-панель: управление пользователями и ролями (lead/head/viewer)
- [ ] Админ-панель: управление проектами (создание, архивация, привязка к лиду)
- [ ] Админ-панель: создание отчётных периодов с дедлайнами
- [ ] Админ-панель: настройка расписания email-напоминаний

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
*Last updated: 2026-04-10 after milestone v2.0 start*
