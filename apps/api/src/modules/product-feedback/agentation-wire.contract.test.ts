import { describe, expect, it } from "vitest";

import { normalizeAgentationPath } from "./agentation-wire.js";

describe("Agentation wire contract", () => {
  it("stores only the pathname and drops query/hash", () => {
    expect(
      normalizeAgentationPath("https://weeklyreport.test/lead?x=1#feedback"),
    ).toBe("/lead");
  });

  it("keeps a root pathname for an origin URL", () => {
    expect(normalizeAgentationPath("https://weeklyreport.test")).toBe("/");
  });
});
