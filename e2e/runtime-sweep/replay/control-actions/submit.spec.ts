import { expect, type Page, test } from "@playwright/test";

import type { Action } from "../../source/contracts.ts";
import { snapshotPage } from "../live-control/live-control-observation.ts";
import { observerFor } from "../live-control/live-control-records.ts";
import type { ControlActionRecovery } from "../recovery/control-recovery.ts";
import { executeControlAction } from "./control-actions.ts";

const recoveryFixture = (events: string[]): ControlActionRecovery => ({
  databaseUrl: "postgres://localhost/customreport_e2e",
  resetAndReseed: (): Promise<void> => {
    events.push("reset");
    return Promise.resolve();
  },
  assertBaseline: (): Promise<void> => {
    events.push("oracle");
    return Promise.resolve();
  },
});

const submitControl = {
  controlKey: "button:Submit:1",
  ariaRole: "button" as const,
  accessibleName: "Submit",
  enabled: true,
  inputType: "submit",
  tagName: "button",
};

const submitAction: Action = {
  controlKey: submitControl.controlKey,
  operation: "submit",
  safety: "irreversible",
  transition: "submit",
};

const runSubmit = (
  page: Page,
  events: string[],
  observeOutcome: () => Promise<"pass" | "fail">,
) =>
  executeControlAction({
    page,
    control: submitControl,
    action: submitAction,
    recovery: recoveryFixture(events),
    observeOutcome,
  });

test.describe("runtime submit confirmation", () => {
  test("activates Submit once, confirms in its named dialog, and observes mutation", async ({
    page,
  }) => {
    const events: string[] = [];
    await page.setContent(`
      <button type="button" id="submit-trigger">Submit</button>
      <div role="alertdialog" aria-label="Confirm submission" hidden>
        <button type="button">Cancel</button>
        <button type="button" id="confirm-submit">Submit</button>
      </div>
      <output id="activation-count"></output>
      <output id="result"></output>
      <script>
        (() => {
          const trigger = document.getElementById("submit-trigger");
          const dialog = document.querySelector("[role=alertdialog]");
          const confirmButton = document.getElementById("confirm-submit");
          const activationCount = document.getElementById("activation-count");
          const result = document.getElementById("result");
          trigger.addEventListener("click", () => {
            activationCount.textContent = String(
              Number(activationCount.textContent ?? "0") + 1,
            );
            dialog.hidden = false;
          });
          confirmButton.addEventListener("click", () => {
            dialog.hidden = true;
            result.textContent = "Report submitted";
          });
        })();
      </script>
    `);

    const before = await snapshotPage(page);
    const result = await runSubmit(
      page,
      events,
      observerFor(page, "submit", before, 1000),
    );

    expect(result).toMatchObject({
      status: "pass",
      operation: "submit",
      resetPerformed: true,
    });
    await expect(page.locator("#activation-count")).toHaveText("1");
    await expect(page.locator("#result")).toHaveText("Report submitted");
    expect(events).toEqual(["reset", "oracle"]);
  });

  test("fails when confirmation closes without a submit success oracle", async ({
    page,
  }) => {
    const events: string[] = [];
    await page.setContent(`
      <button type="button" id="submit-trigger">Submit</button>
      <div role="alertdialog" aria-label="Confirm submission" hidden>
        <button type="button" id="confirm-submit">Submit</button>
      </div>
      <script>
        const dialog = document.querySelector("[role=alertdialog]");
        document.getElementById("submit-trigger").addEventListener("click", () => {
          dialog.hidden = false;
        });
        document.getElementById("confirm-submit").addEventListener("click", () => {
          dialog.hidden = true;
        });
      </script>
    `);
    const before = await snapshotPage(page);

    const result = await runSubmit(
      page,
      events,
      observerFor(page, "submit", before, 250),
    );

    expect(result).toMatchObject({
      status: "ambiguous",
      resetPerformed: true,
    });
    expect(events).toEqual(["reset", "oracle"]);
  });

  test("treats native form submit without confirmation as ambiguous", async ({
    page,
  }) => {
    const events: string[] = [];
    await page.setContent(`
      <form>
        <button type="submit">Submit</button>
      </form>
      <script>
        document.querySelector("form").addEventListener("submit", (event) => {
          event.preventDefault();
        });
      </script>
    `);

    const result = await runSubmit(page, events, () => Promise.resolve("pass"));

    expect(result).toMatchObject({
      status: "ambiguous",
      operation: "submit",
      resetPerformed: true,
    });
    expect(events).toEqual(["reset", "oracle"]);
  });

  for (const [label, dialogName, confirmationName] of [
    ["missing matching button", "Confirm submission", "Cancel"],
    ["mismatched dialog name", "Other confirmation", "Submit"],
  ] as const)
    test(`treats a ${label} as ambiguous`, async ({ page }) => {
      const events: string[] = [];
      await page.setContent(`
        <button type="button" id="submit-trigger">Submit</button>
        <div role="alertdialog" aria-label="${dialogName}" hidden>
          <button type="button">${confirmationName}</button>
        </div>
        <script>
          document
            .getElementById("submit-trigger")
            .addEventListener("click", () => {
              document.querySelector("[role=alertdialog]").hidden = false;
            });
        </script>
      `);

      const result = await runSubmit(page, events, () =>
        Promise.resolve("pass"),
      );

      expect(result).toMatchObject({
        status: "ambiguous",
        operation: "submit",
        resetPerformed: true,
      });
      expect(events).toEqual(["reset", "oracle"]);
    });

  for (const [label, duplicateMarkup] of [
    [
      "duplicate named dialogs",
      '<div role="alertdialog" aria-label="Confirm submission"><button>Submit</button></div>',
    ],
    ["duplicate scoped buttons", "<button>Submit</button>"],
  ] as const)
    test(`treats ${label} as ambiguous`, async ({ page }) => {
      const events: string[] = [];
      await page.setContent(`
        <button type="button" id="submit-trigger">Submit</button>
        <div role="alertdialog" aria-label="Confirm submission" hidden>
          <button type="button">Submit</button>
          ${duplicateMarkup}
        </div>
        <script>
          document.getElementById("submit-trigger").addEventListener("click", () => {
            document.querySelectorAll("[role=alertdialog]").forEach((dialog) => {
              dialog.hidden = false;
            });
          });
        </script>
      `);

      const result = await runSubmit(page, events, () =>
        Promise.resolve("pass"),
      );

      expect(result).toMatchObject({
        status: "ambiguous",
        resetPerformed: true,
      });
      expect(events).toEqual(["reset", "oracle"]);
    });
});
