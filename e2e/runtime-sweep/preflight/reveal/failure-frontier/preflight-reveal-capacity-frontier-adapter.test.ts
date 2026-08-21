import { rm } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { reducerStateDigestFor } from "../continuation/preflight-reveal-continuation-reducer.ts";
import { adaptSourceBoundCapacityFrontier } from "./preflight-reveal-capacity-frontier-adapter.ts";
import { fixtureFor } from "./preflight-reveal-capacity-frontier-test-fixture.ts";

const reasonFor = (
  result: ReturnType<typeof adaptSourceBoundCapacityFrontier>,
) => {
  if (result.kind !== "rejected") throw new Error("Fixture unexpectedly ready");
  return result.reason;
};

describe("source-bound capacity frontier adapter", () => {
  it("accepts a parsed frontier with exact source, cursor, and asset bindings", async () => {
    const { fixture, input, packetRoot } = await fixtureFor();
    try {
      const result = adaptSourceBoundCapacityFrontier(input);
      expect(result.kind).toBe("ready");
      if (result.kind === "ready") {
        expect(result.frontier.reducerStateDigest).toBe(
          reducerStateDigestFor(input.initialState),
        );
        expect(result.frontier.ordinaryPlans).toHaveLength(1);
      }
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
      await rm(packetRoot, { recursive: true, force: true });
    }
  });

  it("rejects substituted cap or non-canonical plan derivation", async () => {
    const { fixture, input, packetRoot } = await fixtureFor();
    try {
      expect(
        reasonFor(
          adaptSourceBoundCapacityFrontier({
            ...input,
            queueInput: {
              ...input.queueInput,
              maxControlsPerSegment: input.queueInput.maxControlsPerSegment + 1,
            },
          }),
        ),
      ).toBe("canonical-plan-derivation-failed");
      expect(
        reasonFor(
          adaptSourceBoundCapacityFrontier({
            ...input,
            queueInput: {
              ...input.queueInput,
              plansFor: (inventory) => input.queueInput.plansFor(inventory),
            },
          }),
        ),
      ).toBe("canonical-plan-derivation-failed");
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
      await rm(packetRoot, { recursive: true, force: true });
    }
  });
});
