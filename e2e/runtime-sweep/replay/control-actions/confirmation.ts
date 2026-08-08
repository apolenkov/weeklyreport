import type { Locator, Page } from "@playwright/test";

import type { StatefulControlOperation } from "../control-action-policy.ts";
import { ControlActionPolicyError } from "../control-recovery.ts";

const CONFIRMATION_NAMES: Readonly<Record<StatefulControlOperation, RegExp>> = {
  publish: /publish/i,
  delete: /delete/i,
  revoke: /revoke/i,
  restore: /restore|unarchive/i,
  submit: /^submit$/i,
};

const exactSubmitDialog = async (page: Page): Promise<Locator> => {
  const dialogs = page.getByRole("alertdialog", {
    name: "Confirm submission",
    exact: true,
  });
  const count = await dialogs.count();
  if (count !== 1)
    throw new ControlActionPolicyError(
      `Submit action requires exactly one Confirm submission dialog; found ${count}`,
    );
  return dialogs.first();
};

const genericDialog = async (page: Page): Promise<Locator> => {
  const dialog = page.getByRole("alertdialog").last();
  if ((await dialog.count()) === 0)
    throw new ControlActionPolicyError(
      "Destructive action did not present a confirmation dialog",
    );
  return dialog;
};

const dialogFor = (
  page: Page,
  operation: StatefulControlOperation,
): Promise<Locator> =>
  operation === "submit" ? exactSubmitDialog(page) : genericDialog(page);

const confirmationFor = async (
  dialog: Locator,
  operation: StatefulControlOperation,
): Promise<Locator> => {
  const confirmations = dialog.getByRole("button", {
    name: CONFIRMATION_NAMES[operation],
  });
  const count = await confirmations.count();
  if (count === 0 || (operation === "submit" && count !== 1))
    throw new ControlActionPolicyError(
      `Confirmation dialog for ${operation} requires one matching button; found ${count}`,
    );
  return confirmations.first();
};

export const confirmStatefulAction = async (
  page: Page,
  operation: StatefulControlOperation,
  timeoutMs: number,
): Promise<void> => {
  const dialog = await dialogFor(page, operation);
  const confirmation = await confirmationFor(dialog, operation);
  await confirmation.click({ timeout: timeoutMs });
};
