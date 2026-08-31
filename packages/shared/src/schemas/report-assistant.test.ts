import { describe, expect, it } from "vitest";

import {
  REPORT_ASSISTANT_RESOURCE_RETRY_MAX_SECONDS,
  reportAssistantOutcomeSchema,
} from "./report-assistant";

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

  it("accepts the stable per-user resource-limited outcome", () => {
    expect(
      reportAssistantOutcomeSchema.parse({
        kind: "resource_limited",
        retryAfterSeconds: REPORT_ASSISTANT_RESOURCE_RETRY_MAX_SECONDS,
      }),
    ).toEqual({
      kind: "resource_limited",
      retryAfterSeconds: REPORT_ASSISTANT_RESOURCE_RETRY_MAX_SECONDS,
    });
  });

  it("rejects resource-limited retry delays above the 120-second maximum", () => {
    expect(
      reportAssistantOutcomeSchema.safeParse({
        kind: "resource_limited",
        retryAfterSeconds: REPORT_ASSISTANT_RESOURCE_RETRY_MAX_SECONDS + 1,
      }).success,
    ).toBe(false);
  });
});
