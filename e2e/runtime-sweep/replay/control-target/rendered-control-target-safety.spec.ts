import { expect, test } from "@playwright/test";

import type { Action } from "../../source/contracts.ts";
import { executeControlAction } from "../control-actions/control-actions.ts";
import {
  armRenderedNameHandle,
  beginRenderedNameAction,
  cleanupRenderedNameGuard,
  renderedNameTargetHandle,
} from "./rendered-control-target.ts";

const CONTROL = {
  controlKey: "button:OPEN:1",
  ariaRole: "button",
  accessibleName: "OPEN",
  enabled: true,
} as const;

const clickAction: Action = {
  controlKey: CONTROL.controlKey,
  operation: "click",
  safety: "read-only",
  transition: "none",
};

const expectNoRuntimeTargetState = async (
  page: Parameters<typeof executeControlAction>[0]["page"],
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

test("never retargets a captured handle after DOM replacement", async ({
  page,
}) => {
  await page.setContent(`
    <main><button type="button"><span style="text-transform: uppercase">Open</span></button></main>
    <output></output>
  `);
  const captured = await renderedNameTargetHandle(page, CONTROL);
  if (captured === undefined) throw new Error("Rendered control is missing");
  await page.locator("main").evaluate((main) => {
    main.innerHTML = '<button type="button">OPEN</button>';
    main.querySelector("button")?.addEventListener("click", () => {
      const output = document.querySelector("output");
      if (output !== null) output.textContent = "wrong";
    });
  });

  await expect(captured.click({ timeout: 50 })).rejects.toThrow();
  await expect(page.locator("output")).toBeEmpty();
  await captured.dispose();
});

test("invalidates a guarded target on same-node microtask reuse", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button"><span style="text-transform: uppercase">Open</span></button>
    <output></output>
  `);
  const captured = await renderedNameTargetHandle(page, CONTROL);
  if (captured === undefined) throw new Error("Rendered control is missing");
  await page.locator("button").evaluate((button) => {
    if (!(button instanceof HTMLElement)) return;
    const originalText = button.innerText;
    Object.defineProperty(button, "innerText", {
      configurable: true,
      get() {
        queueMicrotask(() => {
          button.textContent = "Different";
          button.onclick = () => {
            const output = document.querySelector("output");
            if (output !== null) output.textContent = "mutated";
          };
        });
        return originalText;
      },
    });
  });
  const lease = await armRenderedNameHandle(captured, Date.now() + 250);

  expect(lease).toBeDefined();
  if (lease === undefined) throw new Error("Rendered target was not armed");
  await expect(beginRenderedNameAction(captured, lease)).resolves.toBe(false);
  await expect(page.locator("output")).toBeEmpty();
  await expect(page.getByRole("button")).toHaveText("Different");
  await cleanupRenderedNameGuard(captured, lease);
  await captured.dispose();
  await expectNoRuntimeTargetState(page);
});

test("uses trusted Playwright input for a rendered-name fallback", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button"><span style="text-transform: uppercase">Open</span></button>
    <output></output>
    <script>
      document.querySelector("button").addEventListener("click", (event) => {
        document.querySelector("output").textContent = event.isTrusted ? "trusted" : "untrusted";
      });
    </script>
  `);

  const result = await executeControlAction({
    page,
    control: CONTROL,
    action: clickAction,
    observeOutcome: (): Promise<"pass"> => Promise.resolve("pass"),
    timeoutMs: 250,
  });

  expect(result).toMatchObject({ status: "pass" });
  await expect(page.locator("output")).toHaveText("trusted");
  await expectNoRuntimeTargetState(page);
});

test("returns on an arm timeout and lets the late callback self-clean", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button"><span style="text-transform: uppercase">Open</span></button>
    <output></output>
  `);
  await page.locator("button").evaluate((button) => {
    if (!(button instanceof HTMLElement)) return;
    const originalText = button.innerText;
    let reads = 0;
    Object.defineProperty(button, "innerText", {
      configurable: true,
      get() {
        reads += 1;
        if (reads === 3) {
          const deadline = Date.now() + 300;
          while (Date.now() < deadline) continue;
          document.body.dataset.armProbeComplete = "true";
        }
        return originalText;
      },
    });
  });
  const startedAt = performance.now();

  const result = await executeControlAction({
    page,
    control: CONTROL,
    action: clickAction,
    timeoutMs: 50,
  });

  expect(result).toMatchObject({
    status: "fail",
    reason: "Control action exceeded 50ms",
  });
  expect(performance.now() - startedAt).toBeLessThan(200);
  await expect(page.locator("body")).toHaveAttribute(
    "data-arm-probe-complete",
    "true",
  );
  await expect(page.locator("output")).toBeEmpty();
  await expectNoRuntimeTargetState(page);
});

test("keeps a successful full navigation after old-context cleanup", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button"><span style="text-transform: uppercase">Continue</span></button>
    <script>
      document.querySelector("button").addEventListener("click", () => {
        location.href = "about:blank?done";
      });
    </script>
  `);
  const control = {
    ...CONTROL,
    controlKey: "button:CONTINUE:1",
    accessibleName: "CONTINUE",
  };

  const result = await executeControlAction({
    page,
    control,
    action: { ...clickAction, controlKey: control.controlKey },
    observeOutcome: async (): Promise<"pass"> => {
      await expect(page).toHaveURL("about:blank?done");
      return "pass";
    },
    timeoutMs: 1000,
  });

  expect(result).toMatchObject({ status: "pass" });
});

const ACTIONABILITY_CASES = [
  '<div inert><button type="button"><span style="text-transform: uppercase">Open</span></button></div>',
  '<button type="button" style="pointer-events: none"><span style="text-transform: uppercase">Open</span></button>',
  '<div style="position: relative; display: inline-block"><button type="button"><span style="text-transform: uppercase">Open</span></button><div style="position: absolute; inset: 0; z-index: 2"></div></div>',
] as const;

test("fails closed when rendered controls are not actionable", async ({
  page,
}) => {
  for (const markup of ACTIONABILITY_CASES) {
    await page.setContent(`${markup}<output></output><script>
      document.querySelector("button").addEventListener("click", () => {
        document.querySelector("output").textContent = "clicked";
      });
    </script>`);

    const result = await executeControlAction({
      page,
      control: CONTROL,
      action: clickAction,
      observeOutcome: (): Promise<"pass"> => Promise.resolve("pass"),
      timeoutMs: 100,
    });

    expect(result).toMatchObject({ status: "fail" });
    await expect(page.locator("output")).toBeEmpty();
    await expectNoRuntimeTargetState(page);
  }
});

test("releases every candidate for a missing occurrence", async ({ page }) => {
  await page.setContent(`
    <button type="button"><span style="text-transform: uppercase">Open</span></button>
    <button type="button"><span style="text-transform: uppercase">Open</span></button>
  `);
  const control = { ...CONTROL, controlKey: "button:OPEN:3" };

  const result = await executeControlAction({
    page,
    control,
    action: { ...clickAction, controlKey: control.controlKey },
    timeoutMs: 50,
  });

  expect(result).toMatchObject({ status: "not-exercised" });
  await expectNoRuntimeTargetState(page);
});

test("releases unselected candidates for a later occurrence", async ({
  page,
}) => {
  await page.setContent(`
    <button type="button"><span style="text-transform: uppercase">Open</span></button>
    <button type="button"><span style="text-transform: uppercase">Open</span></button>
    <output></output>
    <script>
      [...document.querySelectorAll("button")].forEach((button, index) => {
        button.addEventListener("click", () => {
          document.querySelector("output").textContent = String(index + 1);
        });
      });
    </script>
  `);
  const control = { ...CONTROL, controlKey: "button:OPEN:2" };

  const result = await executeControlAction({
    page,
    control,
    action: { ...clickAction, controlKey: control.controlKey },
    observeOutcome: (): Promise<"pass"> => Promise.resolve("pass"),
    timeoutMs: 250,
  });

  expect(result).toMatchObject({ status: "pass" });
  await expect(page.locator("output")).toHaveText("2");
  await expectNoRuntimeTargetState(page);
});
