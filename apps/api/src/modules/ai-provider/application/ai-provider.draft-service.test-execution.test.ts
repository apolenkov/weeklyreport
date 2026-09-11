import { aiProviderTestCheckSchema } from "@customreport/shared";
import { describe, expect, it } from "vitest";

import { providerChecksFor } from "./ai-provider.draft-service.test-execution.js";

describe("providerChecksFor", () => {
  it("maps a failed capability to the incompatible persisted outcome", () => {
    const checks = providerChecksFor({
      generation: {
        capabilities: [{ capability: "planner_tool_call", status: "failed" }],
      },
    });

    expect(checks).toEqual([
      {
        code: "generation.planner_tool_call",
        outcome: "incompatible",
        passedCount: 0,
        failedCount: 1,
      },
    ]);
    for (const check of checks) {
      expect(aiProviderTestCheckSchema.safeParse(check).success).toBe(true);
    }
  });

  it("keeps the passed and inconclusive outcomes unchanged", () => {
    const checks = providerChecksFor({
      generation: {
        capabilities: [{ capability: "authentication", status: "passed" }],
      },
      embeddings: {
        capabilities: [
          { capability: "batch_embeddings", status: "inconclusive" },
        ],
      },
    });

    expect(checks.map((check) => check.outcome)).toEqual([
      "passed",
      "inconclusive",
    ]);
  });
});
