import type { PermissionBoundary } from "./contracts.ts";

export type RuntimeSurfaceExpectation = Readonly<{
  productContent: "available" | "denied";
  productActions: "exercise" | "inapplicable";
  productActionsReason: string | null;
  shell: "required";
}>;

const LEAD_FORM_ROUTE_KEYS: readonly string[] = Object.freeze([
  "lead:/lead/report",
  "lead:/lead/report/[reportId]",
] as const);
const LEAD_FORM_DENIED_PERMISSIONS: readonly PermissionBoundary[] =
  Object.freeze(["anonymous", "forbidden", "non-owner"] as const);
const LEAD_FORM_UNAVAILABLE_REASON =
  "The lead report form has no section for the current account.";

export function runtimeSurfaceExpectation(input: {
  readonly route: string;
  readonly permission: PermissionBoundary;
}): RuntimeSurfaceExpectation {
  const denied =
    LEAD_FORM_ROUTE_KEYS.includes(input.route) &&
    LEAD_FORM_DENIED_PERMISSIONS.includes(input.permission);
  return Object.freeze({
    productContent: denied ? "denied" : "available",
    productActions: denied ? "inapplicable" : "exercise",
    productActionsReason: denied ? LEAD_FORM_UNAVAILABLE_REASON : null,
    shell: "required",
  });
}
