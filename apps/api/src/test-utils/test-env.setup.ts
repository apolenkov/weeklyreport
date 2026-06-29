/**
 * Vitest global setup: provide the product-critical env vars the application
 * code now reads via `requireEnv(process.env, ...)` (no in-code fallbacks).
 * Unit tests do not boot through `validateEnv()` and vitest does not load
 * `.env`, so without this every test that touches a base-URL-reading path would
 * throw "Missing required environment variable". `??=` lets an individual test
 * override (or `delete`) a value to exercise its own scenario.
 */
process.env.PDF_BASE_URL ??= "http://localhost:3000";
process.env.APP_BASE_URL ??= "http://localhost:3000";
