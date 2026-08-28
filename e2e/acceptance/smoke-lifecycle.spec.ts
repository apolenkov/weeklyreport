import { weeklyReportGetResponseSchema } from "@customreport/shared";
import { expect, test } from "@playwright/test";

import { decodeTrpcBatchPayload } from "../../apps/web/src/shared/server/transport/api-url";
import { ACTIVE_REPORT_ID, SEED_EMAILS } from "../integration/helpers/seed-ids";
import { performAndWaitForTrpcMutation } from "../integration/helpers/trpc-response";
import { loginByCookie } from "../sweep/helpers/dev-auth";

test("lead write -> head publish -> viewer read, with admin landing", async ({
  page,
}) => {
  const updatedText = `Acceptance smoke ${Date.now()}`;

  await loginByCookie(page, {
    role: "lead",
    email: SEED_EMAILS.olga,
  });
  await page.goto("/lead/report");

  const editItem = page.getByRole("button", { name: /^Edit$/u }).first();
  await expect(editItem).toBeVisible({ timeout: 15_000 });
  await editItem.click();

  const editDialog = page.getByRole("dialog", {
    name: /^Edit Item dialog$/u,
  });
  await expect(editDialog).toBeVisible();
  await editDialog
    .getByRole("textbox", { name: /^Description \*$/u })
    .fill(updatedText);
  await performAndWaitForTrpcMutation(
    page,
    () => editDialog.getByRole("button", { name: /^Save Item$/u }).click(),
    { procedure: "reports.saveDraft" },
  );
  await expect(editDialog).toBeHidden();
  await expect(page.getByText(updatedText, { exact: true })).toBeVisible();

  const submit = page.getByRole("button", {
    name: "Submit",
    exact: true,
  });
  await expect(submit).toBeVisible();
  await submit.click();
  const submitDialog = page.getByRole("alertdialog", {
    name: "Confirm submission",
  });
  await performAndWaitForTrpcMutation(
    page,
    () =>
      submitDialog.getByRole("button", { name: "Submit", exact: true }).click(),
    { procedure: /submit/iu },
  );
  await expect(submit).toHaveCount(0);

  await loginByCookie(page, { role: "head" });
  await page.goto(`/head/report/${ACTIVE_REPORT_ID}`);
  const publish = page.getByRole("button", { name: /publish.*lock/iu });
  await expect(publish).toBeVisible({ timeout: 15_000 });
  await performAndWaitForTrpcMutation(
    page,
    async () => {
      await publish.click();
      const confirm = page.getByRole("button", {
        name: /^(publish|confirm|yes)/iu,
      });
      await expect(confirm.last()).toBeVisible();
      await confirm.last().click();
    },
    { procedure: /publish/iu },
  );

  await loginByCookie(page, { role: "admin" });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin Panel" })).toBeVisible({
    timeout: 15_000,
  });

  await loginByCookie(page, { role: "viewer" });
  await page.goto(`/reports/${ACTIVE_REPORT_ID}`);
  await expect(
    page.getByRole("heading", { name: "Status Report" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("body")).toContainText(updatedText, {
    timeout: 15_000,
  });

  const input = encodeURIComponent(
    JSON.stringify({ "0": { json: { reportId: ACTIVE_REPORT_ID } } }),
  );
  const response = await page.request.get(
    `/trpc/weeklyReport.get?batch=1&input=${input}`,
  );
  expect(response.ok()).toBe(true);
  const readBack = weeklyReportGetResponseSchema.parse(
    decodeTrpcBatchPayload(await response.json()),
  );
  expect(readBack).toMatchObject({
    periodStatus: "published",
    reportId: ACTIVE_REPORT_ID,
    status: "active",
  });
  expect(JSON.stringify(readBack)).toContain(updatedText);
});
