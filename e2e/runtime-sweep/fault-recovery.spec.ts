import { expect, type Page, test } from "@playwright/test";

import { ACTIVE_REPORT_ID } from "../../prisma/seed-constants.ts";
import { prisma, resetMutations } from "../integration/helpers/db.ts";
import { loginByCookie } from "../sweep/helpers/dev-auth.ts";
import { seedProfileSchema } from "./contracts.ts";
import { type FaultDeclaration, withFault } from "./fault-injection.ts";

const PROFILE = seedProfileSchema.parse(
  process.env.RUNTIME_SWEEP_PROFILE ?? process.env.E2E_SEED_PROFILE ?? "full",
);
const PUBLISH_TIMEOUT: FaultDeclaration = {
  id: "publish-network-timeout",
  mode: "network-timeout",
  urlPattern: /\/trpc\/period\.publish/,
  operation: "period.publish",
  expectation: {
    userVisibleMessage: "Failed to publish period",
    statusRole: "alert",
    recovery: "retry",
    persistedState: "unchanged",
  },
  response: null,
  abortCode: "timedout",
};

const reportState = () =>
  prisma.report.findUniqueOrThrow({
    where: { id: ACTIVE_REPORT_ID },
    select: {
      status: true,
      periodState: true,
      periodStatus: true,
      publishedAt: true,
      publishedById: true,
    },
  });

async function attemptPublish(page: Page): Promise<void> {
  const publish = page.getByRole("button", { name: /publish.*lock/i });
  await expect(publish).toBeVisible({ timeout: 15_000 });
  const failedRequest = page.waitForEvent("requestfailed", {
    predicate: (request) => request.url().includes("/trpc/period.publish"),
  });
  await publish.click();
  const confirm = page
    .getByRole("button", { name: /^(publish|confirm|yes)/i })
    .last();
  await expect(confirm).toBeVisible();
  await confirm.click();
  await failedRequest;
}

if (PROFILE === "full")
  test.describe("runtime controlled fault recovery", () => {
    test.afterEach(async () => {
      await resetMutations();
    });

    test("publish timeout is visible, recoverable, and non-mutating", async ({
      page,
    }, testInfo) => {
      await loginByCookie(page, { role: "head" });
      await page.goto(`/head/report/${ACTIVE_REPORT_ID}`);
      const before = await reportState();

      await withFault(page, PUBLISH_TIMEOUT, () => attemptPublish(page));
      expect(await reportState()).toEqual(before);
      await expect(page.getByText(/Failed to publish period/i)).toBeVisible();

      await page.reload();
      await expect(
        page.getByRole("button", { name: /publish.*lock/i }),
      ).toBeVisible();
      await testInfo.attach("publish-timeout-recovery.png", {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
    });
  });
