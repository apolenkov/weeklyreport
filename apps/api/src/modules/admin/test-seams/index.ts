// Test-only seam for lifecycle writes that are composed by another module's
// integration tests. Production callers use AdminPrismaRepository or the
// PeriodAdminService facade instead.
export { archivePeriod } from "../admin-period-lifecycle.js";
