import type { UserSession } from "@customreport/shared";
import { beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../prisma/prisma.service";
import { clearOrgCache, hydrateSession } from "./trpc.session-hydration";

const USER_ID = "a0000000-0000-4000-8000-000000000101";
const REPORT_ID = "a0000000-0000-4000-8000-000000000201";
const SECTION_ID = "a0000000-0000-4000-8000-000000000301";
const GROUP_ID = "a0000000-0000-4000-8000-000000000401";
const VIEWER_GROUP_ID = "a0000000-0000-4000-8000-000000000501";

function makePrisma(): PrismaService {
  const stub = {
    reportSection: {
      findFirst: () => Promise.resolve({ id: SECTION_ID }),
    },
    viewerGroupAccess: {
      findMany: () => Promise.resolve([{ groupId: VIEWER_GROUP_ID }]),
    },
    reportingGroup: {
      findUnique: () => Promise.resolve({ name: "Software Development" }),
    },
    organization: {
      upsert: () =>
        Promise.resolve({ shortName: "Demo", fullName: "Product Team" }),
    },
  };
  return stub as unknown as PrismaService;
}

describe("hydrateSession", () => {
  beforeEach(() => {
    clearOrgCache();
  });

  it("returns hydrated fields without mutating the caller-owned session", async () => {
    const session: UserSession = {
      userId: USER_ID,
      email: "viewer@test.local",
      name: "Viewer One",
      role: "viewer",
      activeReportId: REPORT_ID,
      activeReportSectionId: null,
      reportingGroupId: GROUP_ID,
    };
    const originalSession = { ...session };

    const result = await hydrateSession(session, makePrisma());

    expect(result).not.toBe(session);
    expect(session).toEqual(originalSession);
    expect(result).toEqual({
      ...originalSession,
      activeReportSectionId: SECTION_ID,
      viewerGroupAccess: [VIEWER_GROUP_ID],
      reportingGroupName: "Software Development",
      organization: { shortName: "Demo", fullName: "Product Team" },
    });
  });
});
