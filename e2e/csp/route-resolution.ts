// Route resolution for the CSP walk: only `[reportId]` has a seed fixture
// today. Any other dynamic token means a newly-catalogued route would receive
// zero CSP validation while every role test stays green, so an unresolved
// token must fail the walk rather than be silently skipped.

import type { Role } from "@customreport/shared";

import {
  ACTIVE_REPORT_ID,
  PUBLISHED_REPORT_ID,
} from "../../prisma/seed-constants.js";

export type CspRole = Role;

export function resolveRoute(route: string, role: CspRole): string {
  if (!route.includes("[")) {
    return route;
  }
  const reportId =
    role === "viewer" || route.startsWith("/reports/")
      ? PUBLISHED_REPORT_ID
      : ACTIVE_REPORT_ID;
  const resolved = route.replace("[reportId]", reportId);
  if (resolved.includes("[")) {
    throw new Error(
      `Unresolved dynamic route token in ${route}: every dynamic parameter ` +
        "needs a seed-id fixture so the route cannot skip CSP validation.",
    );
  }
  return resolved;
}
