/**
 * Revoke downstream effects — integration tests (SC-162 / SC-163 / SC-164 / SC-166).
 *
 * All four scenarios require a live API + E2E_DATABASE_URL (integration suite
 * only). The head's Revoke control lives on the /head/dashboard Period Summary
 * queue (expand a lead's row, click Revoke, confirm) — see
 * e2e/catalog/head.yaml `head-dashboard-revoke-single-submission`. The lead
 * form's own /lead/report/{reportId}?authorId=... combined-UI route no longer
 * serves head/admin sessions: `useLeadFormData`'s
 * `shouldRouteHeadLikeAwayFromLeadForm` unconditionally client-redirects a
 * head-like session to /head/report/{reportId} (or /head/dashboard), so the
 * old drive-the-lead-form-as-head helper only ever hung waiting for a page
 * that never renders the Revoke button.
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

import type { APIResponse, Page } from "@playwright/test";

import { expect,test } from "./fixtures";
import { prisma, resetMutations } from "./helpers/db";
import {
  ACTIVE_REPORT_ID,
  LEAD_MARIA_ID,
  PUBLISHED_REPORT_ID,
  SEED_USERS,
} from "./helpers/seed-ids";

const MARIA_ACTIVE_SECTION_ID = "a0000000-0000-4000-8000-000000004012";
const MARIA_PUBLISHED_SECTION_ID = "a0000000-0000-4000-8000-000000004022";

const mariaSeedUser = SEED_USERS.find((u) => u.id === LEAD_MARIA_ID);
if (!mariaSeedUser) {
  throw new Error(
    "revoke-downstream.integration.spec.ts: LEAD_MARIA_ID not found in SEED_USERS.",
  );
}
// dashboard-lead-priority / lead-summary-table render every lead identity as
// the shortName form ("Surname I.O."), but the surname alone is a stable,
// unambiguous substring for locating Maria's queue row.
const MARIA_SURNAME = mariaSeedUser.lastName;

// ---------------------------------------------------------------------------
// Shared helper: drive the Revoke control via the head dashboard's Period
// Summary queue and confirm the dialog.
// ---------------------------------------------------------------------------

async function revokeLeadViaDashboard(
  headPage: Page,
  leadSurname: string,
): Promise<void> {
  await headPage.goto("/head/dashboard");
  await headPage.waitForSelector("#main-content", {
    state: "visible",
    timeout: 15_000,
  });

  const row = headPage
    .getByTestId("lead-queue-row")
    .filter({ hasText: leadSurname });
  await expect(row).toBeVisible({ timeout: 15_000 });

  // Revoke lives in the row's expandable detail (LeadSecondaryActions).
  await row.getByRole("button", { name: "Details", exact: true }).click();

  const revokeBtn = row.getByTestId("revoke-lead-button");
  await expect(revokeBtn).toBeVisible({ timeout: 10_000 });
  await revokeBtn.click();

  // ConfirmationDialog renders via a body-level portal (outside the row's DOM
  // subtree), so the confirm button is located from the page, not the row.
  // Its accessible name is the literal confirmLabel "Revoke" — the trigger
  // button above carries a longer aria-label ("Revoke {name}'s submission"),
  // so `exact: true` is what keeps these two unambiguous.
  const confirmBtn = headPage.getByRole("button", {
    name: "Revoke",
    exact: true,
  });
  await expect(confirmBtn).toBeVisible({ timeout: 5000 });
  await confirmBtn.click();

  // Wait for the tRPC mutation to complete.
  await headPage.waitForResponse(
    (r) =>
      r.url().includes("/trpc/") &&
      r.request().method() === "POST" &&
      /leadForm\.revoke/i.test(r.url()),
    { timeout: 15_000 },
  );
}

/**
 * Direct tRPC call to `leadForm.revoke`, bypassing the UI entirely.
 *
 * SC-166 targets PUBLISHED_REPORT, a past (closed) period. The dashboard
 * queue — the only surface exposing the Revoke control — always loads
 * `weeklyReport.get({})` (no reportId), which resolves to the CURRENT period
 * only; there is no UI path that can ever render a Revoke control scoped to a
 * past published report's section. To still exercise the actual backend
 * contract (LeadFormService.revokeSubmission), this posts the exact wire
 * shape httpBatchLink + superjson produce for a single mutation (verified
 * against @trpc/client's own `getUrl`/`getBody`, not guessed): a
 * `?batch=1` POST whose body maps the input under key "0" as
 * `{ json: <input> }`. `page.request` shares the head session's cookie via
 * the browser context, and Next.js rewrites `/trpc/*` to the API.
 */
async function revokeSectionDirect(
  headPage: Page,
  reportSectionId: string,
): Promise<APIResponse> {
  return headPage.request.post("/trpc/leadForm.revoke?batch=1", {
    headers: { "content-type": "application/json" },
    data: { "0": { json: { reportSectionId } } },
  });
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

    await revokeLeadViaDashboard(headPage, MARIA_SURNAME);

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

    // The dashboard's Submissions KPI card is a <section> exposed as an
    // ARIA "region" landmark, named "Submissions: X of Y, Z pending" — it
    // reflects the drop without a manual reload since its query was
    // invalidated on revoke success.
    // Denominator = leads with a section in the current period (4 in seed),
    // not the org-wide lead count — pin only the numerator drop here; the
    // exact submitted count is already asserted at the DB level above.
    await expect(
      headPage.getByRole("region", { name: /^Submissions: 3 of \d+,/ }),
    ).toBeVisible({ timeout: 10_000 });
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

    await revokeLeadViaDashboard(headPage, MARIA_SURNAME);

    // weekly-report read model filters status === "submitted" — Maria's
    // revoked section must be absent from the submitted set.
    const afterSections = await prisma.reportSection.findMany({
      where: { reportId: ACTIVE_REPORT_ID, status: "submitted" },
      select: { authorId: true },
    });
    expect(afterSections.map((s) => s.authorId)).not.toContain(LEAD_MARIA_ID);
    expect(afterSections).toHaveLength(3);

    // The queue row itself no longer offers Revoke — canRevoke requires
    // status === "submitted", which the revoked section no longer has.
    const row = headPage
      .getByTestId("lead-queue-row")
      .filter({ hasText: MARIA_SURNAME });
    await expect(row.getByTestId("revoke-lead-button")).toBeHidden({
      timeout: 10_000,
    });
  });

  // -------------------------------------------------------------------------
  // SC-164: Revoke + lead re-edits + re-submits → section reappears
  // -------------------------------------------------------------------------

  test("SC-164: after revoke, lead re-submits and section reappears in aggregation", async ({
    headPage,
  }) => {
    // Step 1: Revoke Maria's section via the head dashboard.
    await revokeLeadViaDashboard(headPage, MARIA_SURNAME);

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

    // Step 4: Head reloads the dashboard; Maria's row is submitted again and
    // Revoke is offered once more (canRevoke recomputes from the fresh read).
    await headPage.goto("/head/dashboard");
    await headPage.waitForSelector("#main-content", {
      state: "visible",
      timeout: 15_000,
    });

    const row = headPage
      .getByTestId("lead-queue-row")
      .filter({ hasText: MARIA_SURNAME });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.getByRole("button", { name: "Details", exact: true }).click();

    await expect(row.getByTestId("revoke-lead-button")).toBeVisible({
      timeout: 10_000,
    });
  });

  // -------------------------------------------------------------------------
  // SC-166: Revoke on a published-period section is rejected
  //
  // The dashboard's UI-level `canRevoke` (dashboard-leads.ts) gates on
  // `periodStatus === "open" || "reopened"`, but only for the CURRENT
  // period — the dashboard never loads a past period's queue, so
  // LeadFormService.revokeSubmission's own periodStatus gate is the only
  // enforcement point for a closed published report. This drives the exact
  // tRPC wire call to pin that the service-layer gate rejects the mutation
  // and the section's submitted state (backing the frozen viewer snapshot)
  // survives.
  // -------------------------------------------------------------------------

  test("SC-166: revoke on published-period section is rejected by the periodStatus gate", async ({
    headPage,
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

    const response = await revokeSectionDirect(
      headPage,
      MARIA_PUBLISHED_SECTION_ID,
    );
    const payload: unknown = await response.json();

    // LeadFormConstraintError maps to BAD_REQUEST on the wire.
    expect(response.status()).toBe(400);
    expect(payload).toMatchObject([
      {
        error: {
          json: {
            message: "Cannot revoke a submission in a published report.",
            data: { code: "BAD_REQUEST", httpStatus: 400 },
          },
        },
      },
    ]);

    // The section never leaves submitted — poll briefly to catch a delayed
    // write rather than sampling a single instant.
    await expect
      .poll(
        async () =>
          (
            await prisma.reportSection.findUnique({
              where: { id: MARIA_PUBLISHED_SECTION_ID },
            })
          )?.status,
        { timeout: 5000 },
      )
      .toBe("submitted");
  });
});
