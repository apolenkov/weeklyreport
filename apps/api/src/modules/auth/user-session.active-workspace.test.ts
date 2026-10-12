import { isDeepStrictEqual } from "node:util";

import type { PrismaClient, Role } from "@prisma/client";
import { sessionRoleSchema } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import {
  buildUserSession,
  type ProvisionLeadWorkspace,
  type SamlProfile,
} from "./user-session";

const LIVE_REPORT_PREDICATE = {
  status: "draft",
  archived: false,
  periodStatus: "open",
  periodState: { in: ["scheduled", "open"] },
  autoPublished: false,
  autoArchived: false,
  publishedAt: null,
  publishedById: null,
  reopenedAt: null,
};

const USER_ID = "user-active-workspace";
const LIVE_REPORT_ID = "report-live";
const LIVE_SECTION_ID = "section-live";

type InvalidCandidate = "archived" | "contradictory";

function invalidReportId(candidate: InvalidCandidate): string {
  return candidate === "archived"
    ? "report-newer-archived-draft"
    : "report-newer-contradictory-draft";
}

function activeWorkspacePrisma(role: Role, candidate: InvalidCandidate) {
  const user = {
    id: USER_ID,
    email: `${role}@customreport.local`,
    name: `${role} user`,
    lastName: role,
    firstName: "User",
    middleName: null,
    role,
    samlId: `${role}-saml`,
    reportingGroupId: null,
  };
  const invalidId = invalidReportId(candidate);
  const reportSectionFindFirst = vi.fn(
    (args: { where: { report: unknown } }) => {
      if (role !== "lead") return Promise.resolve(null);
      return Promise.resolve(
        isDeepStrictEqual(args.where.report, LIVE_REPORT_PREDICATE)
          ? { id: LIVE_SECTION_ID, reportId: LIVE_REPORT_ID }
          : { id: `section-${invalidId}`, reportId: invalidId },
      );
    },
  );
  const reportFindFirst = vi.fn((args: { where: unknown }) =>
    Promise.resolve(
      isDeepStrictEqual(args.where, LIVE_REPORT_PREDICATE)
        ? { id: LIVE_REPORT_ID }
        : { id: invalidId },
    ),
  );
  const prisma = {
    $queryRaw: vi.fn(() => Promise.resolve([{ id: user.id }])),
    user: {
      findFirst: vi.fn(() => Promise.resolve(null)),
      findUnique: vi.fn(() => Promise.resolve(user)),
      create: vi.fn(),
      update: vi.fn(),
    },
    reportSection: { findFirst: reportSectionFindFirst },
    report: { findFirst: reportFindFirst },
    reportingGroup: { findUnique: vi.fn(() => Promise.resolve(null)) },
  } as unknown as PrismaClient;

  return { prisma, reportFindFirst, reportSectionFindFirst };
}

const failIfProvisioned: ProvisionLeadWorkspace = vi.fn(() => {
  throw new Error("A valid lead section must not trigger provisioning.");
});

describe("buildUserSession active workspace lifecycle filter", () => {
  it.each(
    sessionRoleSchema.options.flatMap((role) =>
      (["archived", "contradictory"] as const).map((candidate) => ({
        role,
        candidate,
      })),
    ),
  )(
    "keeps $role on the live workspace when a newer $candidate draft exists",
    async ({ role, candidate }) => {
      const { prisma, reportFindFirst, reportSectionFindFirst } =
        activeWorkspacePrisma(role, candidate);
      const profile: SamlProfile = {
        samlId: `${role}-saml`,
        email: `${role}@customreport.local`,
        displayName: `${role} user`,
        role,
      };

      const session = await buildUserSession(
        prisma,
        profile,
        failIfProvisioned,
      );

      expect(reportSectionFindFirst.mock.calls[0]?.[0]).toMatchObject({
        where: { authorId: USER_ID, report: LIVE_REPORT_PREDICATE },
        orderBy: { report: { createdAt: "desc" } },
      });
      expect(session.activeReportId).toBe(LIVE_REPORT_ID);

      if (role === "lead") {
        expect(session.activeReportSectionId).toBe(LIVE_SECTION_ID);
        expect(reportFindFirst).not.toHaveBeenCalled();
      } else {
        expect(session.activeReportSectionId).toBeNull();
        expect(reportFindFirst.mock.calls[0]?.[0]).toMatchObject({
          where: LIVE_REPORT_PREDICATE,
          orderBy: { createdAt: "desc" },
        });
      }
    },
  );
});
