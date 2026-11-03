import { describe, expect, it } from "vitest";

import { PAUSED_PROGRESS } from "./item-progress-presentation";

describe("paused progress presentation", () => {
  it("keeps pause neutral and separate from alarm health", () => {
    expect(PAUSED_PROGRESS).toEqual({
      label: "Paused",
      foreground: "--color-muted-foreground",
      className: "text-[var(--color-muted-foreground)]",
    });
  });
});
