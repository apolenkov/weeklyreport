// Vitest global setup: unit tests do not boot through validateEnv() nor load
// `.env`, and app code reads these via requireEnv (no fallbacks) — supply them
// here. `??=` lets an individual test override or delete a value per scenario.
process.env.PDF_BASE_URL ??= "http://localhost:3000";
process.env.APP_BASE_URL ??= "http://localhost:3000";
process.env.REDIS_HOST ??= "localhost";
process.env.REDIS_PORT ??= "6379";
process.env.REDIS_MAXMEMORY_BYTES ??= "209715200";
// Services build their logger at field-init via `createServiceLogger`, which
// parses LOG_LEVEL through the env schema (no fallback) — supply it here.
process.env.LOG_LEVEL ??= "info";
