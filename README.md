<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/hero-dark.svg">
  <img src="assets/readme/hero.svg" alt="WeeklyReport: еженедельный статус-отчет отдела Development. Лиды заполняют секции, глава сводит их в один документ недели" width="100%">
</picture>

# WeeklyReport

Веб-приложение для еженедельного статус-отчета отдела. Лиды заполняют свои
секции независимо друг от друга, глава отдела сводит их в один отчет недели,
публикует его и выгружает в PDF.

> Разрушительные операции с БД не считаются безопасными по умолчанию. Точный
> список одноразовых целей и обязательный guard описаны в
> [`AGENTS.md`](./AGENTS.md), раздел "Database safety".

## Что умеет

- **Лид** (`lead`) заполняет свою секцию: статусы, задачи, риски, решения. Черновик сохраняется сам.
- **Глава отдела** (`head`) проверяет секции, оставляет комментарии и вердикты, публикует период, показывает слайды, выгружает PDF.
- **Наблюдатель** (`viewer`) читает текущий или опубликованный отчет, ищет по опубликованным периодам, содержание не меняет.
- **Администратор** (`admin`) ведет пользователей, группы, продукты, периоды, напоминания и AI-провайдера.
- **Система**: SAML-вход, перенос незавершенной работы, напоминания, неизменяемые снимки опубликованных отчетов, помощник для лида.

Все роли и возможности подробно: [`docs/onboarding.md`](./docs/onboarding.md#что-умеет-mvp).

## Быстрый старт

Нужны Node.js 26 (`.nvmrc`), pnpm из поля `packageManager` и OrbStack с Kubernetes и `kubectl`.

```bash
pnpm install
cp .env.example .env
pnpm deps:up
PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='давай' \
  pnpm db:bootstrap:local demo
pnpm dev
```

Веб откроется на http://localhost:3000, API на http://localhost:3002. Шаги по
отдельности, вход без SSO и все команды: [`docs/quick-start.md`](./docs/quick-start.md).

## Как устроено

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/readme/lifecycle-dark.svg">
  <img src="assets/readme/lifecycle.svg" alt="Жизненный цикл отчета. Лид заполняет секцию (draft, затем submitted). Глава проверяет и сводит секции (approved или changes), публикует период и экспортирует его в PDF (published, затем pdf)" width="100%">
</picture>

```text
браузер -> apps/web (Next.js) -> /trpc -> apps/api (NestJS, tRPC) -> Prisma -> PostgreSQL
                                                 |
                                                 +-> Gotenberg (PDF), почта, Redis
```

Монорепозиторий на pnpm workspaces и Turborepo. Общие схемы и типы для web и
api лежат в `packages/shared`. Требования к поведению описаны в `openspec/specs/`.

## Документация

- [`docs/quick-start.md`](./docs/quick-start.md): запуск по шагам и команды
- [`docs/onboarding.md`](./docs/onboarding.md): гайд для новых разработчиков
- [`CONTEXT.md`](./CONTEXT.md): словарь терминов проекта
- [`docs/environment.md`](./docs/environment.md): переменные окружения для всех сред
- [`docs/operations.md`](./docs/operations.md): деплой, бэкапы, восстановление, откат
- [`docs/kubernetes.md`](./docs/kubernetes.md): установка через Helm-чарт
- [`docs/artifacts.md`](./docs/artifacts.md): что хранится в Git и образах
- [`docs/adr/`](./docs/adr/): принятые архитектурные решения
- [`docs/coming-soon.md`](./docs/coming-soon.md): реестр отложенных идей
- [`AGENTS.md`](./AGENTS.md): правила для агентов и БД
- [`CONTRIBUTING.md`](./CONTRIBUTING.md): правила контрибьюции

## Статус

MVP. Репозиторий доказывает реализацию и сборку, но не заменяет проверку
конкретного production-развертывания.
