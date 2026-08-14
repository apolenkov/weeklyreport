import { expect, test } from "@playwright/test";

import {
  snapshotPage,
  waitForObservation,
} from "./live-control-observation.ts";

test.describe("live control observation browser boundary", () => {
  test("observes a canonical control-state change inside the page", async ({
    page,
  }) => {
    await page.setContent(`
      <main>
        <button aria-label="Toggle" aria-pressed="false">Toggle</button>
      </main>
    `);
    const before = await snapshotPage(page);
    await page.evaluate(() => {
      setTimeout(() => {
        const button = document.querySelector("button");
        if (!(button instanceof HTMLButtonElement))
          throw new Error("Toggle button is missing");
        button.setAttribute("aria-pressed", "true");
        button.textContent = "Toggled";
      }, 50);
    });

    await expect(waitForObservation(page, before, 2000)).resolves.toEqual({
      kind: "dom",
      detail: "Live DOM or control state changed",
    });
  });

  test("does not synthesize an observation for an unchanged page", async ({
    page,
  }) => {
    await page.setContent("<main><h1>Unchanged</h1></main>");
    const before = await snapshotPage(page);

    await expect(
      waitForObservation(page, before, 100),
    ).resolves.toBeUndefined();
  });

  test("keeps the deadline when animation frames stop", async ({ page }) => {
    await page.setContent("<main><h1>Paused frames</h1></main>");
    const before = await snapshotPage(page);
    await page.evaluate(() => {
      window.requestAnimationFrame = () => 1;
    });

    const boundedWait = Promise.race([
      waitForObservation(page, before, 100),
      new Promise<never>((_resolve, reject) =>
        setTimeout(
          () => reject(new Error("Observation deadline escaped")),
          750,
        ),
      ),
    ]);
    await expect(boundedWait).resolves.toBeUndefined();
  });

  test("does not turn a same-URL document reset into network evidence", async ({
    page,
  }) => {
    await page.route("http://runtime.test/**", async (route) => {
      if (route.request().isNavigationRequest()) {
        await route.fulfill({
          contentType: "text/html",
          body: '<link rel="icon" href="data:,"><main><h1>Report</h1></main>',
        });
        return;
      }
      await route.fulfill({
        contentType: "application/javascript",
        body: "void 0;",
      });
    });
    await page.goto("http://runtime.test/report");
    await page.addScriptTag({ url: "/initial-resource.js" });
    const before = await snapshotPage(page);
    expect(before.network).toBeGreaterThan(0);
    await page.evaluate(() => {
      setTimeout(() => location.reload(), 50);
    });

    await expect(
      waitForObservation(page, before, 500),
    ).resolves.toBeUndefined();
    const after = await snapshotPage(page);
    expect(after.url).toBe(before.url);
    expect(after.documentId).not.toBe(before.documentId);
    expect(after.dom).toBe(before.dom);
    expect(after.network).toBeLessThan(before.network);
  });
});
