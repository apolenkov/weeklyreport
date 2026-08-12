import { expect, type Page, test } from "@playwright/test";

import type { Action } from "../../source/contracts.ts";
import { executeControlAction } from "../control-actions.ts";
import type { ControlActionRecovery } from "../control-recovery.ts";

const recovery: ControlActionRecovery = {
  databaseUrl: "postgres://localhost/customreport_e2e",
  resetAndReseed: (): Promise<void> => Promise.resolve(),
  assertBaseline: (): Promise<void> => Promise.resolve(),
};

const actionFor = (controlKey: string): Action => ({
  controlKey,
  operation: "fill",
  safety: "irreversible",
  transition: "none",
});

const NATIVE_INPUT_CASES = [
  {
    accessibleName: "Email",
    expectedValue: "runtime-sweep@example.invalid",
    inputType: "email",
    markup: '<input type="email" aria-label="Email" />',
    role: "textbox" as const,
  },
  {
    accessibleName: "Count",
    expectedValue: "1",
    inputType: "number",
    markup: '<input type="number" aria-label="Count" />',
    role: "spinbutton" as const,
  },
  {
    accessibleName: "Date",
    expectedValue: "2026-01-01",
    inputType: "date",
    markup: '<input type="date" aria-label="Date" />',
    role: "textbox" as const,
  },
  {
    accessibleName: "Time",
    expectedValue: "12:00",
    inputType: "time",
    markup: '<input type="time" aria-label="Time" />',
    role: "textbox" as const,
  },
  {
    accessibleName: "Deadline",
    expectedValue: "2026-01-01T12:00",
    inputType: "datetime-local",
    markup: '<input type="datetime-local" aria-label="Deadline" />',
    role: "textbox" as const,
  },
  {
    accessibleName: "URL",
    expectedValue: "https://example.invalid",
    inputType: "url",
    markup: '<input type="url" aria-label="URL" />',
    role: "textbox" as const,
  },
] as const;

const runNativeInputCase = async (
  page: Page,
  testCase: (typeof NATIVE_INPUT_CASES)[number],
): Promise<void> => {
  const controlKey = `${testCase.role}:${testCase.accessibleName}:1`;
  await page.setContent(testCase.markup);
  const result = await executeControlAction({
    page,
    control: {
      controlKey,
      ariaRole: testCase.role,
      accessibleName: testCase.accessibleName,
      enabled: true,
      inputType: testCase.inputType,
      tagName: "input",
    },
    action: actionFor(controlKey),
    recovery,
    observeOutcome: (): Promise<"pass"> => Promise.resolve("pass"),
  });

  expect(result).toMatchObject({
    status: "pass",
    operation: "fill",
    resetPerformed: true,
  });
  await expect(
    page.getByRole(testCase.role, { name: testCase.accessibleName }),
  ).toHaveValue(testCase.expectedValue);
};

test("fills every supported native input type with a valid representative", async ({
  page,
}) => {
  for (const testCase of NATIVE_INPUT_CASES)
    await runNativeInputCase(page, testCase);
});
