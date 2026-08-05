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
});
