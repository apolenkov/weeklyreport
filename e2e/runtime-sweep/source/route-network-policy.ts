import {
  type NetworkEvidencePolicy,
  networkEvidencePolicySchema,
  type Role,
  routeNetworkPolicySchema,
} from "./contracts.ts";

const ADMIN_PRODUCTS_ATTACHED_POLICY = {
  maxRepeatedApiRequests: 3,
  retryStormThreshold: 5,
  slowRequestThresholdMs: 5000,
  cacheExpectedOperations: ["admin.listProductGroupOwnership"],
} as const satisfies NetworkEvidencePolicy;

/**
 * Reviewed route-level network expectations. Catalog prose remains a separate
 * behavioral source and is intentionally not parsed into this contract.
 */
const ROUTE_NETWORK_POLICY: Readonly<
  Record<string, NetworkEvidencePolicy | null>
> = Object.freeze({
  "lead:/": null,
  "lead:/lead/report": null,
  "lead:/lead/report/[reportId]": null,
  "lead:/lead/report/[reportId]/preview": null,
  "lead:/lead/history": null,
  "lead:/reports": null,
  "lead:/reports/[reportId]": null,
  "lead:/reports/[reportId]/present": null,
  "lead:/reports/history": null,
  "lead:/reports/trends": null,
  "head:/": null,
  "head:/head/dashboard": null,
  "head:/head/history": null,
  "head:/head/slides": null,
  "head:/head/report": null,
  "head:/head/report/[reportId]": null,
  "head:/head/report/[reportId]/present": null,
  "head:/lead/history": null,
  "head:/lead/report": null,
  "head:/lead/report/[reportId]": null,
  "head:/reports": null,
  "head:/reports/[reportId]": null,
  "head:/reports/[reportId]/present": null,
  "head:/reports/history": null,
  "head:/reports/trends": null,
  "admin:/": null,
  "admin:/admin": ADMIN_PRODUCTS_ATTACHED_POLICY,
  "admin:/admin/products": null,
  "admin:/admin/activities": null,
  "admin:/admin/settings": null,
  "admin:/head/dashboard": null,
  "admin:/head/history": null,
  "admin:/head/report": null,
  "admin:/head/report/[reportId]": null,
  "admin:/head/report/[reportId]/present": null,
  "admin:/head/slides": null,
  "admin:/lead/history": null,
  "admin:/lead/report": null,
  "admin:/lead/report/[reportId]": null,
  "admin:/reports": null,
  "admin:/reports/[reportId]": null,
  "admin:/reports/[reportId]/present": null,
  "admin:/reports/history": null,
  "admin:/reports/trends": null,
  "viewer:/": null,
  "viewer:/reports": null,
  "viewer:/reports/[reportId]": null,
  "viewer:/reports/[reportId]/present": null,
  "viewer:/reports/history": null,
  "viewer:/reports/latest": null,
  "viewer:/reports/trends": null,
});

export const ROUTE_NETWORK_POLICY_KEYS = Object.freeze(
  Object.keys(ROUTE_NETWORK_POLICY).toSorted((left, right) =>
    left.localeCompare(right),
  ),
);

const routeKey = (role: Role, catalogRoute: string): string =>
  `${role}:${catalogRoute}`;

export function assertRouteNetworkPolicyCoverage(
  routeKeys: readonly string[],
  policyMap: Readonly<
    Record<string, NetworkEvidencePolicy | null>
  > = ROUTE_NETWORK_POLICY,
): void {
  const expected = new Set(routeKeys);
  if (expected.size !== routeKeys.length)
    throw new Error("Generated route declarations must be unique");
  const declared = Object.keys(policyMap);
  const missing = routeKeys.filter((key) => !Object.hasOwn(policyMap, key));
  const extra = declared.filter((key) => !expected.has(key));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `Route network policy map mismatch; missing=${missing.join(",") || "none"}; extra=${extra.join(",") || "none"}`,
    );
  }
  for (const [key, policy] of Object.entries(policyMap)) {
    try {
      routeNetworkPolicySchema.parse(policy);
    } catch (error: unknown) {
      const detail = error instanceof Error ? `: ${error.message}` : "";
      throw new Error(`Invalid network policy for ${key}${detail}`, {
        cause: error,
      });
    }
  }
}

export function networkPolicyForRoute(
  role: Role,
  catalogRoute: string,
): NetworkEvidencePolicy | null {
  const key = routeKey(role, catalogRoute);
  if (!Object.hasOwn(ROUTE_NETWORK_POLICY, key))
    throw new Error(`No network policy declared for route ${key}`);
  const policy = ROUTE_NETWORK_POLICY[key];
  return policy === null ? null : networkEvidencePolicySchema.parse(policy);
}
