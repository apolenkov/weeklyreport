<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/hero-dark.svg">
  <img src="assets/readme/hero.svg" alt="WeeklyReport: еженедельный статус-отчет отдела. Лиды заполняют секции, глава сводит их в один документ недели" width="100%">
</picture>

# WeeklyReport

[![CI](https://github.com/apolenkov/weeklyreport/actions/workflows/ci.yml/badge.svg)](https://github.com/apolenkov/weeklyreport/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
![Node.js 26](https://img.shields.io/badge/node-26-339933)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)

Веб-приложение для еженедельного статус-отчета отдела. Лиды заполняют свои
секции, глава отдела проверяет их, публикует отчет недели и выгружает его в PDF.

**Стек:** TypeScript, Next.js 16 и React 19, NestJS, tRPC, Prisma, PostgreSQL,
Redis и BullMQ, Gotenberg для PDF. Монорепозиторий на pnpm и Turborepo.

> Разрушительные операции с БД не считаются безопасными по умолчанию. Точный
> список одноразовых целей и обязательный guard описаны в
> [`AGENTS.md`](./AGENTS.md), раздел "Database safety".

## Быстрый старт

Нужны Node.js 26 (`.nvmrc`), pnpm из поля `packageManager` и OrbStack с
Kubernetes. Текущий контекст `kubectl` должен быть `orbstack`.

```bash
kubectl config use-context orbstack
pnpm install
cp .env.example .env
pnpm deps:up
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай' \
  pnpm db:bootstrap:local demo
pnpm dev
```

Веб откроется на http://localhost:3000. Шаги, вход без SSO и все команды:
[`docs/quick-start.md`](./docs/quick-start.md).

## Как устроено

```text
браузер -> apps/web (Next.js) -> /trpc -> apps/api (NestJS, tRPC) -> Prisma -> PostgreSQL
                                          apps/api -> Redis, BullMQ, Gotenberg (PDF), почта
```

## Документация

- [`docs/onboarding.md`](./docs/onboarding.md): роли, архитектура, окружение, гейты
- [`CONTEXT.md`](./CONTEXT.md): словарь терминов проекта
- [`docs/README.md`](./docs/README.md): все документы

## Лицензия

MIT, см. [`LICENSE`](./LICENSE).
