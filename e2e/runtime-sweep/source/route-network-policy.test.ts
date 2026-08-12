import { describe, expect, it } from "vitest";

import {
  assertRouteNetworkPolicyCoverage,
  networkPolicyForRoute,
  ROUTE_NETWORK_POLICY_KEYS,
} from "./route-network-policy.ts";

describe("route network policy", () => {
  it("covers each generated catalog route exactly once", () => {
    expect(ROUTE_NETWORK_POLICY_KEYS).toHaveLength(51);
    expect(() =>
      assertRouteNetworkPolicyCoverage(ROUTE_NETWORK_POLICY_KEYS),
    ).not.toThrow();
    expect(networkPolicyForRoute("admin", "/admin")).toMatchObject({
      cacheExpectedOperations: ["admin.listProductGroupOwnership"],
    });
    expect(networkPolicyForRoute("lead", "/lead/report")).toBeNull();
  });

  it("rejects missing and unknown generated route keys", () => {
    expect(() =>
      assertRouteNetworkPolicyCoverage(ROUTE_NETWORK_POLICY_KEYS.slice(1)),
    ).toThrow(/extra=/u);
    expect(() =>
      assertRouteNetworkPolicyCoverage([
        ...ROUTE_NETWORK_POLICY_KEYS,
        "admin:/not-declared",
      ]),
    ).toThrow(/missing=admin:\/not-declared/u);
  });

  it("rejects duplicate operations and accepts explicit empty policy", () => {
    expect(() =>
      assertRouteNetworkPolicyCoverage(["fixture:/route"], {
        "fixture:/route": {
          maxRepeatedApiRequests: 3,
          retryStormThreshold: 5,
          slowRequestThresholdMs: 5000,
          cacheExpectedOperations: [
            "admin.listProductGroupOwnership",
            "admin.listProductGroupOwnership",
          ],
        },
      }),
    ).toThrow(/unique/u);
    expect(() =>
      assertRouteNetworkPolicyCoverage(["fixture:/route"], {
        "fixture:/route": {
          maxRepeatedApiRequests: 3,
          retryStormThreshold: 5,
          slowRequestThresholdMs: 5000,
          cacheExpectedOperations: [],
        },
      }),
    ).not.toThrow();
  });
});
