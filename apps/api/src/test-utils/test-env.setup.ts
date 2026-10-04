// Vitest global setup: unit tests do not boot through validateEnv() nor load
// `.env`, and app code reads these via requireEnv (no fallbacks) — supply them
// here. `??=` lets an individual test override or delete a value per scenario.
process.env.PDF_BASE_URL ??= "http://localhost:3000";
// Required fail-closed config (syntactic z.url only): the cluster-internal
// hostname never resolves inside unit tests because no test contacts it.
// eslint-disable-next-line sonarjs/no-clear-text-protocols -- the cluster-internal renderer is plaintext by design inside the cluster network
process.env.GOTENBERG_URL ??= "http://gotenberg:3000";
process.env.APP_BASE_URL ??= "http://localhost:3000";
process.env.API_HOST ??= "127.0.0.1";
process.env.REDIS_HOST ??= "localhost";
process.env.REDIS_PORT ??= "6379";
process.env.REDIS_DB ??= "15";
process.env.REDIS_MAXMEMORY_BYTES ??= "209715200";
// The env schema requires LOG_LEVEL (no fallback) — supply it here.
process.env.LOG_LEVEL ??= "info";
