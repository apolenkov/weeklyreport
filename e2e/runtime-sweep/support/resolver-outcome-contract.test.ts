import { describe, expect, it } from "vitest";

import {
  bindResolverOutcomeSourceDigest,
  freezeResolverOutcomeIdentity,
  resolverInapplicableFor,
  resolverOutcomeKindsFor,
  VIEWER_STATUS_RESOLVER_KEY,
} from "./resolver-outcome-contract.ts";

const identity = {
  resolverKey: VIEWER_STATUS_RESOLVER_KEY,
  outcome: "visible-current" as const,
  profile: "demo" as const,
  stateId: "viewer-status-visible-current",
  stateDigest: "a".repeat(64),
};

describe("resolver outcome identity", () => {
  it("declares all five state-bound outcomes without a source digest", () => {
    expect(resolverOutcomeKindsFor(VIEWER_STATUS_RESOLVER_KEY)).toEqual([
      "visible-current",
      "published-fallback",
      "empty",
      "query-error",
      "anonymous",
    ]);
    const frozen = freezeResolverOutcomeIdentity(identity);
    expect(frozen).toEqual(identity);
    expect(Object.isFrozen(frozen)).toBe(true);
  });

  it("attaches the source digest only at the downstream binding boundary", () => {
    const frozen = freezeResolverOutcomeIdentity(identity);
    expect(frozen).not.toHaveProperty("sourceDigest");
    expect(bindResolverOutcomeSourceDigest(frozen, "b".repeat(64))).toEqual({
      ...identity,
      sourceDigest: "b".repeat(64),
    });
  });

  it("rejects an unknown resolver key instead of deriving an expectation", () => {
    expect(() => resolverOutcomeKindsFor("unknown-resolver")).toThrow(
      "Unknown runtime resolver key",
    );
  });

  it("represents a missing minimum-profile capability as typed inapplicable", () => {
    expect(resolverInapplicableFor("minimal", "submission-contrast")).toEqual({
      profile: "minimal",
      constraintId: "resolver-profile-capability",
      reason:
        "Profile does not declare required capability submission-contrast",
    });
  });
});
