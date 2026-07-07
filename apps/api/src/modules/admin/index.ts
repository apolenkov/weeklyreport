/**
 * admin facade barrel — the module's public surface for siblings (Zone 3).
 * Export-only, zero side effects. Re-exports the Nest module + the symbols
 * siblings consume: AdminService (period/report-sections DI), the
 * SessionRevocationService (auth), and AdminPeriodOverlapError (period repo).
 */
export { AdminModule } from "./admin.module.js";
export { AdminService } from "./admin.service.js";
export { AdminPeriodOverlapError } from "./admin-shared.js";
export { SessionRevocationService } from "./session-revocation.service.js";
