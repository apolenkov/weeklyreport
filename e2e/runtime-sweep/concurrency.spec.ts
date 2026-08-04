import { expect, type Page, test, type TestInfo } from "@playwright/test";

import { ACTIVE_REPORT_ID } from "../../prisma/seed-constants.ts";
import { prisma, resetMutations } from "../integration/helpers/db.ts";
import { loginByCookie } from "../sweep/helpers/dev-auth.ts";
import { seedProfileSchema } from "./contracts.ts";

const PROFILE = seedProfileSchema.parse(
  process.env.RUNTIME_SWEEP_PROFILE ?? process.env.E2E_SEED_PROFILE ?? "full",
);

function baseUrlOf(testInfo: TestInfo): string {
  const value = testInfo.project.use.baseURL;
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Concurrency cell requires the Playwright project baseURL");
  }
  return value;
}

async function openPublishConfirmation(page: Page): Promise<Page> {
  await loginByCookie(page, { role: "head" });
  await page.getByRole("link", { name: "Status", exact: true }).click();
  await page.waitForURL((url) => url.pathname.startsWith("/head/report"));
  const publish = page.getByRole("button", { name: /publish.*lock/i });
  await expect(publish).toBeVisible({ timeout: 15_000 });
  await publish.click();
  const confirm = page
    .getByRole("button", { name: /^(publish|confirm|yes)/i })
    .last();
  await expect(confirm).toBeVisible();
  return page;
}

const publishResponse = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/trpc/period.publish"),
    { timeout: 15_000 },
  );

if (PROFILE === "full")
  test.describe("runtime two-context concurrency", () => {
    test.afterEach(async () => {
      await resetMutations();
    });

    test("two head contexts converge after concurrent publish", async ({
      browser,
    }, testInfo) => {
      const options = { baseURL: baseUrlOf(testInfo) };
      const first = await browser.newPage(options);
      const second = await browser.newPage(options);
      try {
        await Promise.all([
          openPublishConfirmation(first),
          openPublishConfirmation(second),
        ]);
        const firstResponse = publishResponse(first);
        const secondResponse = publishResponse(second);
        const confirmations = [first, second].map((page) =>
          page
            .getByRole("button", { name: /^(publish|confirm|yes)/i })
            .last()
            .click(),
        );
        const [left, right] = await Promise.all([
          firstResponse,
          secondResponse,
          ...confirmations,
        ]);
        expect(
          [left.status(), right.status()].every((status) => status < 500),
        ).toBe(true);

        const report = await prisma.report.findUniqueOrThrow({
          where: { id: ACTIVE_REPORT_ID },
        });
        expect(report.status).toBe("published");
        expect(report.periodState).toBe("published");
        expect(report.periodStatus).toBe("published");
        expect(report.publishedAt).not.toBeNull();

        await Promise.all([first.reload(), second.reload()]);
        await expect(
          first.getByRole("button", { name: /publish.*lock/i }),
        ).toHaveCount(0);
        await expect(
          second.getByRole("button", { name: /publish.*lock/i }),
        ).toHaveCount(0);
        await testInfo.attach("concurrent-publish.json", {
          body: JSON.stringify({
            responseStatuses: [left.status(), right.status()],
            report: {
              status: report.status,
              periodState: report.periodState,
              periodStatus: report.periodStatus,
            },
          }),
          contentType: "application/json",
        });
      } finally {
        await Promise.all([first.close(), second.close()]);
      }
    });
  });
