# Agentation upstream analysis

Дата проверки: 2026-09-04. Проверены фактически установленные пакеты:

- `agentation@3.0.2` (web dependency; lockfile entry `agentation@3.0.2`)
- `agentation-mcp@1.2.0` (root dev dependency; lockfile entry `agentation-mcp@1.2.0`)

Основные первичные источники: [Agentation API](https://www.agentation.com/api),
[MCP documentation](https://www.agentation.com/mcp), [changelog](https://www.agentation.com/changelog).
Локальные line references ниже относятся к установленным `node_modules/.pnpm/.../dist` и
`README.md`, а не к исходникам репозитория upstream.

## Что можно и нужно оставить штатным

1. **Клиент и browser sync.** `agentation@3.0.2` экспортирует `Agentation` (alias
   `PageFeedbackToolbarCSS`), `Annotation`, callbacks и `endpoint`/`sessionId` —
   `node_modules/.pnpm/agentation@3.0.2_*/node_modules/agentation/dist/index.d.ts:89-120,317`.
   Наш `ProductFeedbackWidget` уже использует именно публичный `Agentation` и
   публичные props, `apps/web/src/features/product-feedback/ui/product-feedback-widget.tsx:3-29`.
   Это надо сохранить; не копировать toolbar или его localStorage/sync реализацию.

2. **Wire model.** `agentation-mcp@1.2.0` публично экспортирует типы
   `Annotation`, `Session`, `SessionWithAnnotations`, `ThreadMessage`, `AFSEvent` и
   `AFSEventType`, а также состояния и роли — `.../agentation-mcp/dist/index.d.ts:14-116,308`.
   Официальная документация перечисляет те же TypeScript types и импорт из
   `agentation-mcp` ([MCP, TypeScript Types](https://www.agentation.com/mcp#typescript-types)).
   Использовать эти типы в first-party коде можно только если это не создаёт runtime
   dependency в server bundle; текущие shared Zod schemas всё равно нужны для
   проверки входящих данных и WeeklyReport extensions.

3. **MCP behavior.** Публичный `startMcpServer(baseUrl?)` и CLI поддерживают подключение
   агента к HTTP endpoint: `.../agentation-mcp/dist/index.d.ts:1-12`; CLI умеет
   `--mcp-only` и `--http-url`, README: `.../agentation-mcp/README.md:52-58`.
   Поэтому наш `agentation:mcp` launcher — разумный штатный reuse point. Девять
   штатных tools (sessions, pending, acknowledge, resolve, dismiss, reply,
   watch) перечислены в README: `.../README.md:60-74` и на официальной странице
   [MCP tools](https://www.agentation.com/mcp#mcp-tools). Не нужно дублировать MCP
   tool handlers в WeeklyReport.

4. **Event/reconnect contract.** Официальный API документирует session/global SSE,
   event types и `Last-Event-ID` replay: [API, Real-Time Events](https://www.agentation.com/api#real-time-events).
   Установленный runtime действительно имеет `AFSEvent`, sequence и
   `getEventsSince` в public declarations: `.../agentation-mcp/dist/index.d.ts:72-84,117-133`.
   Это подтверждает совместимость нашего wire/SSE contract как contract target,
   но не предоставляет PG-backed implementation.

## Что upstream не предоставляет для текущих требований

1. **Нет public store injection или async/Prisma store.** Public `AFSStore` и
   `TenantStore` — синхронные interfaces; `getStore()`/`getTenantStore()` — singleton
   accessors: `.../agentation-mcp/dist/index.d.ts:117-170,242-306`. `startHttpServer`
   принимает только `(port, apiKey?)`, без router, store, auth/middleware или DB
   factory: `.../dist/index.d.ts:1-6`. README говорит, что storage — SQLite по
   умолчанию или in-memory через `AGENTATION_STORE`: `.../README.md:133-160`;
   официально [API, Storage](https://www.agentation.com/api#storage) не описывает
   PostgreSQL adapter.

   Следствие: нельзя без изменения WeeklyReport storage/transaction semantics
   безопасно заменить `agentation.repository.ts` и `agentation-sse.ts` на
   upstream runtime. Импорт внутренних `src/server/*` или использование
   bundle-only implementation не является поддерживаемым extension point.

2. **Tenant exports не равны WeeklyReport auth.** Пакет экспортирует
   `Organization`, `User`, `ApiKey`, `UserContext`, API-key hashing и tenant CRUD
   (`.../dist/index.d.ts:86-116,242-306`), но это SQLite tenant store; нет hook для
   server SSO/session `userId`, reporting group, role policy или Express/Nest
   middleware. `startHttpServer` в bundled runtime маршрутизирует самостоятельно
   (`.../dist/index.mjs:2281-2323`), а create/get handlers используют global store
   (`.../dist/index.mjs:1860-1878`). Сохранение WeeklyReport server-derived
   identity и role checks поэтому обязательное собственное отступление.

3. **API key означает не WeeklyReport authorization.** В bundled HTTP runtime
   `apiKey` устанавливает cloud proxy mode (`.../dist/index.mjs:1693-1700,2281-2284`);
   local route path не становится middleware с WeeklyReport session authorization.
   Нельзя подключить его поверх текущего authenticated endpoint без второго сервера,
   proxy или ослабления access boundary. Наш API key validation для MCP — адаптер
   между штатным MCP client и WeeklyReport auth, а не fork upstream.

4. **Delete semantics различаются и требуют явного решения.** Upstream публично
   документирует `DELETE /annotations/:id` ([API, HTTP API](https://www.agentation.com/api#http-api)).
   В установленном 1.2.0 SQLite implementation это физический SQL delete и затем
   `annotation.deleted` event: `.../dist/index.mjs:409-447,639-647`; memory store делает
   то же в `.../dist/index.mjs:1614-1621`. При этом MCP `agentation_dismiss` штатно
   использует status `dismissed` (`.../dist/index.mjs:1298-1339`), а client changelog
   отдельно фиксирует resolved/dismissed sync behavior ([changelog, 2.3.0](https://www.agentation.com/changelog#2.3.0)).
   Наше требование "hard-delete без воскрешения" плюс tombstone/replay protection и
   role-gated delete не совпадает с простым upstream DELETE. Оставляем собственную
   deletion policy до отдельного решения пользователя; не подменяем её upstream
   `dismissed` автоматически.

## Reuse/no-go decision matrix

| Участок                                                                     | Решение                      | Доказательство                                                        |
| --------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------- |
| React toolbar, browser annotation capture, endpoint/session props           | **Reuse upstream**           | `agentation` public d.ts and official API props                       |
| MCP stdio tools and watch loop                                              | **Reuse upstream**           | public `startMcpServer`; official nine-tool list                      |
| Shared annotation/event names and types                                     | **Reuse as contract target** | public MCP declarations; validate with our Zod schemas                |
| HTTP route matching, PG persistence, async transactions                     | **Keep WeeklyReport**        | upstream `startHttpServer(port, apiKey?)`; sync SQLite store only     |
| SSO/session identity, role/group scope                                      | **Keep WeeklyReport**        | no upstream request middleware or session hook                        |
| SSE auth, tenant filtering, deletion replay/tombstones                      | **Keep WeeklyReport**        | upstream SSE is global/local-store runtime; requirements are stronger |
| Importing `src/server/*`, patching node_modules, replacing SQLite internals | **No-go**                    | package exports expose only root entry; no supported injection API    |

## Update protocol and risks

Do not promise compatibility with unknown future versions. On each dependency update,
pin and record exact versions, inspect root `exports` and public `.d.ts`, diff official
API/MCP HTTP/SSE/type documentation and changelog, then run the Agentation wire contract
suite against the installed client/MCP. Required checks cover create/read/update/thread,
statuses, delete, SSE initial sync/replay/reconnect and MCP tools; any change to event
names, status transitions, delete response, sequence/replay, or exported signatures is
an incompatibility review, not an automatic upgrade. Keep PostgreSQL/session auth and
hard-delete behavior unchanged unless the user explicitly approves a product/storage
change.

## Bottom line

The smallest safe architecture is: **upstream React client + upstream MCP stdio/tool
implementation, WeeklyReport-owned authenticated HTTP/PG adapter only where upstream
has no public injection point**. There is no evidence in 3.0.2/1.2.0 that a supported
PG store, auth middleware, or router injection exists; removing those local parts now
would mean changing storage or access behavior, so it should stop for user approval.
