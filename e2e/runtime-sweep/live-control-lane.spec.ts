import { expect, test } from "@playwright/test";

import { inventoryDom } from "./dom-inventory.ts";
import {
  executeLiveControlPlans,
  planLiveControlActions,
} from "./live-control-lane.ts";
import { settleNavigation } from "./navigation.ts";

test.describe("runtime live-control lane", () => {
  test("waits for route app readiness beyond network idle", async ({
    page,
  }) => {
    await page.setContent(`
      <main id="main-content" aria-busy="true">Loading</main>
      <script>
        setTimeout(() => {
          const main = document.querySelector("#main-content");
          main?.setAttribute("aria-busy", "false");
          main?.insertAdjacentHTML("beforeend", "<h1>Ready report</h1>");
        }, 25);
      </script>
    `);

    await settleNavigation(page);

    await expect(page.locator("#main-content")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Ready report",
    );
  });

  test("re-inventories and exercises a control revealed by a menu", async ({
    page,
  }) => {
    await page.setContent(`
      <button type="button" id="open">Open menu</button>
      <div id="menu" role="menu" hidden>
        <button type="button">View details</button>
      </div>
      <output id="result"></output>
      <script>
        document.getElementById("open").addEventListener("click", () => {
          document.getElementById("menu").hidden = false;
        });
        document.querySelector("#menu button").addEventListener("click", () => {
          document.getElementById("result").textContent = "Details shown";
        });
      </script>
    `);
    const initial = await inventoryDom(page);
    const records = await executeLiveControlPlans({
      page,
      plans: planLiveControlActions(initial.controls),
      preparePage: () => Promise.resolve(),
      reinventory: async () => (await inventoryDom(page)).controls,
    });

    expect(records.map(({ controlKey }) => controlKey)).toEqual([
      "button:Open%20menu:1",
      "menu:(unnamed):1",
      "button:View%20details:1",
    ]);
    expect(records.map(({ status }) => status)).toEqual([
      "pass",
      "not-exercised",
      "pass",
    ]);
  });

  test("fails a click whose page has no observable URL, DOM, focus, or network outcome", async ({
    page,
  }) => {
    await page.setContent(
      '<button type="button" tabindex="-1">No observable outcome</button>',
    );
    const inventory = await inventoryDom(page);
    const records = await executeLiveControlPlans({
      page,
      plans: planLiveControlActions(inventory.controls),
      preparePage: () => Promise.resolve(),
    });

    expect(records[0]?.status).toBe("fail");
  });

  test("observes a switch transition through aria-checked", async ({
    page,
  }) => {
    await page.setContent(`
      <button type="button" role="switch" aria-label="Notifications" aria-checked="false">Notifications</button>
      <script>
        document.querySelector('[role="switch"]').addEventListener("click", (event) => {
          const switchControl = event.currentTarget;
          switchControl.setAttribute(
            "aria-checked",
            switchControl.getAttribute("aria-checked") === "true" ? "false" : "true",
          );
        });
      </script>
    `);
    const inventory = await inventoryDom(page);
    const records = await executeLiveControlPlans({
      page,
      plans: planLiveControlActions(inventory.controls),
      preparePage: () => Promise.resolve(),
    });

    expect(records[0]).toMatchObject({
      status: "pass",
      observation: { kind: "dom" },
    });
  });

  test("observes an expandable control through aria-expanded", async ({
    page,
  }) => {
    await page.setContent(`
      <button type="button" aria-expanded="false">Details</button>
      <script>
        document.querySelector("button").addEventListener("click", (event) => {
          const control = event.currentTarget;
          control.setAttribute(
            "aria-expanded",
            control.getAttribute("aria-expanded") === "true" ? "false" : "true",
          );
        });
      </script>
    `);
    const inventory = await inventoryDom(page);
    const records = await executeLiveControlPlans({
      page,
      plans: planLiveControlActions(inventory.controls),
      preparePage: () => Promise.resolve(),
    });

    expect(records[0]).toMatchObject({
      status: "pass",
      observation: { kind: "dom" },
    });
  });

  test("waits for a delayed DOM outcome before failing a click", async ({
    page,
  }) => {
    await page.setContent(`
      <button type="button">Reveal result</button>
      <output id="result"></output>
      <script>
        document.querySelector("button").addEventListener("click", () => {
          setTimeout(() => {
            document.querySelector("#result").textContent = "revealed";
          }, 25);
        });
      </script>
    `);
    const inventory = await inventoryDom(page);
    const records = await executeLiveControlPlans({
      page,
      plans: planLiveControlActions(inventory.controls),
      preparePage: () => Promise.resolve(),
      timeoutMs: 250,
    });

    expect(records[0]).toMatchObject({
      status: "pass",
      observation: { kind: "dom" },
    });
  });

  test("accepts a read-only click on an already-selected control", async ({
    page,
  }) => {
    await page.setContent(
      '<button type="button" aria-pressed="true">Read</button>',
    );
    const inventory = await inventoryDom(page);
    const records = await executeLiveControlPlans({
      page,
      plans: planLiveControlActions(inventory.controls),
      preparePage: () => Promise.resolve(),
      timeoutMs: 100,
    });

    expect(records[0]).toMatchObject({
      status: "pass",
      observation: { kind: "dom" },
    });
  });

  test("observes skip-to-content focus and scroll without accepting ordinary focus", async ({
    page,
  }) => {
    await page.setContent(`
      <style>
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          overflow: hidden;
          clip: rect(0 0 0 0);
          white-space: nowrap;
          pointer-events: none;
        }
      </style>
      <a class="sr-only" href="#main-content">Skip to content</a>
      <div style="height: 900px"></div>
      <main id="main-content" tabindex="-1">Report content</main>
      <script>
        document.querySelector("a").addEventListener("click", (event) => {
          event.preventDefault();
          const main = document.getElementById("main-content");
          main.focus();
          window.scrollTo(0, 480);
        });
      </script>
    `);
    const inventory = await inventoryDom(page);
    const records = await executeLiveControlPlans({
      page,
      plans: planLiveControlActions(inventory.controls),
      preparePage: () => Promise.resolve(),
    });

    expect(records[0]).toMatchObject({
      status: "pass",
      observation: { kind: "focus" },
    });
  });

  test("fails an inert off-screen click that only scrolls the viewport", async ({
    page,
  }) => {
    await page.setContent(`
      <div style="height: 1400px"></div>
      <button type="button">Inert off-screen action</button>
    `);
    const inventory = await inventoryDom(page);
    const records = await executeLiveControlPlans({
      page,
      plans: planLiveControlActions(inventory.controls),
      preparePage: () => Promise.resolve(),
    });

    expect(records[0]).toMatchObject({
      status: "fail",
      observation: { kind: "dom" },
    });
  });
});
