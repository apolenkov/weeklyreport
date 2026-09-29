import { describe, expect, it } from "vitest";

import { choicesForWeek, ITEM_STATUS_CHOICES } from "./item-status-choices";

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

describe("choicesForWeek", () => {
  it("labels planned as Not started for the current week only", () => {
    const label = (week: "current" | "next") =>
      choicesForWeek(week).find((c) => c.value === "planned")?.label;
    expect(label("current")).toContain("Not started");
    expect(label("next")).not.toContain("Not started");
  });
});
