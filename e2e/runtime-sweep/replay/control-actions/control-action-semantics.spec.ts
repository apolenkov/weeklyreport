import { expect, test } from "@playwright/test";

import type { Action } from "../../source/contracts.ts";
import { inventoryDom } from "../dom/dom-inventory.ts";
import { executeControlAction } from "./control-actions.ts";

const clickAction = (controlKey: string): Action => ({
  controlKey,
  operation: "click",
  safety: "read-only",
  transition: "none",
});

const expectCleanRenderedState = async (
  page: Parameters<typeof inventoryDom>[0],
): Promise<void> => {
  const state = await page.locator("button").evaluateAll((buttons) =>
    buttons.map((button) => {
      const guarded = button as HTMLElement & Record<string, unknown>;
      return {
        guard: "__runtimeSweepActionGuard" in guarded,
        validator: "__runtimeSweepActionValidator" in guarded,
      };
    }),
  );
  expect(state).toEqual(state.map(() => ({ guard: false, validator: false })));
};

test("locates a title-labelled control when its visible name differs", async ({
  page,
}) => {
  await page.setContent(
    '<span title="Past weeks and closed reports">Tooltip</span><a href="/reports" title="Past weeks and closed reports">History</a>',
  );

  const result = await executeControlAction({
    page,
    control: {
      controlKey: "link:Past%20weeks%20and%20closed%20reports:1",
      ariaRole: "link",
      accessibleName: "Past weeks and closed reports",
      enabled: true,
      href: "/reports",
    },
    action: clickAction("link:Past%20weeks%20and%20closed%20reports:1"),
    observeOutcome: (): Promise<"pass"> => Promise.resolve("pass"),
  });

  expect(result).toMatchObject({ status: "pass" });
});

test("uses the frozen href when a link accessible name changes", async ({
  page,
}) => {
  await page.setContent('<a href="#settings">Current label</a>');

  const result = await executeControlAction({
    page,
    control: {
      controlKey: "link:Settings:1",
      ariaRole: "link",
      accessibleName: "Settings",
      enabled: true,
      href: "#settings",
    },
    action: clickAction("link:Settings:1"),
    observeOutcome: async (): Promise<"pass"> => {
      await expect(page).toHaveURL(/#settings$/u);
      return "pass";
    },
  });

  expect(result).toMatchObject({ status: "pass" });
});

test("uses source text when CSS transforms the role name", async ({ page }) => {
  await page.setContent(`
    <button type="button">
      <div aria-hidden="true">MP</div>
      <div>Marketing portal</div>
      <div style="text-transform: uppercase">No status</div>
      <div>unassigned</div>
    </button>
    <output></output>
    <script>
      document.querySelector("button").addEventListener("click", () => {
        document.querySelector("output").textContent = "opened";
      });
    </script>
  `);
  const control = (await inventoryDom(page)).controls[0];
  if (control === undefined) throw new Error("Composite control is missing");
  expect(control.accessibleName).toBe("Marketing portal No status unassigned");
  await expect(
    page.getByRole("button", {
      name: control.accessibleName,
      exact: true,
    }),
  ).toHaveCount(1);

  const result = await executeControlAction({
    page,
    control: { ...control, ariaRole: "button" },
    action: clickAction(control.controlKey),
    observeOutcome: async (): Promise<"pass"> => {
      await expect(page.locator("output")).toHaveText("opened");
      return "pass";
    },
  });

  expect(result).toMatchObject({ status: "pass" });
});

test("rejects a synchronous same-node mutation during arm validation", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button"><span style="text-transform: uppercase">Open</span></button>
    <output></output>
  `);
  const frozenControl = (await inventoryDom(page)).controls[0];
  if (frozenControl === undefined)
    throw new Error("Rendered control is missing");
  const control = {
    ...frozenControl,
    accessibleName: "OPEN",
    ariaRole: "button" as const,
    controlKey: "button:OPEN:1",
  };
  await page.locator("button").evaluate((button) => {
    if (!(button instanceof HTMLElement)) return;
    const originalText = button.innerText;
    let reads = 0;
    Object.defineProperty(button, "innerText", {
      configurable: true,
      get() {
        reads += 1;
        if (reads === 3) {
          button.textContent = "Different";
          button.onclick = () => {
            const output = document.querySelector("output");
            if (output !== null) output.textContent = "mutated";
          };
        }
        return originalText;
      },
    });
  });

  const result = await executeControlAction({
    page,
    control,
    action: clickAction(control.controlKey),
    timeoutMs: 250,
  });

  expect(result).toMatchObject({ status: "fail" });
  await expect(page.locator("output")).toBeEmpty();
  await expect(page.getByRole("button")).toHaveText("Different");
  await expectCleanRenderedState(page);
});

test("cleans a rendered target that becomes disabled before execution", async ({
  page,
}) => {
  await page.setContent(
    '<button type="button"><span style="text-transform: uppercase">Open</span></button><output></output>',
  );
  const frozenControl = (await inventoryDom(page)).controls[0];
  if (frozenControl === undefined)
    throw new Error("Rendered control is missing");
  const control = { ...frozenControl, ariaRole: "button" as const };
  await page.locator("button").evaluate((button) => {
    if (button instanceof HTMLButtonElement) button.disabled = true;
  });

  const result = await executeControlAction({
    page,
    control,
    action: clickAction(control.controlKey),
    timeoutMs: 250,
  });

  expect(result).toMatchObject({
    status: "not-exercised",
    policy: "unavailable",
    reason: "Control is disabled",
  });
  await expect(page.locator("output")).toBeEmpty();
  await expectCleanRenderedState(page);
});

test("waits for a transient control before exercising it", async ({ page }) => {
  await page.setContent(`
    <button type="button" hidden>Open details</button>
    <script>
      setTimeout(() => { document.querySelector("button").hidden = false; }, 25);
    </script>
  `);

  const result = await executeControlAction({
    page,
    control: {
      controlKey: "button:Open%20details:1",
      ariaRole: "button",
      accessibleName: "Open details",
      enabled: true,
    },
    action: clickAction("button:Open%20details:1"),
    observeOutcome: (): Promise<"pass"> => Promise.resolve("pass"),
    timeoutMs: 250,
  });

  expect(result).toMatchObject({ status: "pass" });
});

test("preserves observer errors instead of swallowing them", async ({
  page,
}) => {
  await page.setContent('<button type="button">Observe</button>');

  const result = await executeControlAction({
    page,
    control: {
      controlKey: "button:Observe:1",
      ariaRole: "button",
      accessibleName: "Observe",
      enabled: true,
    },
    action: clickAction("button:Observe:1"),
    observeOutcome: (): Promise<"pass"> =>
      Promise.reject(new Error("observer exploded")),
  });

  expect(result).toMatchObject({
    status: "fail",
    reason: "observer exploded",
  });
});
