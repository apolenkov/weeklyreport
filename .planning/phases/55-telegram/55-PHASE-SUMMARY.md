---
phase: 55
plan: telegram
type: seeds-only
title: Telegram integration scaffolding (mock adapter + binding stub + admin badge)
status: complete
completed: 2026-05-11
commits:
  - 2001b4c feat(schema): UFB-056 — TelegramBinding stub model + migration (55-1)
  - 4d8f803 feat(api): UFB-056 — TelegramAdapter port + MockTelegramAdapter (55-2)
  - 6549637 feat(api): UFB-056 — TelegramModule + outbound BullMQ worker stub (55-3)
  - 5f4c0c5 feat(api,shared): UFB-056 — admin.integrationsStatus + admin.testTelegramSend (55-4)
  - 92ed9a1 feat(web): UFB-056 — Settings → Integrations sub-tab with Telegram badge (55-5)
files-created:
  - prisma/migrations/20260511023400_telegram_binding_stub/migration.sql
  - apps/api/src/modules/telegram/telegram.adapter.ts
  - apps/api/src/modules/telegram/mock-telegram.adapter.ts
  - apps/api/src/modules/telegram/telegram.queue.ts
  - apps/api/src/modules/telegram/telegram.module.ts
  - apps/api/src/modules/telegram/__tests__/mock-telegram.adapter.test.ts
  - apps/api/src/modules/telegram/__tests__/telegram.module.test.ts
  - apps/api/src/modules/telegram/__tests__/telegram.queue.test.ts
  - apps/api/src/modules/telegram/__tests__/telegram-router.test.ts
  - packages/shared/src/schemas/integrations.ts
  - packages/shared/src/schemas/__tests__/integrations.test.ts
files-modified:
  - prisma/schema.prisma (TelegramBinding model + User.telegramBinding back-rel)
  - apps/api/src/app.module.ts (TelegramModule registered)
  - apps/api/src/infrastructure/bullmq/bullmq.module.ts (telegram-outbound queue)
  - apps/api/src/infrastructure/trpc/trpc.router.ts (2 new procedures)
  - apps/api/src/main.ts (telegramOutboundQueue handle)
  - packages/shared/src/index.ts (re-export integrations schemas)
  - apps/web/src/components/admin/settings-tab.tsx (5th sub-tab + IntegrationsSubTab)
  - apps/web/src/components/admin/settings-tab.test.tsx (3 new tests + tab-count update)
tests:
  api: 871 → 887 (+16)
  web: 354 → 357 (+3)
  shared: 540 → 582 (+42)
  integration: 66 (unchanged)
migration:
  path: prisma/migrations/20260511023400_telegram_binding_stub/migration.sql
  applied: true
  container_prisma_client_regenerated: true
---

# Phase 55: Telegram Integration — Seeds-only Scaffolding

## One-liner

Land the `TelegramBinding` schema, a pluggable `TelegramAdapter` port with a
deterministic mock, a BullMQ outbound queue + worker, two admin-only tRPC
procedures (status + smoke-test), and a 5th "Integrations" sub-tab on the
admin Settings page — without activating a real bot.

## Scope (user decision 2026-05-11)

User chose **option A** for the discuss-phase question «один бот для всей PEO»
(single bot for the whole org) and explicitly deferred everything else:

> «без real config = броски в пустоту, пока просто заделы»

So this phase lands scaffolding only. **No** real Telegram API client, **no**
`/start` `/summary` `/ask` handlers, **no** binding-issuance UI. The surface
is built so the future activation phase can wire a real adapter behind the
same DI token without touching schema, queue, or web tabs again.

## What landed

### 1. Schema (`prisma/schema.prisma` + migration)

```
model TelegramBinding {
  id          String    @id @default(uuid())
  userId      String    @unique           → User.id (Cascade)
  chatId      String    @unique
  linkedAt    DateTime  @default(now())
  active      Boolean   @default(true)
  lastSeenAt  DateTime?

  @@index([active, linkedAt])
}
```

- 1:1 inverse `User.telegramBinding` added (nullable, no `onDelete` on the
  User side — bindings are dropped via the Cascade FK).
- Compound `(active, linkedAt)` index supports the
  `admin.integrationsStatus` count query without a sequential scan once
  bindings grow past a handful.
- **Additive migration only** — no drops, no NOT NULL on existing tables.
  Idempotent in the sense that re-running `prisma migrate deploy` on a
  fresh DB produces the same end state.
- Migration applied in both host and container; Prisma 7 client
  regenerated in both. API and web containers restarted, both healthy.

### 2. Adapter seam (`apps/api/src/modules/telegram/`)

- **`telegram.adapter.ts`** — `TelegramAdapter` interface with single
  `send(chatId: string, text: string): Promise<{ ok: boolean }>` method.
  `TELEGRAM_ADAPTER` DI token (string literal — Nest can't bind interfaces).
  Shape mirrors `AiAdapter` (Phase 54) deliberately so the two ports stay
  conceptually parallel for future contributors.
- **`mock-telegram.adapter.ts`** — `MockTelegramAdapter`. Records
  `lastPayload` so tests can assert without parsing logs; emits one
  structured-JSON log line per send matching the
  `email-reminder.processor.ts` format so the existing log dashboard stays
  uniform.
- **`telegram.module.ts`** — Nest module providing the adapter via
  `selectTelegramAdapter()` factory:
  - `TG_BOT_TOKEN` empty/whitespace/unset → `MockTelegramAdapter`
  - `TG_BOT_TOKEN` set → throws `Error('Telegram bot not configured')` at
    module construction. **Fails loud** rather than falling back to the
    mock, because a token being present means the org expects real
    delivery and a silent mock would swallow notifications.

### 3. Outbound queue (`telegram.queue.ts` + BullMQModule)

- BullMQModule registers a new `telegram-outbound` queue alongside
  `pdf-export` and `email-reminder`.
- `TelegramProcessor` is a raw `new Worker(...)` on `OnModuleInit` —
  **NOT** `@Processor` — because of the recurring `@nestjs/bullmq` 11 +
  NestJS 11 `DiscoveryService` DI bug noted in
  `email-reminder.processor.ts`. Concurrency 2 (Telegram per-bot rate
  limit headroom; seeds-only path only sees admin smoke tests).
- Default job opts: `attempts: 3`, exponential backoff with 5s floor,
  `removeOnComplete: 100`, `removeOnFail: 500`. Configured per-enqueue at
  the producer (not on the queue) so this surface stays generic.
- Producer surface in Phase 55: ONLY the admin smoke-test endpoint.
  Reminder integration (Phase 44 parallel channel) and RAG summary
  delivery (Phase 54 → Phase 55 hand-off) are deferred to the activation
  phase.
- Failure event handler emits structured-JSON ERROR log matching
  `email-reminder.processor.ts`.

### 4. tRPC surface (`infrastructure/trpc/trpc.router.ts`)

Two new admin-gated procedures:

- **`admin.integrationsStatus()`** → `{ telegram: { configured, bindings } }`
  - `configured`: `process.env.TG_BOT_TOKEN` is set (non-empty after trim)
    on the API process. Token itself never leaves the API.
  - `bindings`: `prisma.telegramBinding.count({ where: { active: true } })`.
  - Badge in the admin UI is green only when both gates are truthy.

- **`admin.testTelegramSend({ chatId, text })`** → `{ jobId }`
  - Enqueues a `telegram-test` job into `telegram-outbound` with the
    standard retry policy.
  - Throws `INTERNAL_SERVER_ERROR` if `deps.telegramOutboundQueue` is
    undefined (role-coverage `createAppRouter({})` fixtures stay green).

Shared schemas (`packages/shared/src/schemas/integrations.ts`):

- `telegramIntegrationStatusSchema` — `{ configured: boolean, bindings: int>=0 }`
- `integrationsStatusSchema` — wraps Telegram under a `telegram` key; future
  integrations (Slack, MS Teams, webhook fan-out) add sibling keys.
- `adminTestTelegramSendSchema` — `{ chatId: trimmed string 1..64, text:
trimmed string 1..4096 }`. `chatId` is `string` (not `number`) because
  Telegram chat ids are 64-bit and the Prisma column is `TEXT`.

### 5. Admin UI (`apps/web/src/components/admin/settings-tab.tsx`)

- Added 5th sub-tab `value="integrations"` to the existing
  Identity/Periods/Reminders/Notifications shadcn `Tabs`.
- `IntegrationsSubTab` component renders one card per integration. v1
  only Telegram:
  - Header: «Telegram»
  - Sub-copy: «Привязка пользователей и реальный бот будут добавлены в
    отдельной фазе.»
  - Badge: green «Подключён» (when configured + bindings>0) /
    muted «Не активно» (otherwise).
  - Below the badge: a 2-column `dl` showing raw `Bot configured` /
    `Active bindings` for transparency.
- Data comes from `admin.integrationsStatus` via the TRPCProxy/React
  Query bridge.

## Verification

| Gate                                       | Result               |
| ------------------------------------------ | -------------------- |
| `pnpm --filter @customreport/api test`     | 887 passed (was 871) |
| `pnpm --filter @customreport/web test`     | 357 passed (was 354) |
| `pnpm --filter @customreport/shared test`  | 582 passed (was 540) |
| `pnpm --filter @customreport/api tsc`      | exit 0 (clean)       |
| `pnpm --filter @customreport/web tsc`      | exit 0 (clean)       |
| `prisma migrate deploy` (host + container) | applied              |
| `prisma generate` (host + container)       | client regenerated   |
| `docker compose restart api web`           | both healthy         |

## Decisions made (and the «why»)

1. **Single bot for the whole org** (user decision A, 2026-05-11). Per-
   department bots multiply infrastructure cost and authentication
   complexity without a clear win — the existing Keycloak SAML identity
   already maps people to departments, so the bot can route on `User.role`
   and `User.reportingGroupId` server-side.
2. **No real client library imported.** Spec explicitly forbids `telegraf`
   / `grammY`. Adding them now would imply readiness to ship — keeping the
   dependency surface clean delays that decision to the activation phase.
3. **Mock adapter records `lastPayload`, not an event emitter.** Tests
   stay synchronous; the cost (one mutable field) is trivial.
4. **`chatId` is `TEXT` in DB, `string` in TypeScript.** Telegram returns
   `bigint`-shaped ids; passing them through as opaque strings avoids
   `BigInt` JSON-serialization headaches and matches how the Bot API
   itself encodes them in HTTPS responses.
5. **Queue registered in `BullMQModule`, not `TelegramModule`.** Centralises
   queue registration with the existing `pdf-export` and `email-reminder`
   queues so the BullMQ infrastructure module remains the single source of
   truth for queue names.
6. **Worker uses raw `new Worker(...)`** mirroring the
   `EmailReminderProcessor` pattern — the @nestjs/bullmq DiscoveryService
   bug is documented in three places now, and the project has a stable
   pattern for working around it.

## Deviations from plan

**None** — plan executed as specified. The spec was unusually concrete
("interface signature: X", "module name: Y", "queue name: Z") so there were
few interpretation decisions left to make at execution time.

Minor mechanical adjustments worth noting:

- **Migration timestamp.** Spec said `<timestamp>_telegram_binding_stub`; I
  used `20260511023400` so the lexicographic order stays after the most
  recent `20260511014523_group_product_m2m`. Verified by listing the
  migrations dir after creation.
- **Eslint warning on `!` non-null assertion** in the first mock-adapter
  test required a minor refactor before the pre-commit hook would accept
  it. Recorded as an instrumentation-quality fix, not a deviation.
- **An older migration (`20260510215245_period_model_expansion`) had been
  modified after apply**, blocking `prisma migrate dev`. Worked around by
  writing the migration SQL manually and applying via `prisma migrate
deploy` — which is the production-correct approach anyway. Flagged in
  the «Open questions» section below.

## Known stubs (intentional)

- **`MockTelegramAdapter.send` ignores text content.** No template
  rendering, no rate-limit, no chat-blocked detection. By design — the
  real adapter owns those concerns.
- **No producer enqueues to `telegram-outbound` except `admin.testTelegramSend`.**
  The future activation phase will wire reminder dispatch (Phase 44
  parallel channel) and RAG summary delivery (Phase 54 → Phase 55
  hand-off) into this queue. Documented inline in `telegram.queue.ts`.
- **No `/start` `/summary` `/ask` handlers.** Spec explicit: those need
  an active bot.
- **No binding-issuance UI.** A future user-binding flow will need a
  one-time-token surface; not scoped to Phase 55.

## Threat flags

None new. The new tRPC procedures are `adminProcedure`-gated, the binding
table has no PII beyond the Telegram chat id (which the user voluntarily
binds), and the env-token check never leaks the token to the web tier
(only the derived boolean `configured`).

## Open questions for the activation phase

1. **Modified migration.** `20260510215245_period_model_expansion` was
   edited after being applied, which blocks `prisma migrate dev` going
   forward. Recommend a follow-up cleanup: either reset the dev DB (loses
   local data — friction at 02:30 MSK), or accept the in-tree drift and
   document that we now always create migrations via `migrate deploy` +
   manual SQL. The latter is the safer night-mode answer.
2. **Real adapter choice.** `telegraf` (most stars, mature) vs `grammY`
   (lighter, modern type-inference). Defer until activation phase.
3. **Bot identity.** Single-bot was the user decision; the bot's
   `@username` and `BotFather` setup is operational work for the
   activation phase.

## Self-Check: PASSED

- `prisma/migrations/20260511023400_telegram_binding_stub/migration.sql` — FOUND
- `apps/api/src/modules/telegram/telegram.adapter.ts` — FOUND
- `apps/api/src/modules/telegram/mock-telegram.adapter.ts` — FOUND
- `apps/api/src/modules/telegram/telegram.module.ts` — FOUND
- `apps/api/src/modules/telegram/telegram.queue.ts` — FOUND
- `apps/api/src/modules/telegram/__tests__/mock-telegram.adapter.test.ts` — FOUND
- `apps/api/src/modules/telegram/__tests__/telegram.module.test.ts` — FOUND
- `apps/api/src/modules/telegram/__tests__/telegram.queue.test.ts` — FOUND
- `apps/api/src/modules/telegram/__tests__/telegram-router.test.ts` — FOUND
- `packages/shared/src/schemas/integrations.ts` — FOUND
- `packages/shared/src/schemas/__tests__/integrations.test.ts` — FOUND
- Commit `2001b4c` (55-1) — FOUND
- Commit `4d8f803` (55-2) — FOUND
- Commit `6549637` (55-3) — FOUND
- Commit `5f4c0c5` (55-4) — FOUND
- Commit `92ed9a1` (55-5) — FOUND
