---
name: Docker dev containers can run stale code despite --watch
description: CustomReport runs api/web in Docker with node --watch + bind-mounted source; long-running containers (>24h) silently stop reloading and need explicit `docker compose restart`
type: feedback
originSessionId: bba7038f-3313-48a3-895f-09a1520a7c56
---

В CustomReport `api` и `web` контейнеры запущены через `docker compose up` с `node --watch src/main.ts` и source bind-mounted из хоста. После 24+ часов uptime watcher молча перестаёт перезагружать изменения — процесс остаётся на коде с момента старта. Симптомы:

- БД мигрирована корректно, schema.prisma актуален, zod-схемы свежие, новые поля есть везде
- live tRPC-ответ возвращает старую форму объекта (без новых полей)
- save принимает новый payload, но read его не отдаёт — пользователь видит «не сохранилось»
- сборка локально (`pnpm test` + `tsc`) полностью зелёная, тесты проходят
- запутывает то, что `docker exec ... grep` находит новый код в смонтированных файлах, но running node-процесс работает со скомпилированной в памяти старой версией

**Why:** инцидент 2026-05-10 — UFB-042 «лидер не сохраняется» оказался не багом save-цепочки (она end-to-end чистая), а тем что `customreport-api-1` Up 46h не подхватил UFB-039 + 44-01/02 коммиты. Snapshot-ответ возвращал группу без `headUserId`, хотя БД, schema.prisma, zod, repo — все имели поле. Потратил ~30 минут трассировки frontend→tRPC→service→repo→DB прежде чем дошёл до `docker logs` и увидел что save-мутация даже не доходит до контейнера.

**Update 2026-05-10 (Phase 47-01):** добавлен `pnpm dev:watch` =
`docker compose -f docker-compose.yml -f docker-compose.dev.yml up --watch`
с `develop.watch` блоками на api+web (рестарт по изменениям
`apps/{api,web}/src`, `packages/shared/src`, `prisma/schema.prisma`).
**Эвристика «container Up >12h»** теперь актуальна ТОЛЬКО для контейнеров,
запущенных без `--watch`: production, CI, `docker compose up -d` без флага.
Для разработки через `pnpm dev:watch` стейл-класс закрыт на уровне compose —
рестарт происходит за ~3 секунды на любое сохранение. Если разработчик
запустил dev-loop через `pnpm dev` (host-mode) или `docker compose ... up -d`
(без `--watch`) — старая эвристика по-прежнему действует.

**How to apply:**

1. Если пользователь жалуется «изменения не применяются», «сохранил — не отображается», «UI показывает старое поведение» — **первым делом** проверить: `docker ps --format 'table {{.Names}}\t{{.Status}}'`. Любой `Up >12h` для `customreport-api-1` или `customreport-web-1` — кандидат на стейл (только если контейнеры запущены БЕЗ `--watch`; при `pnpm dev:watch` этот класс ошибок невозможен).
2. Подтверждение стейла: `docker logs customreport-api-1 --tail 100 | grep -v health | grep -v metrics` — если за время эпизода нет ни одного запроса от UI (только Prometheus health/metrics), значит запросы либо не доходят, либо контейнер их не логирует. Доп. проверка: `curl http://localhost:3002/trpc/<endpoint>` напрямую.
3. Фикс: `docker compose restart api web` (~10 секунд даунтайма, безопасно — нет persistent in-memory state).
4. Только ПОСЛЕ рестарта повторять UAT-сценарий пользователя.
5. Не запускать длинные backend-фазы (миграции, новые tRPC-endpoint-ы) без mental-note «надо будет рестартануть контейнеры перед UAT» — иначе пользователь сразу попадёт на стейл.
6. Перед началом любой ручной верификации (UAT, screenshot-проверка, «открой админку») — превентивно прогнать `docker compose restart api web` если контейнеры старше суток. Дёшево, исключает целый класс ложных багов.
7. **Prisma-specific:** контейнер имеет ОТДЕЛЬНЫЙ `node_modules` от хоста (не bind-mounted). После любой миграции `prisma migrate dev` на хосте generated client обновляется ТОЛЬКО на хосте — в контейнере остаётся старый. Симптом: runtime ошибка `TypeError: Cannot read properties of undefined (reading 'findMany')` на новой модели (`this.prisma.<newModel>` undefined). Фикс: `docker exec customreport-api-1 sh -c "cd /app && pnpm exec prisma generate"` + `docker compose restart api`. После каждой Prisma-миграции это часть UAT-подготовки наравне с рестартом.
