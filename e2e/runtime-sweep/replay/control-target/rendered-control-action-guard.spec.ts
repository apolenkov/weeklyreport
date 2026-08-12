import { expect, test } from "@playwright/test";

import type { Action } from "../../source/contracts.ts";
import { executeControlAttempt } from "../control-action-executor.ts";
import { executeControlAction } from "../control-actions.ts";
import { inventoryDom } from "../dom-inventory.ts";
import { renderedNameTargetHandle } from "./rendered-control-target.ts";

const clickAction = (controlKey: string): Action => ({
  controlKey,
  operation: "click",
  safety: "read-only",
  transition: "none",
});

const expectNoGuardState = async (
  page: Parameters<typeof inventoryDom>[0],
  selector: string,
): Promise<void> => {
  await expect
    .poll(() =>
      page.locator(selector).evaluate((element) => {
        const guarded = element as HTMLElement & Record<string, unknown>;
        return {
          guard: "__runtimeSweepActionGuard" in guarded,
          validator: "__runtimeSweepActionValidator" in guarded,
        };
      }),
    )
    .toEqual({ guard: false, validator: false });
};

test("aborts a near-deadline action before its target becomes actionable", async ({
  page,
}) => {
  for (const attempt of Array.from({ length: 20 }, (_, index) => index)) {
    await page.setContent(`
      <button type="button" style="pointer-events: none"><span style="text-transform: uppercase">Open</span></button>
      <output>0</output>
    `);
    const frozenControl = (await inventoryDom(page)).controls[0];
    if (frozenControl === undefined)
      throw new Error("Rendered control is missing");
    await page.locator("button").evaluate((button) => {
      if (!(button instanceof HTMLElement)) return;
      const originalText = button.innerText;
      let reads = 0;
      Object.defineProperty(button, "innerText", {
        configurable: true,
        get() {
          reads += 1;
          if (reads === 3)
            window.setTimeout(() => {
              button.style.pointerEvents = "auto";
            }, 45);
          return originalText;
        },
      });
      button.addEventListener("click", () => {
        const output = document.querySelector("output");
        if (output !== null) output.textContent = "clicked";
      });
    });
    const control = {
      ...frozenControl,
      accessibleName: "OPEN",
      ariaRole: "button" as const,
      controlKey: "button:OPEN:1",
    };

    const result = await executeControlAction({
      page,
      control,
      action: clickAction(control.controlKey),
      timeoutMs: 50,
    });

    expect(result, `attempt ${attempt}`).toMatchObject({ status: "fail" });
    await expect(page.locator("output")).toHaveText("0");
    await expectNoGuardState(page, "button");
  }
});

test("bounds a renderer stall between revalidation and action ownership", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button"><span style="text-transform: uppercase">Open</span></button>
    <output></output>
  `);
  const frozenControl = (await inventoryDom(page)).controls[0];
  if (frozenControl === undefined)
    throw new Error("Rendered control is missing");
  await page.locator("button").evaluate((button) => {
    if (!(button instanceof HTMLElement)) return;
    const originalText = button.innerText;
    let reads = 0;
    Object.defineProperty(button, "innerText", {
      configurable: true,
      get() {
        reads += 1;
        if (reads === 3)
          window.setTimeout(() => {
            const deadline = Date.now() + 300;
            while (Date.now() < deadline) continue;
            document.body.dataset.interphaseStallComplete = "true";
          });
        return originalText;
      },
    });
  });
  const control = {
    ...frozenControl,
    accessibleName: "OPEN",
    ariaRole: "button" as const,
    controlKey: "button:OPEN:1",
  };
  const startedAt = performance.now();

  const result = await executeControlAction({
    page,
    control,
    action: clickAction(control.controlKey),
    timeoutMs: 50,
  });

  expect(result).toMatchObject({
    status: "fail",
    reason: "Control action exceeded 50ms",
  });
  expect(performance.now() - startedAt).toBeLessThan(200);
  await expect(page.locator("body")).toHaveAttribute(
    "data-interphase-stall-complete",
    "true",
  );
  await expect(page.locator("output")).toBeEmpty();
  await expectNoGuardState(page, "button");
});

test("bounds an acting renderer stall and quarantines possible tail input", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button"><span style="text-transform: uppercase">Open</span></button>
    <output></output>
  `);
  const frozenControl = (await inventoryDom(page)).controls[0];
  if (frozenControl === undefined)
    throw new Error("Rendered control is missing");
  await page.locator("button").evaluate((button) => {
    button.addEventListener("pointerdown", () => {
      const deadline = Date.now() + 300;
      while (Date.now() < deadline) continue;
      document.body.dataset.actingStallComplete = "true";
    });
    button.addEventListener("click", () => {
      const output = document.querySelector("output");
      if (output !== null) output.textContent = "clicked";
    });
  });
  const control = {
    ...frozenControl,
    accessibleName: "OPEN",
    ariaRole: "button" as const,
    controlKey: "button:OPEN:1",
  };
  const target = await renderedNameTargetHandle(page, control);
  if (target === undefined) throw new Error("Rendered target is missing");
  const startedAt = performance.now();

  try {
    const result = await executeControlAttempt(
      {
        page,
        control,
        action: {
          controlKey: control.controlKey,
          operation: "publish",
          safety: "irreversible",
          transition: "publish",
        },
      },
      { kind: "handle", target },
      50,
    );

    expect(result).toEqual({
      status: "ambiguous",
      reason: "Control action exceeded 50ms",
    });
    expect(performance.now() - startedAt).toBeLessThan(200);
    await expect(page.locator("body")).toHaveAttribute(
      "data-acting-stall-complete",
      "true",
    );
    expect(["", "clicked"]).toContain(await page.locator("output").innerText());
    await expectNoGuardState(page, "button");
  } finally {
    await target.dispose();
  }
});

test("blocks Enter when an invalidated skip link cannot take focus", async ({
  page,
}) => {
  await page.setContent(`
    <button id="previous" type="button">Previous</button>
    <a id="skip" href="#main"><span style="text-transform: uppercase">Skip to content</span></a>
    <main id="main" tabindex="-1">Main</main>
    <output></output>
  `);
  const frozenControl = (await inventoryDom(page)).controls.find(
    (control) => control.href === "#main",
  );
  if (frozenControl === undefined) throw new Error("Skip link is missing");
  await page.evaluate(() => {
    const previous = document.querySelector("#previous");
    const skip = document.querySelector("#skip");
    const output = document.querySelector("output");
    if (
      !(previous instanceof HTMLButtonElement) ||
      !(skip instanceof HTMLAnchorElement) ||
      output === null
    )
      return;
    const record = (name: string): void => {
      output.textContent += `${name},`;
    };
    previous.addEventListener("keydown", () => record("keydown"));
    previous.addEventListener("click", () => record("click"));
    skip.addEventListener("focus", () => {
      document.body.dataset.skipFocusMutation = "true";
      previous.focus();
    });
    previous.focus();
  });
  const control = {
    accessibleName: "SKIP TO CONTENT",
    ariaRole: "link" as const,
    controlKey: "link:SKIP%20TO%20CONTENT:1",
    enabled: frozenControl.enabled,
  };
  await expect(
    page.getByRole("link", { name: control.accessibleName, exact: true }),
  ).toHaveCount(0);

  const result = await executeControlAction({
    page,
    control,
    action: clickAction(control.controlKey),
    observeOutcome: (): Promise<"pass"> => Promise.resolve("pass"),
    timeoutMs: 250,
  });

  expect(result).toMatchObject({ status: "fail" });
  await expect(page.locator("output")).toBeEmpty();
  await expect(page.locator("#previous")).toBeFocused();
  await expectNoGuardState(page, "#skip");
  await page.locator("#previous").press("Enter");
  await expect(page.locator("output")).toContainText("keydown,click,");
});
