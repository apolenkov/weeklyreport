import { expect, type Page, test } from "@playwright/test";

import type { Action } from "./contracts.ts";
import { executeControlAction } from "./control-actions.ts";
import type { ControlActionRecovery } from "./control-recovery.ts";

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

const actionFor = (
  operation: Action["operation"],
  safety: Action["safety"],
): Action => ({
  controlKey: `button:${operation}:1`,
  operation,
  safety,
  transition: "none",
});

const FORM_CASES = [
  {
    operation: "fill" as const,
    markup: '<input aria-label="Search" />',
    role: "textbox" as const,
    accessibleName: "Search",
    tagName: "input",
    inputType: "text",
  },
  {
    operation: "fill" as const,
    markup:
      '<input type="search" role="combobox" aria-label="Search Reports" />',
    role: "combobox" as const,
    accessibleName: "Search Reports",
    tagName: "input",
    inputType: "search",
  },
  {
    operation: "select" as const,
    markup:
      '<select aria-label="Status"><option value="draft">Draft</option></select>',
    role: "combobox" as const,
    accessibleName: "Status",
    tagName: "select",
    inputType: null,
  },
  {
    operation: "submit" as const,
    markup:
      '<form><button type="submit">Submit</button><output id="result"></output></form><script>document.querySelector("form").addEventListener("submit", (event) => { event.preventDefault(); document.getElementById("result").textContent = "done"; });</script>',
    role: "button" as const,
    accessibleName: "Submit",
    tagName: "button",
    inputType: "submit",
  },
] as const;

type FormCase = (typeof FORM_CASES)[number];

const runFormCase = async (page: Page, testCase: FormCase): Promise<void> => {
  const events: string[] = [];
  await page.setContent(testCase.markup);
  const result = await executeControlAction({
    page,
    control: {
      controlKey: `${testCase.role}:${testCase.operation}:1`,
      ariaRole: testCase.role,
      accessibleName: testCase.accessibleName,
      enabled: true,
      inputType: testCase.inputType,
      tagName: testCase.tagName,
    },
    action: actionFor(testCase.operation, "irreversible"),
    recovery: recoveryFixture(events),
    observeOutcome: (): Promise<"pass"> => Promise.resolve("pass"),
  });

  expect(result).toMatchObject({
    status: "pass",
    operation: testCase.operation,
    resetPerformed: true,
  });
  expect(events).toEqual(["reset", "oracle"]);
};

test.describe("runtime bounded form actions", () => {
  test("resets and re-seeds every potentially mutating form action", async ({
    page,
  }) => {
    for (const testCase of FORM_CASES) await runFormCase(page, testCase);
  });

  test("resets after a potentially mutating form action fails", async ({
    page,
  }) => {
    const events: string[] = [];
    await page.setContent('<input aria-label="Search" readonly />');

    const result = await executeControlAction({
      page,
      control: {
        controlKey: "textbox:Search:1",
        ariaRole: "textbox",
        accessibleName: "Search",
        enabled: true,
        inputType: "text",
        tagName: "input",
      },
      action: actionFor("fill", "irreversible"),
      recovery: recoveryFixture(events),
      timeoutMs: 100,
    });

    expect(result).toMatchObject({
      status: "fail",
      operation: "fill",
      resetPerformed: true,
    });
    expect(events).toEqual(["reset", "oracle"]);
  });

  test("does not exercise potentially mutating form actions without recovery", async ({
    page,
  }) => {
    const cases = [
      ["fill", "textbox", "Search", "input", "text"],
      ["select", "combobox", "Status", "select", null],
      ["submit", "button", "Submit", "button", "submit"],
    ] as const;
    await page.setContent(
      '<input aria-label="Search" /><select aria-label="Status"><option>Draft</option></select><button type="submit">Submit</button>',
    );

    for (const [
      operation,
      ariaRole,
      accessibleName,
      tagName,
      inputType,
    ] of cases) {
      const result = await executeControlAction({
        page,
        control: {
          controlKey: `${ariaRole}:${accessibleName}:1`,
          ariaRole,
          accessibleName,
          enabled: true,
          inputType,
          tagName,
        },
        action: actionFor(operation, "irreversible"),
      });

      expect(result).toMatchObject({
        status: "not-exercised",
        policy: "unsafe",
        operation,
        resetPerformed: false,
      });
    }
  });
});
