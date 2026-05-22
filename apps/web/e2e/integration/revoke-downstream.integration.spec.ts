/**
 * Revoke downstream effects — integration tests (SC-162 / SC-163 / SC-164 / SC-166).
 *
 * All four scenarios require a live API + E2E_DATABASE_URL (integration suite
 * only). The tests drive the Revoke button via the head UI where practical and
 * fall back to direct Prisma mutations for the lead re-submit path.
 *
 * Seed preconditions (advanced seed):
 *   ACTIVE_REPORT  = a0000000-0000-4000-8000-000000000001  (periodStatus: open)
 *   PUBLISHED_REPORT = a0000000-0000-4000-8000-000000000002 (periodStatus: published)
 *   LEAD_MARIA (index 2) — status: submitted in ACTIVE_REPORT
 *   LEAD_1 / Vasily (index 1) — status: submitted in ACTIVE_REPORT
 *   Seed baseline: 4 submitted / 6 total
 *
 * Section ID formula: a0000000-0000-4000-8000-0000000040{reportSuffix}{leadIndex}
 *   MARIA in active report  → a0000000-0000-4000-8000-000000004012
 *   VASILY in active report → a0000000-0000-4000-8000-000000004011
 *   MARIA in published report → a0000000-0000-4000-8000-000000004022
 */

import { test, expect, loginAs } from "./fixtures";
import { prisma, resetMutations } from "./helpers/db";
import {
  ACTIVE_REPORT_ID,
  PUBLISHED_REPORT_ID,
  LEAD_MARIA_ID,
} from "./helpers/seed-ids";

const MARIA_ACTIVE_SECTION_ID = "a0000000-0000-4000-8000-000000004012";
const MARIA_PUBLISHED_SECTION_ID = "a0000000-0000-4000-8000-000000004022";

// ---------------------------------------------------------------------------
// Shared helper: drive the Revoke button via head UI and confirm the dialog
// ---------------------------------------------------------------------------

async function revokeViaCombinedUi(
  headPage: import("@playwright/test").Page,
  reportId: string,
  authorId: string,
): Promise<void> {
  await headPage.goto(
    `/lead/report/${reportId}?authorId=${authorId}`,
  );
  await headPage.waitForSelector("#main-content", {
    state: "visible",
    timeout: 15_000,
  });
  await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

  const revokeBtn = headPage.getByRole("button", { name: "Revoke" });
  await expect(revokeBtn).toBeVisible({ timeout: 10_000 });
  await revokeBtn.click();

  // ConfirmDeleteDialog renders with confirmLabel="Revoke"
  const confirmBtn = headPage.getByRole("button", { name: "Revoke" }).last();
  await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
  await confirmBtn.click();

  // Wait for tRPC mutation to complete
  await headPage.waitForResponse(
    (r) =>
      r.url().includes("/trpc/") &&
      r.request().method() === "POST" &&
      /leadForm\.revoke/i.test(r.url()),
    { timeout: 15_000 },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Revoke downstream effects (integration)", () => {
  test.afterEach(async () => {
    await resetMutations();
  });

  // -------------------------------------------------------------------------
  // SC-162: After revoke, KPI submissions count decreases
  // -------------------------------------------------------------------------

  test("SC-162: after revoke, submissionCount drops from 4 to 3", async ({
    headPage,
  }) => {
    // Verify seed precondition.
    const beforeCount = await prisma.reportSection.count({
      where: { reportId: ACTIVE_REPORT_ID, status: "submitted" },
    });
    expect(beforeCount).toBe(4);

    await revokeViaCombinedUi(headPage, ACTIVE_REPORT_ID, LEAD_MARIA_ID);

    // DB truth: Maria's section must now be draft.
    const section = await prisma.reportSection.findUnique({
      where: { id: MARIA_ACTIVE_SECTION_ID },
    });
    expect(section?.status).toBe("draft");
    expect(section?.revokedAt).not.toBeNull();
    expect(section?.submittedAt).toBeNull();

    // Aggregation: submissionCount via the weekly-report Prisma filter
    // (status === "submitted") drops by 1 automatically.
    const afterCount = await prisma.reportSection.count({
      where: { reportId: ACTIVE_REPORT_ID, status: "submitted" },
    });
    expect(afterCount).toBe(3);
  });

  // -------------------------------------------------------------------------
  // SC-163: After revoke, Weekly Report omits the revoked lead's section
  // -------------------------------------------------------------------------

  test("SC-163: after revoke, Maria's section absent from weekly report query", async ({
    headPage,
  }) => {
    // Seed baseline: 4 sections with status submitted for the active report.
    const beforeSections = await prisma.reportSection.findMany({
      where: { reportId: ACTIVE_REPORT_ID, status: "submitted" },
      select: { authorId: true },
    });
    expect(beforeSections.map((s) => s.authorId)).toContain(LEAD_MARIA_ID);

    await revokeViaCombinedUi(headPage, ACTIVE_REPORT_ID, LEAD_MARIA_ID);

    // weekly-report.prisma-repository filters status === "submitted" —
    // Maria's revoked section must be absent from submitted set.
    const afterSections = await prisma.reportSection.findMany({
      where: { reportId: ACTIVE_REPORT_ID, status: "submitted" },
      select: { authorId: true },
    });
    expect(afterSections.map((s) => s.authorId)).not.toContain(LEAD_MARIA_ID);
    expect(afterSections.length).toBe(3);
  });

  // -------------------------------------------------------------------------
  // SC-164: Revoke + lead re-edits + re-submits → section reappears
  // -------------------------------------------------------------------------

  test("SC-164: after revoke, lead re-submits and section reappears in aggregation", async ({
    browser,
    headPage,
  }) => {
    // Step 1: Revoke Maria's section via head UI.
    await revokeViaCombinedUi(headPage, ACTIVE_REPORT_ID, LEAD_MARIA_ID);

    const afterRevoke = await prisma.reportSection.findUnique({
      where: { id: MARIA_ACTIVE_SECTION_ID },
    });
    expect(afterRevoke?.status).toBe("draft");

    // Step 2: Maria re-submits. Use direct DB update (same pattern as
    // cross-role-lifecycle spec — UI submit is covered by lead-journey spec).
    await prisma.reportSection.update({
      where: { id: MARIA_ACTIVE_SECTION_ID },
      data: {
        status: "submitted",
        submittedAt: new Date(),
        revokedAt: null,
        revokedBy: null,
      },
    });

    // Step 3: Section reappears in submitted set — weekly-report picks it up.
    const afterResubmit = await prisma.reportSection.count({
      where: { reportId: ACTIVE_REPORT_ID, status: "submitted" },
    });
    expect(afterResubmit).toBe(4);

    // Step 4: Head can see Maria's form is back to submitted via the UI.
    const headCtx = browser.contexts()[0];
    if (!headCtx) return;
    const freshHeadPage = await headCtx.newPage();
    await freshHeadPage.goto(
      `/lead/report/${ACTIVE_REPORT_ID}?authorId=${LEAD_MARIA_ID}`,
    );
    await freshHeadPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await freshHeadPage.waitForLoadState("networkidle", { timeout: 15_000 });

    // After re-submit the Revoke button should be visible again (section is
    // submitted) and the section is editable by the lead.
    await expect(
      freshHeadPage.getByRole("button", { name: "Revoke" }),
    ).toBeVisible({ timeout: 10_000 });
    await freshHeadPage.close();
  });

  // -------------------------------------------------------------------------
  // SC-166: Revoke during Published period
  //
  // BACKEND GAP: LeadFormService.revokeSubmission checks only
  //   `section.status !== "submitted"` — there is no periodStatus guard.
  // A section in a published period has status="submitted", so the revoke
  // call SUCCEEDS at the API level. This test asserts the current (missing-
  // guard) behavior. When a guard is added, flip the expectation to:
  //   expect(section?.status).toBe("submitted")  // unchanged
  // and assert the tRPC call throws TRPCClientError / CONFLICT.
  // -------------------------------------------------------------------------

  test("SC-166: revoke on published-period section succeeds (no backend periodStatus guard)", async ({
    browser,
  }) => {
    // Verify seed precondition: published report exists with Maria's section
    // in submitted state.
    const publishedReport = await prisma.report.findUnique({
      where: { id: PUBLISHED_REPORT_ID },
    });
    expect(publishedReport?.periodStatus).toBe("published");

    const mariaPublishedSection = await prisma.reportSection.findUnique({
      where: { id: MARIA_PUBLISHED_SECTION_ID },
    });
    expect(mariaPublishedSection?.status).toBe("submitted");

    // Drive head UI on the published-period Maria section.
    const headCtx = await browser.newContext();
    const headPage = await headCtx.newPage();
    await loginAs(headCtx, { role: "head" });

    await headPage.goto(
      `/lead/report/${PUBLISHED_REPORT_ID}?authorId=${LEAD_MARIA_ID}`,
    );
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });
    await headPage.waitForLoadState("networkidle", { timeout: 15_000 });

    const revokeBtn = headPage.getByRole("button", { name: "Revoke" });
    const revokeVisible = await revokeBtn.isVisible().catch(() => false);

    if (revokeVisible) {
      // UI does not block — proceed to confirm.
      await revokeBtn.click();
      const confirmBtn = headPage.getByRole("button", { name: "Revoke" }).last();
      await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
      await confirmBtn.click();

      await headPage.waitForResponse(
        (r) =>
          r.url().includes("/trpc/") &&
          r.request().method() === "POST" &&
          /leadForm\.revoke/i.test(r.url()),
        { timeout: 15_000 },
      );

      // BACKEND GAP: no periodStatus guard → revoke succeeds, section becomes draft.
      await expect
        .poll(
          async () =>
            (
              await prisma.reportSection.findUnique({
                where: { id: MARIA_PUBLISHED_SECTION_ID },
              })
            )?.status,
          { timeout: 10_000 },
        )
        .toBe("draft");
    } else {
      // If the UI hides Revoke on a published period (UI-level guard added),
      // assert the section remains submitted — the backend is not reached.
      const section = await prisma.reportSection.findUnique({
        where: { id: MARIA_PUBLISHED_SECTION_ID },
      });
      expect(section?.status).toBe("submitted");
    }

    await headCtx.close();
  });
});
