# Per-file audit — apps/api/src/infrastructure/prisma (2026-07-02)

Read-only audit, wave 1. No code changes were made.

Scope: 2 files (`prisma.service.ts`, `prisma.module.ts`).

Kept: 6 findings (1 high, 1 medium, 4 low). Killed: 1.

## prisma.service.ts (5 findings)

| Lines          | Dimension  | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                                                | Suggestion                                                                                                                                                                                                                        | Your verdict |
| -------------- | ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 105            | env-config | high     | `onModuleInit` reads `process.env.LOG_LEVEL ?? "info"` ad-hoc instead of the validated `EnvConfig`. The constructor already receives `env: EnvConfig` (with `LOG_LEVEL` required in `env.schema.ts`, no default) for exactly this purpose, but never stores it as a field, so `onModuleInit` falls back to raw `process.env` plus a silent `?? "info"` default — both patterns the ENV/CONFIG rule explicitly forbids. | Store `env` as a readonly field in the constructor and read `this.env.LOG_LEVEL === "debug"` in `onModuleInit` instead of `process.env`.                                                                                          |              |
| 29-33, 101-104 | comments   | medium   | The same rationale (why `$on` needs the `PrismaLogEventEmitter` structural cast) is explained twice: once on the interface (5 lines) and again in `onModuleInit` (4 lines, which even says "(see above)" yet still restates the full narrowing rationale). The interface comment exceeds the 3-line comment budget, and together they duplicate the same WHY.                                                          | Keep one explanation at the interface declaration only (trim to <=3 lines or relocate detail to an ADR with a <=2-line pointer); delete the repeat in `onModuleInit`.                                                             |              |
| 15-18          | comments   | low      | 4-line comment over the `DEFAULT_DB_POOL_*` constants explains boot-fail coordination behavior (load-bearing WHY) but exceeds the 3-line budget.                                                                                                                                                                                                                                                                       | Trim to <=3 lines, or relocate the coordination rationale to an ADR/spec and leave a <=2-line pointer per the RELOCATE policy.                                                                                                    |              |
| 87-92          | comments   | low      | 6-line comment before `pool.on("error", ...)` combines two WHYs (the unhandled-error-crash rationale, and the `NestAppLoggerAdapter` string-coercion convention) — well over the 3-line budget.                                                                                                                                                                                                                        | Split: keep a 2-line note on the crash-avoidance WHY next to the listener; relocate the logger-adapter string-convention rationale to a shared comment/ADR near `NestAppLoggerAdapter` itself so it isn't restated per call site. |              |

Already good: pool teardown is correctly ordered and complete — `onModuleDestroy` disconnects Prisma, ends the pg pool, and logs, with no leaked connections on shutdown.

## prisma.module.ts (1 finding)

| Lines | Dimension | Severity | Finding                                                                                                                                   | Suggestion                                                                                                                                                                                                                                      | Your verdict |
| ----- | --------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 10-13 | comments  | low      | 4-line comment explaining the TS1206/tRPC-`AppRouter` factory-injection workaround exceeds the 3-line budget for a coordination-type WHY. | Trim to <=3 lines or relocate the TS1206 workaround rationale to an ADR/spec with a <=2-line pointer here (this exact issue is already recorded in project memory, suggesting it deserves a durable doc rather than a repeated inline comment). |              |

Already good: clean single-purpose module — only wires `PrismaService` via a documented factory provider, one import, no leaked domain logic; 23 lines, trivially scannable.

## Rollup

**By dimension:** comments 5 (4 low, 1 medium) · env-config 1 (high).

**By severity:** high 1 · medium 1 · low 4.

**Top-3 highest-impact:**

1. `prisma.service.ts:105` — `process.env.LOG_LEVEL ?? "info"` bypass of the already-injected validated `EnvConfig`; only high-severity finding, one-line fix (store `env` as a field).
2. `prisma.service.ts:29-33, 101-104` — duplicated `$on` cast rationale, doubly over the comment budget; the largest single duplication found in this folder.
3. `prisma.service.ts:87-92` — two unrelated WHYs bundled into one over-budget comment on the pool-error listener, the most operationally sensitive comment in the file.

**Overlap with pending OpenSpec changes:** `observe-prisma-pool` is the pending change most likely to touch this exact file (pool config, error logging, `DEFAULT_DB_POOL_*`, the `pool.on("error", ...)` listener). The pool/log-adjacent findings — lines 15-18, 87-92, and the `LOG_LEVEL` env-config finding at line 105 — sit on code that change is expected to touch anyway, so fold them into `observe-prisma-pool`'s implementation rather than a standalone style sweep. The remaining `$on`/interface-comment duplication (29-33, 101-104) and the `prisma.module.ts` TS1206 comment have no matching pending change; safe to fix directly as local style cleanup.

## Killed by verification

- **`DB_POOL_MAX`/`DB_POOL_IDLE_TIMEOUT_MS`/`DB_POOL_CONNECTION_TIMEOUT_MS` resolved via `env.X ?? DEFAULT_X`** (lines 19-21, 59-66), flagged as the banned silent-default shape. Refuted: present values ARE validated by `env.schema.ts` (fails boot when malformed), absence is an explicitly modelled Zod `.optional()`, the defaults are named documented constants mirroring pg's own library defaults, and the resolved pool config is logged on one greppable line at boot. The hazard the ENV rule targets — a fallback that hides whether a value is mandatory — is absent; nothing here is silent or hidden.
