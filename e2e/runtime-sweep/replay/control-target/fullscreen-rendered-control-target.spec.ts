import { expect, test } from "@playwright/test";

import type { Action } from "../../source/contracts.ts";
import { executeControlAction } from "../control-actions/control-actions.ts";
import { inventoryDom } from "../dom/dom-inventory.ts";
import {
  hrefTargetLocator,
  releaseRenderedNameTarget,
  renderedNameTargetHandle,
  targetLocator,
  titleTargetLocator,
} from "./rendered-control-target.ts";

const clickAction = (controlKey: string): Action => ({
  controlKey,
  operation: "click",
  safety: "read-only",
  transition: "none",
});

test("keeps duplicate exit controls and fallbacks inside the fullscreen root", async ({
  page,
}) => {
  await page.setContent(`
    <button id="enter" type="button">Enter fullscreen</button>
    <div id="deck" style="width:320px;height:240px">
      <button id="inside-exit" type="button" aria-label="Exit fullscreen">Inside exit</button>
      <button id="inside-title" type="button" title="Title fallback">Inside title</button>
      <a id="inside-href" href="#target">Inside link</a>
      <button id="inside-rendered" type="button"><span style="text-transform: uppercase">Rendered fallback</span></button>
    </div>
    <button id="outside-exit" type="button" aria-label="Exit fullscreen">Outside exit</button>
    <button id="outside-title" type="button" title="Title fallback">Outside title</button>
    <a id="outside-href" href="#target">Outside link</a>
    <button id="outside-rendered" type="button"><span style="text-transform: uppercase">Rendered fallback</span></button>
    <output id="result"></output>
    <script>
      const output = document.getElementById("result");
      document.getElementById("enter").addEventListener("click", () => {
        void document.getElementById("deck").requestFullscreen();
      });
      document.getElementById("inside-exit").addEventListener("click", () => {
        output.textContent = "inside";
        void document.exitFullscreen();
      });
      document.getElementById("outside-exit").addEventListener("click", () => {
        output.textContent = "outside";
      });
    </script>
  `);

  await page.locator("#enter").click();
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.id ?? null))
    .toBe("deck");

  const inventory = await inventoryDom(page);
  expect(inventory.visibleText).not.toContain("Outside");
  const exitControl = inventory.controls.find(
    ({ accessibleName }) => accessibleName === "Exit fullscreen",
  );
  if (exitControl === undefined) throw new Error("Fullscreen exit is missing");
  const exitTarget = { ...exitControl, ariaRole: exitControl.role };
  expect(
    inventory.controls.filter(
      ({ accessibleName }) => accessibleName === "Exit fullscreen",
    ),
  ).toHaveLength(1);

  await expect(targetLocator(page, exitTarget)).toHaveCount(1);
  await expect(targetLocator(page, exitTarget)).toHaveAttribute(
    "id",
    "inside-exit",
  );

  const titleControl = {
    controlKey: "button:Title%20fallback:1",
    ariaRole: "button" as const,
    accessibleName: "Title fallback",
    enabled: true,
  };
  await expect(titleTargetLocator(page, titleControl)).toHaveCount(1);
  await expect(titleTargetLocator(page, titleControl)).toHaveAttribute(
    "id",
    "inside-title",
  );

  const hrefControl = {
    controlKey: "link:Changed%20link:1",
    ariaRole: "link" as const,
    accessibleName: "Changed link",
    enabled: true,
    href: "#target",
  };
  const hrefTarget = hrefTargetLocator(page, hrefControl);
  if (hrefTarget === undefined) throw new Error("Href fallback is unavailable");
  await expect(hrefTarget).toHaveCount(1);
  await expect(hrefTarget).toHaveAttribute("id", "inside-href");

  const renderedTarget = await renderedNameTargetHandle(page, {
    controlKey: "button:RENDERED%20FALLBACK:1",
    ariaRole: "button",
    accessibleName: "RENDERED FALLBACK",
    enabled: true,
  });
  if (renderedTarget === undefined)
    throw new Error("Rendered-name fallback is unavailable");
  expect(await renderedTarget.getAttribute("id")).toBe("inside-rendered");
  await releaseRenderedNameTarget(renderedTarget);

  const result = await executeControlAction({
    page,
    control: exitTarget,
    action: clickAction(exitControl.controlKey),
    observeOutcome: async (): Promise<"pass"> => {
      await expect(page.locator("#result")).toHaveText("inside");
      await expect
        .poll(() => page.evaluate(() => document.fullscreenElement?.id ?? null))
        .toBeNull();
      return "pass";
    },
    timeoutMs: 5000,
  });

  expect(result).toMatchObject({ status: "pass" });
  await expect(page.locator("#result")).toHaveText("inside");
});
