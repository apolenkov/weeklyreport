import { describe, expect, it } from "vitest";

import {
  familySkipReason,
  fullControlReason,
  fullFamilyKey,
  fullPageKey,
  matchControl,
  rowSkipReason,
} from "./full-plan.ts";
import type { FullControl, FullProbe } from "./full-probe.ts";

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
    expect(fullFamilyKey("http://x/admin?tab=jobs&b=x")).toBe(
      "/admin?b=x&tab=jobs",
    );
    expect(
      fullFamilyKey(`http://x/head/report/${id}?authorId=${id}&source=status`),
    ).toBe("/head/report/:id");
    expect(fullFamilyKey("http://x/admin?tab=jobs")).not.toBe(
      fullFamilyKey("http://x/admin?tab=users"),
    );
  });

  it("treats the default admin views as the bare page", () => {
    const bare = fullPageKey("http://x/admin");
    expect(fullPageKey("http://x/admin?tab=users")).toBe(bare);
    expect(fullFamilyKey("http://x/admin?tab=users")).toBe(
      fullFamilyKey("http://x/admin"),
    );
    expect(fullPageKey("http://x/admin?tab=ai&aiTab=provider")).toBe(
      fullPageKey("http://x/admin?tab=ai"),
    );
    expect(
      fullPageKey("http://x/admin?tab=ai&aiTab=provider&aiFeature=x"),
    ).toBe(fullPageKey("http://x/admin?tab=ai"));
    expect(
      fullPageKey("http://x/admin?tab=settings&settingsTab=identity"),
    ).toBe(fullPageKey("http://x/admin?tab=settings"));
    expect(fullPageKey("http://x/admin?tab=ai&aiTab=features")).not.toBe(
      fullPageKey("http://x/admin?tab=ai"),
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

describe("full walk write guard", () => {
  it("skips controls that write relations, the checkbox toggle included", () => {
    for (const name of [
      "Toggle Учёт ресурсов",
      "Detach product",
      "Assign lead",
    ])
      expect(fullControlReason(control(name))).toBe(
        "dangerous: unaudited write action",
      );
    expect(fullControlReason(control("Open details"))).toBeNull();
  });

  it("keeps inputs behind a named scenario whatever role the probe reports", () => {
    for (const [type, role] of [
      ["number", "spinbutton"],
      ["range", "slider"],
      ["submit", "button"],
      ["image", "button"],
      ["date", null],
      ["nonsense", "textbox"],
      [null, "textbox"],
    ] as const)
      expect(
        fullControlReason(control("Count", { tag: "input", type, role })),
      ).toBe("input: requires a named scenario");
    expect(
      fullControlReason(control("Notes", { tag: "textarea", role: "textbox" })),
    ).toBe("input: requires a named scenario");
  });

  it("leaves checkbox, radio and button admission unchanged", () => {
    for (const type of ["checkbox", "radio", "CHECKBOX"])
      expect(
        fullControlReason(
          control("Pick", { tag: "input", type, role: type.toLowerCase() }),
        ),
      ).toBeNull();
    expect(fullControlReason(control("Pick", { type: "submit" }))).toBeNull();
  });
});

function probeOf(...controls: FullControl[]): FullProbe {
  return { controls, signature: "s", surface: null } as unknown as FullProbe;
}

describe("matching a planned control to the live page", () => {
  const edit = (path: string) => control("Edit", { elementId: path });

  it("finds the same element id first", () => {
    const planned = edit("tr:1/button");
    const live = probeOf(edit("tr:1/button"), edit("tr:2/button"));
    expect(matchControl(live, planned, live)).toBe(live.controls[0]);
  });

  it("follows the control when a re-render shifts the DOM paths", () => {
    const planned = edit("tr:2/button");
    const before = probeOf(edit("tr:1/button"), planned);
    const after = probeOf(edit("div:1/tr:1/button"), edit("div:1/tr:2/button"));
    expect(matchControl(after, planned, before)).toBe(after.controls[1]);
  });

  it("calls a control gone when the list changed length", () => {
    const planned = edit("tr:2/button");
    const before = probeOf(edit("tr:1/button"), planned);
    const after = probeOf(edit("div:1/tr:1/button"));
    expect(matchControl(after, planned, before)).toBeUndefined();
  });
});
