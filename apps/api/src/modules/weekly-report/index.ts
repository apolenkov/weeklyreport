/**
 * weekly-report facade barrel — public surface for siblings (Zone 3).
 * Export-only, zero side effects. period pulls the module (DI) and the
 * repository (its resolver reads the current/latest report ids).
 */
export { WeeklyReportModule } from "./weekly-report.module.js";
export { WeeklyReportPrismaRepository } from "./weekly-report.prisma-repository.js";
