import { describe, expect, it } from "vitest";

import { mutationErrorMessage } from "./mutation-error-message";

describe("mutationErrorMessage", () => {
  it("names the action for transport failures", () => {
    expect(
      mutationErrorMessage(
        new TypeError("Failed to fetch"),
        "Failed to publish period",
      ),
    ).toBe("Failed to publish period");
  });

  it("preserves a domain or server message", () => {
    expect(
      mutationErrorMessage(new Error("Forbidden"), "Failed to publish period"),
    ).toBe("Forbidden");
  });

  it("names the action for a raw Zod issues payload", () => {
    const zodIssues = JSON.stringify([
      {
        code: "too_big",
        maximum: 200,
        path: ["name"],
        message: "String must contain at most 200 character(s)",
      },
    ]);
    expect(
      mutationErrorMessage(new Error(zodIssues), "Failed to save activity"),
    ).toBe("Failed to save activity");
  });
});
