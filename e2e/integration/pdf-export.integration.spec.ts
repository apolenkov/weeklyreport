/**
 * PDF export integration smoke tests.
 *
 * Product-ready gate: this suite is mandatory. The integration environment
 * must provide Redis/BullMQ and the API worker must be able to render the
 * Next.js print route through PDF_BASE_URL.
 */

import { test, expect } from "./fixtures";
import { prisma } from "./helpers/db";
import { PUBLISHED_REPORT_ID } from "./helpers/seed-ids";

async function existingPdfJobIds(): Promise<string[]> {
  const jobs = await prisma.pdfExportJob.findMany({
    where: { reportId: PUBLISHED_REPORT_ID },
    select: { id: true },
  });
  return jobs.map((job) => job.id);
}

async function newestUnseenPdfJob(existingIds: readonly string[]) {
  return prisma.pdfExportJob.findFirst({
    where: {
      reportId: PUBLISHED_REPORT_ID,
      ...(existingIds.length > 0 ? { id: { notIn: [...existingIds] } } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

test.describe("PDF export (integration)", () => {
  test("clicking Export PDF on a published report enqueues a job", async ({
    headPage,
  }) => {
    // Verify seed precondition: published report exists.
    const report = await prisma.report.findUnique({
      where: { id: PUBLISHED_REPORT_ID },
    });
    expect(report?.status).toBe("published");

    const existingIds = await existingPdfJobIds();

    await headPage.goto(`/head/report/${PUBLISHED_REPORT_ID}`);

    const exportBtn = headPage.getByRole("button", { name: /export.*pdf/i });
    await expect(exportBtn).toBeVisible({ timeout: 15_000 });
    await exportBtn.first().click();

    await headPage.waitForResponse(
      (r) =>
        r.url().includes("/trpc/") &&
        r.request().method() === "POST" &&
        /pdf|export/i.test(r.url()),
      { timeout: 15_000 },
    );

    await expect
      .poll(async () => (await newestUnseenPdfJob(existingIds))?.id ?? null, {
        timeout: 15_000,
      })
      .not.toBeNull();
  });

  test("PDF worker completes job and stores artifact URL", async ({
    headPage,
  }) => {
    const existingIds = await existingPdfJobIds();

    await headPage.goto(`/head/report/${PUBLISHED_REPORT_ID}`);

    const exportBtn = headPage.getByRole("button", { name: /export.*pdf/i });
    await expect(exportBtn).toBeVisible({ timeout: 15_000 });
    await exportBtn.first().click();

    let jobId: string | null = null;
    await expect
      .poll(
        async () => {
          jobId = (await newestUnseenPdfJob(existingIds))?.id ?? null;
          return jobId;
        },
        { timeout: 15_000 },
      )
      .not.toBeNull();

    expect(jobId).toBeTruthy();

    await expect
      .poll(
        async () =>
          (
            await prisma.pdfExportJob.findUnique({
              where: { id: jobId ?? "" },
            })
          )?.status ?? null,
        { timeout: 60_000 },
      )
      .toBe("completed");

    const job = await prisma.pdfExportJob.findUnique({
      where: { id: jobId ?? "" },
    });
    expect(job?.filePath).toMatch(/^\/pdfs\/.+\.pdf$/);
  });
});
