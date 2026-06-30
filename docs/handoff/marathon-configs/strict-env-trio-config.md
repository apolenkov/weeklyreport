# Strict-env trio — ready-to-load waveb-autorun configs (HIGH-stakes, ONE-AT-A-TIME, order #29→#30→#31)

Load into `.claude/workflows/waveb-autorun.js` CHANGES one at a time, in order. Each
fully committed before the next (they share env.schema.ts + .env.example +
docker-compose.prod.yml + the ConfigModule). After #29: `grep -rn 'Symbol("ENV_CONFIG")'`
must show exactly ONE definition (a duplicate token = silent boot-time DI failure
typecheck won't catch).

## ENV_CONFIG contract (load-bearing)

#29 CREATES `apps/api/src/infrastructure/config/config.module.ts` owning ONE
`const ENV_CONFIG = Symbol(...)` + exported `ConfigModule {provide: ENV_CONFIG,
useFactory: validateEnv, exports:[ENV_CONFIG]}`. #30 HealthModule + #31 PrismaModule
do `imports:[ConfigModule]` and `@Inject(ENV_CONFIG)`. An app.module-only provider is
FORBIDDEN (Nest exports flow UP to importer, not down → unresolvable from imported module).

## #29 enforce-smtp-config (stakes high, needsIntegration true)

ALREADY standard-compliant; job = create the shared ConfigModule/ENV_CONFIG token + wire EmailService.
files: env.schema.ts (SMTP_HOST+SMTP_FROM prod superRefine fences alongside the existing prod block; PDF_EXPORT_JWT_SECRET .min(16)->.min(32) + fix the "Min 16" comment to 32), config.module.ts (NEW — ENV_CONFIG Symbol + exported ConfigModule), app.module.ts (import ConfigModule so EmailService injects), email/email.service.ts (@Inject(ENV_CONFIG); drop `?? "noreply@example.com"` and `?? 587` — replace dev jsonTransport path with NAMED consts DEV_JSON_TRANSPORT_FROM/DEFAULT_SMTP_PORT), modules/pdf-export/pdf-export.service.ts (verify+sign guards <16->-<32, msgs ">=16"->">=32"), docker-compose.prod.yml (PDF msg "min 16"->"min 32"; SMTP already :? — no change), .env.example (PDF wording 16->32).
testFiles: env.schema/validateEnv unit (prod-missing-SMTP_HOST fails, prod-missing-SMTP_FROM fails, prod-both passes, dev/test-neither passes, PDF<32 fails), email/email-dispatch.integration.test.ts (overrideProvider(ENV_CONFIG).useValue, not process.env mutation), pdf-export.service.test.ts (sub-32 rejected).
mustCover: prod boot exits(1) on absent SMTP_HOST|SMTP_FROM, dev/test empty SMTP_HOST still boots (jsonTransport); no `.default()` added (SMTP stays .optional() prod-fenced); no inline `??` magic literal remains AND dev path still resolves from/port via named consts; PDF floor=32 in 4 places (schema, signPdf, verifyPdf, prod-compose msg + .env docs); ENV_CONFIG single shared Symbol resolvable by EmailService.
caveat: NO schema .default() to drop here; SMTP_FROM/PORT stay .optional() so env.SMTP_FROM is string|undefined — replace `??` with named consts (don't just delete). ONE shared const Symbol imported everywhere.
commitSubject: fix(config): fence SMTP in production, raise PDF secret floor to 32, inject validated EnvConfig into EmailService

## #30 fix-heap-health-threshold (stakes high, needsIntegration false) — DEPENDS ON #29

VIOLATION: drop the design's `.default(1_610_612_736)`.
files: env.schema.ts (ADD `HEAP_HEALTH_THRESHOLD_BYTES: z.coerce.number().int().positive()` REQUIRED no-default), health/health.controller.ts (@Inject(ENV_CONFIG); REMOVE checkHeap from liveness(); readiness() uses env.HEAP_HEALTH_THRESHOLD_BYTES), health/health.module.ts (imports:[ConfigModule]), docker-compose.prod.yml + docker-compose.dev.yml + docker-compose.yml (add HEAP to api env), .env (HEAP=1610612736), .env.example (value + "75% of container memory limit" comment), e2e/playwright.integration.config.ts (add HEAP to webServer api env ~line 80).
testFiles: health/health.test.ts (liveness has NO memory_heap; readiness calls checkHeap with EnvConfig threshold; provide ENV_CONFIG fixture).
mustCover: boot exits(1) when HEAP absent (no schema default); NO .default() in schema; liveness ok w/o memory_heap, readiness uses env threshold; HEAP present in EVERY env source where OTEL_TRACES_SAMPLER_ARG is (grep-diff the sets match); 1536MiB value only as documented .env.example/compose value never schema/code default.
caveat: required-no-default → must appear in the SAME env-source set as OTEL_TRACES_SAMPLER_ARG/AUTH_JWT_SECRET (.env, .env.example, all 3 compose, e2e config) or that boot exits(1). Compose recommend `${HEAP_HEALTH_THRESHOLD_BYTES:?set to ~75% of api container memory}` (`:-1610612736` defensible if schema default dropped — pick consciously). If #29 not landed, this must create ConfigModule itself.
commitSubject: fix(health): drop heap from liveness and make the readiness heap threshold a required, env-validated value

## #31 observe-prisma-pool (stakes high, needsIntegration false) — DEPENDS ON #29

VIOLATION: reject D2 "no Zod / raw process.env / inline parseInt + silent fallback".
files: env.schema.ts (ADD DB*POOL_MAX: z.coerce.number().int().positive().optional(); DB_POOL_IDLE_TIMEOUT_MS + DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().nonnegative().optional() — NO .default()), prisma/prisma.service.ts (@Inject(ENV_CONFIG); pass max/idleTimeoutMillis/connectionTimeoutMillis to pg.Pool from env with NAMED default consts on absence; pool.on('error') listener → logger.error SINGLE string embedding JSON.stringify({phase:'pg.pool.error',message}); boot-log resolved config in onModuleInit; DROP design's parsePositiveInt/parseNonNegativeInt), prisma/prisma.module.ts (@Global gains imports:[ConfigModule]), .env.example + .env.test.example (document the 3 vars commented).
testFiles: prisma/prisma.service.test.ts ((a) pool.on('error') → logger.error exactly once w/ string embedding phase:'pg.pool.error'+message, no crash; (b) resolved config == logged config; ENV_CONFIG fixture; pg.Pool/EventEmitter double).
mustCover: pool.on('error') routes idle error to logger.error once, process does NOT crash; log payload single string embedding phase+message (not [object Object]); NO .default() for DB_POOL vars + inline parse helpers removed; malformed present DB_POOL_MAX ("10junk","1.5","0","-1") FAILS BOOT LOUD via validateEnv; reads from injected EnvConfig not raw process.env, passed value == logged value.
caveat: raw process.env unsafe (validateEnv runs only in main.ts; a Nest test module constructing PrismaService bypasses it → NaN reaches pg). .optional()+named-consumer-default is compliant for genuinely-optional tunables; malformed PRESENT value still fails boot via coerce. DB_POOL*\* are .optional() → NOT added to compose/.env, only documented (asymmetry vs #30 intentional). Constructor-sig change = widest blast radius: EVERY PrismaService construction (bull-board.module, period.module, all unit tests) must provide/override ENV_CONFIG. NestAppLoggerAdapter String()-coerces 1st arg + treats 2nd as Nest context → must embed fields in ONE string.
commitSubject: fix(prisma): add pool error listener and env-validated, injected pool sizing/timeouts

## Gate note

#29 gate MUST run integration (email-dispatch.integration.test.ts excluded from unit `pnpm test`). #30/#31 unit-only. All three: db:generate + full validateEnv unit test; after #29 grep for duplicate Symbol.
