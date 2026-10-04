import { describe, expect, it } from "vitest";

import { familySkipReason, fullFamilyKey, rowSkipReason } from "./full-plan.ts";
import type { FullControl } from "./full-probe.ts";

function control(
  name: string,
  overrides: Partial<FullControl> = {},
): FullControl {
  return {
    selector: "button",
    tag: "button",
    role: "button",
    name,
    type: null,
    href: null,
    disabled: false,
    bounds: { x: 0, y: 0, width: 10, height: 10 },
    clipped: false,
    obstructedBy: null,
    selected: false,
    alternatives: [],
    elementId: name,
    row: null,
    surface: null,
    form: false,
    group: null,
    value: "",
    expanded: false,
    options: [],
    ...overrides,
  };
}

describe("full crawl page families", () => {
  it("collapses record ids but keeps query views apart", () => {
    const id = "a0000000-0000-4000-8000-000000000001";
    expect(fullFamilyKey(`http://x/lead/report/${id}`)).toBe(
      "/lead/report/:id",
    );
    expect(fullFamilyKey("http://x/admin?tab=users&b=x")).toBe(
      "/admin?b=x&tab=users",
    );
    expect(
      fullFamilyKey(`http://x/head/report/${id}?authorId=${id}&source=status`),
    ).toBe("/head/report/:id");
    expect(fullFamilyKey("http://x/admin?tab=jobs")).not.toBe(
      fullFamilyKey("http://x/admin?tab=users"),
    );
  });

  it("presses one exemplar of repeated controls and explains the rest", () => {
    const seen = new Map<string, string>();
    expect(familySkipReason(control("Open Alpha details"), seen)).toBeNull();
    expect(familySkipReason(control("Open Alpha details"), seen)).toBeNull();
    expect(familySkipReason(control("Open Beta details"), seen)).toBe(
      "representative-family: covered by Open Alpha details",
    );
    expect(familySkipReason(control("Reports"), seen)).toBeNull();
  });

  it("gives the first row of a family all of its actions", () => {
    const seen = new Map<string, string>();
    const row = (id: string) => ({ id, family: "table" });
    expect(rowSkipReason(control("Edit", { row: row("r1") }), seen)).toBeNull();
    expect(
      rowSkipReason(control("Delete", { row: row("r1") }), seen),
    ).toBeNull();
    expect(rowSkipReason(control("Edit", { row: row("r2") }), seen)).toBe(
      "representative-row: covered by r1",
    );
  });
});
