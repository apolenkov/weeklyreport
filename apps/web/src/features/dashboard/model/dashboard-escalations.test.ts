import { describe, expect, it } from "vitest";

import { escalationToBlockedItem } from "./dashboard-escalations";

describe("escalationToBlockedItem", () => {
  it("maps an escalation without synthesizing a persisted-looking id", () => {
    const item = escalationToBlockedItem({
      type: "blocked",
      productName: "Analytics",
      stageName: "Development",
      leadName: "Bob Lead",
      description: "ETL memory leak",
    });

    expect(item).toEqual({
      severity: "blocked",
      product: "Analytics",
      stage: "Development",
      assignee: "Bob L.",
      description: "ETL memory leak",
    });
    // The wire model carries no record identity — the row must not advertise
    // one that changes with array position.
    expect("id" in item).toBe(false);
  });
});
