/**
 * PDF export integration smoke tests.
 *
 * Product-ready gate: this suite is mandatory. The integration environment
 * must provide Redis/BullMQ and the API worker must be able to render the
 * Next.js print route through PDF_BASE_URL.
 */

import { expect, test } from "./fixtures";
import { prisma } from "./helpers/db";
import { HEAD_USER_ID, PUBLISHED_REPORT_ID } from "./helpers/seed-ids";
import { performAndWaitForTrpcMutation } from "./helpers/trpc-response";

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
  test.setTimeout(120_000);
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
    await performAndWaitForTrpcMutation(
      headPage,
      () => exportBtn.first().click(),
      { procedure: /pdf|export/i },
    );

    await expect
      .poll(async () => (await newestUnseenPdfJob(existingIds))?.id ?? null, {
        timeout: 15_000,
      })
      .not.toBeNull();
  });

  test("PDF worker completes job and stores a readable artifact", async ({
    headPage,
  }) => {
    const existingIds = await existingPdfJobIds();

    await headPage.goto(`/head/report/${PUBLISHED_REPORT_ID}`);

    const exportBtn = headPage.getByRole("button", { name: /export.*pdf/i });
    await expect(exportBtn).toBeVisible({ timeout: 15_000 });
    await exportBtn.first().click();

    // Poll for the id, then read it back once. Assigning into a binding from
    // inside the poll callback narrows it to `null` for the rest of the test,
    // so every later use needed a `?? ""` that could only ever look up nothing.
    const newJobId = async (): Promise<string | null> =>
      (await newestUnseenPdfJob(existingIds))?.id ?? null;

    await expect.poll(newJobId, { timeout: 15_000 }).not.toBeNull();

    const jobId = await newJobId();
    if (!jobId) throw new Error("no new pdfExportJob row after the export");

    await expect
      .poll(
        async () =>
          (await prisma.pdfExportJob.findUnique({ where: { id: jobId } }))
            ?.status ?? null,
        { timeout: 60_000 },
      )
      .toBe("completed");

    const job = await prisma.pdfExportJob.findUnique({ where: { id: jobId } });
    expect(job?.filePath).toMatch(/^\/pdfs\/.+\.pdf$/);
    expect(job?.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(job?.requestedBy).toBe(HEAD_USER_ID);

    const artifactUrl = job?.filePath;
    if (!artifactUrl) throw new Error("completed PDF job has no artifact URL");
    const response = await headPage
      .context()
      .request.get(new URL(artifactUrl, headPage.url()).toString());
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    const pdf = await response.body();
    expect(pdf.byteLength).toBeGreaterThan(0);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
