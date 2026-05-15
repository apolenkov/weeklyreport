import { expect, test, type Locator, type Page } from "@playwright/test";

import { loginByCookie, wipeAndReseed } from "./helpers/dev-auth";
import { expandSection, waitForSave } from "../helpers/lead-form";

const LEAD_EMAIL = "lead1@customreport.local";

async function openLeadForm(page: Page) {
  await loginByCookie(page, {
    role: "lead",
    email: LEAD_EMAIL,
    redirect: "/lead/report",
    maxRetries: 4,
  });
  await page.waitForSelector('[data-testid="lead-report-form"]', {
    timeout: 15_000,
  });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {
    // The app keeps some background polling alive in dev; form readiness above
    // is the real barrier for this smoke.
  });
}

async function prepareManualUat(page: Page) {
  await loginByCookie(page, {
    role: "lead",
    email: LEAD_EMAIL,
    redirect: "/lead/report",
    maxRetries: 4,
  });
  await wipeAndReseed(page, "manual-uat");
  await openLeadForm(page);
}

async function expectPrefilledStages(dialog: Locator) {
  await expect(dialog.getByText("SDLC Stages")).toBeVisible();
  const stageChecks = dialog.getByRole("checkbox");
  const count = await stageChecks.count();
  expect(count).toBeGreaterThan(2);
  for (let i = 0; i < count; i += 1) {
    await expect(stageChecks.nth(i)).toBeChecked();
  }
  await expect(dialog.getByText(/\+\d+ more/)).toBeVisible();
}

async function saveAndWait(page: Page, buttonName: RegExp) {
  const save = waitForSave(page);
  await page.getByRole("button", { name: buttonName }).click();
  await save;
}

async function reloadAndExpect(
  page: Page,
  text: string,
  section: Parameters<typeof expandSection>[1],
) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="lead-report-form"]', {
    timeout: 15_000,
  });
  await expandSection(page, section);
  await expect(page.getByText(text)).toBeVisible({ timeout: 10_000 });
}

test.describe("Lead Form UAT recovery", () => {
  test("pre-fills stages and persists Item/Risk/Decision/Priority", async ({
    page,
  }) => {
    const marker = Date.now();
    const itemText = "UAT item " + marker;
    const riskText = "UAT risk " + marker;
    const decisionText = "UAT decision " + marker;
    const priorityText = "UAT priority " + marker;

    const saveDraftResponses: number[] = [];
    page.on("response", (response) => {
      if (response.url().includes("reports.saveDraft")) {
        saveDraftResponses.push(response.status());
      }
    });

    await prepareManualUat(page);

    await expandSection(page, "Current Week");
    await page.getByRole("button", { name: /Add item to/i }).first().click();
    const itemDialog = page.getByRole("dialog", { name: /Add Item dialog/i });
    await expect(itemDialog).toBeVisible();
    await expectPrefilledStages(itemDialog);
    await itemDialog.getByLabel(/Description/i).fill(itemText);
    await saveAndWait(page, /Save Item/i);
    await reloadAndExpect(page, itemText, "Current Week");

    await expandSection(page, "Risks & Blockers");
    await page.getByRole("button", { name: /\+ Add Risk/i }).click();
    const riskDialog = page.getByRole("dialog", { name: /Add Risk dialog/i });
    await expect(riskDialog).toBeVisible();
    await expectPrefilledStages(riskDialog);
    await riskDialog.getByLabel(/^Risk \*/i).fill(riskText);
    await riskDialog.getByLabel(/^Impact \*/i).fill("Blocks UAT sign-off");
    await riskDialog
      .getByLabel(/^Mitigation \*/i)
      .fill("Escalate and track daily");
    await riskDialog.getByRole("button", { name: /Blocked/i }).click();
    await saveAndWait(page, /Save Risk/i);
    await reloadAndExpect(page, riskText, "Risks & Blockers");
    const savedRiskCard = page
      .getByTestId("risk-card")
      .filter({ hasText: riskText });
    await expect(savedRiskCard.getByText("Blocked")).toBeVisible();
    await expect(savedRiskCard.getByLabel(/Risk stages:/)).toBeVisible();
    await expect(savedRiskCard.getByText("All stages")).toHaveCount(0);

    await expandSection(page, "Decisions");
    await page.getByRole("button", { name: /\+ Add Decision/i }).click();
    const decisionDialog = page.getByRole("dialog", {
      name: /Add Decision dialog/i,
    });
    await expect(decisionDialog).toBeVisible();
    await expectPrefilledStages(decisionDialog);
    await decisionDialog.getByLabel(/^Decision \*/i).fill(decisionText);
    await decisionDialog.getByLabel(/^Impact \*/i).fill("Unblocks MVP UAT");
    await saveAndWait(page, /Save Decision/i);
    await reloadAndExpect(page, decisionText, "Decisions");

    await expandSection(page, "Priorities");
    await page.getByRole("button", { name: /\+ Add Priority/i }).click();
    const priorityDialog = page.getByRole("dialog", {
      name: /Add Priority dialog/i,
    });
    await expect(priorityDialog).toBeVisible();
    await expectPrefilledStages(priorityDialog);
    await priorityDialog.getByLabel(/^Description \*/i).fill(priorityText);
    await saveAndWait(page, /Save Priority/i);
    await reloadAndExpect(page, priorityText, "Priorities");

    expect(saveDraftResponses).toEqual(
      expect.arrayContaining([200, 200, 200, 200]),
    );
  });
});
