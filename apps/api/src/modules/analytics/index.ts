/**
 * analytics facade barrel — public surface for siblings (Zone 3). Export-only,
 * zero side effects. period's DI wiring pulls the module + the cache invalidator.
 */
export { AnalyticsCache } from "./analytics.cache.js";
export { AnalyticsModule } from "./analytics.module.js";
