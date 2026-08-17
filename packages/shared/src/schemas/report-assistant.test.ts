import { describe, expect, it } from "vitest";

import { reportAssistantOutcomeSchema } from "./report-assistant";

describe("reportAssistantOutcomeSchema", () => {
  it("accepts the temporary provider-unavailable outcome", () => {
    expect(
      reportAssistantOutcomeSchema.parse({ kind: "provider_unavailable" }),
    ).toEqual({ kind: "provider_unavailable" });
  });

  it("keeps provider failure details out of the public outcome", () => {
    expect(
      reportAssistantOutcomeSchema.safeParse({
        kind: "provider_unavailable",
        statusCode: 429,
      }).success,
    ).toBe(false);
  });

  it("accepts bounded safe rate-limit feedback without provider details", () => {
    expect(
      reportAssistantOutcomeSchema.parse({
        kind: "provider_unavailable",
        rateLimit: { retryAfterSeconds: 42 },
      }),
    ).toEqual({
      kind: "provider_unavailable",
      rateLimit: { retryAfterSeconds: 42 },
    });
  });
});
