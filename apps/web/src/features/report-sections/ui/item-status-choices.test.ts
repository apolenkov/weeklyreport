import { describe, expect, it } from "vitest";

import { ITEM_STATUS_CHOICES } from "./item-status-choices";

describe("ITEM_STATUS_CHOICES", () => {
  it("offers exactly the five progress statuses — alarms are never free choices", () => {
    expect(ITEM_STATUS_CHOICES.map((choice) => choice.value)).toEqual([
      "planned",
      "in-progress",
      "paused",
      "postponed",
      "completed",
    ]);
    expect(ITEM_STATUS_CHOICES.map((choice) => choice.value)).not.toContain(
      "at-risk",
    );
    expect(ITEM_STATUS_CHOICES.map((choice) => choice.value)).not.toContain(
      "blocked",
    );
  });
});
