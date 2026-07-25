import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
} from "../../test-utils/prisma-test-helper";
import {
  buildUserSession,
  type ProvisionLeadWorkspace,
  type SamlProfile,
} from "./user-session";

/**
 * Regression pin for `buildUserSession`'s `existingSection` lookup.
 *
 * Nothing at the DB layer enforces "only one report is ever `draft`" — it is
 * an application-level assumption. This scenario builds exactly the case
 * where it's violated: two draft reports for the same author, with the
 * OLDER report's section inserted BEFORE the NEWER report's section, so
 * physical/insertion order and `createdAt` order disagree. Without the
 * explicit `orderBy: { report: { createdAt: "desc" } }` the pick followed
 * insertion order and bound the session to the stale report's section.
 */
describe("existingSection lookup — draft-report ordering", () => {
  const prisma = createTestPrisma();
  const failIfProvisioned: ProvisionLeadWorkspace = () => {
    throw new Error(
      "provisionLeadWorkspace must not be called — the author already has a section",
    );
  };

  const IDS = {
    group: "d0000000-0000-4000-a000-000000000010",
    lead: "d0000000-0000-4000-a000-000000000011",
    reportOld: "d0000000-0000-4000-a000-000000000020",
    reportNew: "d0000000-0000-4000-a000-000000000021",
    sectionOld: "d0000000-0000-4000-a000-000000000030",
    sectionNew: "d0000000-0000-4000-a000-000000000031",
  } as const;

  beforeEach(async () => {
    await cleanDatabase(prisma);

    await prisma.reportingGroup.create({
      data: { id: IDS.group, name: "Group" },
    });
    await prisma.user.create({
      data: {
        id: IDS.lead,
        email: "lead-order@t.local",
        name: "Lead Order",
        lastName: "Order",
        firstName: "Lead",
        role: "lead",
        samlId: "lead-order",
        reportingGroupId: IDS.group,
      },
    });
    await prisma.report.create({
      data: {
        id: IDS.reportOld,
        periodStart: new Date("2026-06-01"),
        periodEnd: new Date("2026-06-07"),
        deadline: new Date("2026-06-05"),
        status: "draft",
        createdAt: new Date("2026-06-01T00:00:00Z"),
      },
    });
    await prisma.report.create({
      data: {
        id: IDS.reportNew,
        periodStart: new Date("2026-06-08"),
        periodEnd: new Date("2026-06-14"),
        deadline: new Date("2026-06-12"),
        status: "draft",
        createdAt: new Date("2026-06-08T00:00:00Z"),
      },
    });
    // Insertion order matches createdAt order (old report's section written
    // first, new report's second) — the adversarial case for a plain
    // `findFirst` with no `orderBy`, which returns rows in that insertion
    // order rather than by report recency.
    await prisma.reportSection.create({
      data: {
        id: IDS.sectionOld,
        reportId: IDS.reportOld,
        authorId: IDS.lead,
        status: "draft",
      },
    });
    await prisma.reportSection.create({
      data: {
        id: IDS.sectionNew,
        reportId: IDS.reportNew,
        authorId: IDS.lead,
        status: "draft",
      },
    });
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await disconnectTestPrisma();
  });

  // Ordered pick must match report-only fallback: most recently created draft.
  it("buildUserSession resolves the NEWER draft report's section deterministically", async () => {
    const profile: SamlProfile = {
      samlId: "lead-order",
      email: "lead-order@t.local",
      displayName: "Lead Order",
      role: "lead",
    };

    const session = await buildUserSession(prisma, profile, failIfProvisioned);

    expect(session.activeReportId).toBe(IDS.reportNew);
    expect(session.activeReportSectionId).toBe(IDS.sectionNew);
  });
});
