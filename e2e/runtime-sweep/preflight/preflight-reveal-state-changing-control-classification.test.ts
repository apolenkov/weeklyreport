import { describe, expect, it } from "vitest";

import { assertControlTransition } from "../matrix/matrix-preflight-transition-validation.ts";
import type { DomControlObservation } from "../replay/dom-inventory.ts";
import { planLiveControlActions } from "../replay/live-control-planning.ts";
import { preflightControlForPlan } from "./playwright-preflight.ts";
import { classifyRevealTransition } from "./preflight-reveal-transition.ts";
import { revealPathFor, revealSurfaceFor } from "./reveal-path.ts";

const route = { resolvedRoute: "/admin/reminders" } as const;

const control = (
  role: string,
  accessibleName: string,
  options: Readonly<Partial<DomControlObservation>> = {},
): DomControlObservation => ({
  controlKey: `${role}:${encodeURIComponent(accessibleName)}:1`,
  domOrderKey: `0001:${role}:${accessibleName}`,
  order: 1,
  role,
  accessibleName,
  enabled: true,
  disabled: false,
  visible: true,
  tagName: "button",
  inputType: null,
  href: null,
  ...options,
});

const planFor = (entry: DomControlObservation) => {
  const plan = planLiveControlActions([entry])[0];
  if (plan === undefined) throw new Error("Expected one control plan");
  return plan;
};

const expectedSurfaceFor = (
  entry: DomControlObservation,
  interactionEffect: "client-only" | "mutation-required" | null,
) =>
  revealSurfaceFor([
    {
      controlKey: entry.controlKey,
      ariaRole: entry.role,
      accessibleName: entry.accessibleName,
      enabled: entry.enabled,
      order: entry.order,
      domOrderKey: entry.domOrderKey,
      href: entry.href,
      interactionEffect,
    },
  ]);

describe("preflight state-changing control classification", () => {
  it.each([
    ["switch", "Reminder active: 2 hours after deadline"],
    ["switch", "Reminder active: 24 hours before deadline"],
    ["checkbox", "Toggle Волков Игорь Олегович on Дежурство по инцидентам"],
    ["radio", "Open details"],
    ["menuitemcheckbox", "Archive"],
    ["menuitemradio", "Retry"],
    ["slider", "Export PDF"],
    ["option", "Publish"],
  ])("requires mutation preparation for %s %s", (role, accessibleName) => {
    const entry = control(role, accessibleName);
    expect(classifyRevealTransition(planFor(entry), route)).toMatchObject({
      kind: "mutation-required",
      action: { operation: "click", safety: "irreversible" },
    });
  });

  it.each(["Open details", "Archive", "Retry", "Publish", "Export PDF"])(
    "does not let label wording downgrade a checkbox: %s",
    (accessibleName) => {
      const entry = control("checkbox", accessibleName);

      expect(planFor(entry).action).toMatchObject({
        operation: "click",
        safety: "irreversible",
      });
    },
  );

  it("keeps disabled, background, and unnamed state controls unavailable", () => {
    const plans = [
      planFor(
        control("checkbox", "Disabled", { enabled: false, disabled: true }),
      ),
      planFor(
        control("switch", "Behind modal", {
          keyboardFocusScope: "background",
          keyboardFocusPolicy: "forbidden",
          keyboardExpectedFocusable: false,
        }),
      ),
      planFor(control("radio", "")),
    ];

    expect(
      plans.map(({ action, policy, reason }) => [action, policy, reason]),
    ).toEqual([
      [undefined, "unavailable", "Control is disabled"],
      [undefined, "unavailable", "Control is blocked by an active modal"],
      [undefined, "unavailable", "Control has no accessible name"],
    ]);
  });

  it("keeps an ordinary disclosure button read-only", () => {
    const disclosure = control("button", "Archive");
    const plan = planFor(disclosure);

    expect(classifyRevealTransition(plan, route).kind).toBe("read-only-click");
  });

  it("keeps immediate-mutation selects in the matrix but out of reveal", () => {
    const assignment = control("combobox", "Assign Testing stage", {
      tagName: "select",
      interactionEffect: "mutation-required",
    });
    const plan = planLiveControlActions([assignment], {
      formSafety: "disposable-reset",
    })[0];
    if (plan === undefined) throw new Error("Expected one control plan");

    expect(plan.action).toMatchObject({
      operation: "select",
      safety: "irreversible",
      transition: "none",
    });
    expect(classifyRevealTransition(plan, route)).toMatchObject({
      kind: "mutation-required",
      action: plan.action,
    });
  });

  it.each(["Approve", "Reject"])(
    "keeps immediate-mutation decision button out of reveal: %s",
    (accessibleName) => {
      const decision = control("button", accessibleName, {
        interactionEffect: "mutation-required",
      });
      const plan = planFor(decision);

      expect(plan.action).toMatchObject({
        operation: "click",
        safety: "read-only",
        transition: "none",
      });
      expect(classifyRevealTransition(plan, route)).toMatchObject({
        kind: "mutation-required",
        action: plan.action,
      });
    },
  );

  it("keeps the marked Add Group save click in the matrix but out of reveal", () => {
    const save = control("button", "Add Group", {
      interactionEffect: "mutation-required",
    });
    const plan = planFor(save);

    expect(plan.action).toMatchObject({
      operation: "click",
      safety: "read-only",
      transition: "none",
    });
    expect(classifyRevealTransition(plan, route)).toMatchObject({
      kind: "mutation-required",
      action: plan.action,
    });
  });

  it("allows an exact mutation-required button without a frozen transition", () => {
    const entry = control("button", "Add Group", {
      interactionEffect: "mutation-required",
    });
    const plan = planFor(entry);

    expect(() =>
      assertControlTransition(
        preflightControlForPlan(
          plan,
          revealPathFor([], route.resolvedRoute),
          expectedSurfaceFor(entry, "mutation-required"),
        ),
      ),
    ).not.toThrow();
  });

  it.each([
    ["missing", control("button", "Add Group"), null],
    [
      "null",
      control("button", "Add Group", {
        interactionEffect: "mutation-required",
      }),
      null,
    ],
    [
      "tampered",
      control("button", "Add Group", {
        interactionEffect: "mutation-required",
      }),
      "client-only",
    ],
  ] as const)(
    "rejects an Add Group button with a %s expected interaction effect",
    (_label, entry, expectedEffect) => {
      const plan = planFor(entry);

      expect(() =>
        assertControlTransition(
          preflightControlForPlan(
            plan,
            revealPathFor([], route.resolvedRoute),
            expectedSurfaceFor(entry, expectedEffect),
          ),
        ),
      ).toThrow(/has no frozen transition/iu);
    },
  );
});
