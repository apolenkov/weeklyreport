import { describe, expect, it } from "vitest";

import type { DomControlObservation } from "../dom/dom-inventory.ts";
import { planLiveControlActions } from "./live-control-planning.ts";

const listbox = (tagName: "div" | "select"): DomControlObservation => ({
  accessibleName: "Reporting period",
  controlKey: "listbox:Reporting%20period:1",
  disabled: false,
  domOrderKey: "0001:listbox:Reporting%20period:1",
  enabled: true,
  href: null,
  inputType: null,
  order: 1,
  role: "listbox",
  tagName,
  visible: true,
});

describe("live control planning for composite widgets", () => {
  it("keeps a custom listbox container when it has no direct action", () => {
    const [plan] = planLiveControlActions([listbox("div")], {
      formSafety: "disposable-reset",
    });

    expect(plan?.action).toBeUndefined();
    expect(plan).toMatchObject({
      policy: "inapplicable",
      reason:
        "Role listbox is a control-bearing landmark without a direct action",
    });
  });

  it("keeps a native listbox on the representative select path", () => {
    const [plan] = planLiveControlActions([listbox("select")], {
      formSafety: "disposable-reset",
    });

    expect(plan?.action).toMatchObject({
      operation: "select",
      safety: "irreversible",
      transition: "none",
    });
  });
});
