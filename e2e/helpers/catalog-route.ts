import type { Role } from "@customreport/shared";

import {
  ACTIVE_REPORT_ID,
  PUBLISHED_REPORT_ID,
} from "../../prisma/seeds/support/seed-constants.js";

export function resolveCatalogRoute(route: string, role: Role): string {
  if (!route.includes("[")) return route;

  const reportId =
    role === "viewer" || route.startsWith("/reports/")
      ? PUBLISHED_REPORT_ID
      : ACTIVE_REPORT_ID;
  const resolved = route.replace("[reportId]", reportId);
  if (resolved.includes("[")) {
    throw new Error(
      `Unresolved dynamic route token in ${route}: add a deterministic seed fixture before catalog acceptance can visit it.`,
    );
  }
  return resolved;
}
