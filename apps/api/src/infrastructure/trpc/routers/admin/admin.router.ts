import { router } from "../../trpc.middleware.js";
import {
  type AdminCatalogDeps,
  createAdminCatalogProcedures,
} from "./catalog.procedures.js";
import {
  type AdminOpsDeps,
  createAdminOpsProcedures,
} from "./ops.procedures.js";
import {
  type AdminPeriodsDeps,
  createAdminPeriodsProcedures,
} from "./periods.procedures.js";
import {
  type AdminReminderPoliciesDeps,
  createAdminReminderPoliciesProcedures,
} from "./reminder-policies.procedures.js";
import {
  type AdminSettingsDeps,
  createAdminSettingsProcedures,
} from "./settings.procedures.js";
import {
  type AdminUsersDeps,
  createAdminUsersProcedures,
} from "./users.procedures.js";

/**
 * Aggregated deps for the admin tRPC namespace — union of the six
 * procedure-group deps interfaces. Satisfied structurally by `AppRouterDeps`.
 */
export interface AdminRouterDeps
  extends
    AdminSettingsDeps,
    AdminUsersDeps,
    AdminCatalogDeps,
    AdminPeriodsDeps,
    AdminReminderPoliciesDeps,
    AdminOpsDeps {}

export function createAdminRouter(deps: AdminRouterDeps) {
  return router({
    ...createAdminSettingsProcedures(deps),
    ...createAdminUsersProcedures(deps),
    ...createAdminCatalogProcedures(deps),
    ...createAdminPeriodsProcedures(deps),
    ...createAdminReminderPoliciesProcedures(deps),
    ...createAdminOpsProcedures(deps),
  });
}
