import { describe, expect, it } from "vitest";

import { planLiveControlActions } from "../../replay/live-control-planning.ts";
import { preflightControlForPlan } from "../playwright-preflight.ts";
import { revealPathFor, revealSurfaceFor } from "../reveal-path.ts";

describe("preflight stable link target", () => {
  it("propagates exact DOM href into inventory and the frozen action", () => {
    const [plan] = planLiveControlActions([
      {
        controlKey: "link:Created%20just%20now:1",
        domOrderKey: "0010:link:Created%20just%20now:1",
        order: 10,
        role: "link",
        accessibleName: "Created just now",
        enabled: true,
        disabled: false,
        visible: true,
        tagName: "a",
        inputType: null,
        href: "/lead/report/a0000000-0000-4000-8000-000000000001",
      },
    ]);
    if (plan === undefined) throw new Error("Expected one live control plan");

    const control = preflightControlForPlan(
      plan,
      revealPathFor([], "/lead/report"),
      revealSurfaceFor([plan.control]),
    );
    expect(control.inventory.href).toBe(
      "/lead/report/a0000000-0000-4000-8000-000000000001",
    );
    expect(control.action?.target).toEqual({
      role: "link",
      href: "/lead/report/a0000000-0000-4000-8000-000000000001",
    });
  });
});
