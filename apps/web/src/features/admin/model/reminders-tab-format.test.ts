import { describe, expect, it } from "vitest";

import { OFFSET_UNITS } from "./reminders-tab-format";

describe("OFFSET_UNITS", () => {
  it("is the exact offset-unit vocabulary", () => {
    expect(OFFSET_UNITS).toEqual(["minutes", "hours", "days"]);
  });
});
