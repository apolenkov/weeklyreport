import { expect, test } from "@playwright/test";

import type { Action } from "./contracts.ts";
import { executeControlAction } from "./control-actions.ts";

const clickAction = (controlKey: string): Action => ({
  controlKey,
  operation: "click",
  safety: "read-only",
  transition: "none",
});

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
