import type { UserSession } from "@customreport/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma/prisma.service";
import { clearOrgCache, hydrateSession } from "./trpc.session-hydration";

const USER_ID = "a0000000-0000-4000-8000-000000000101";
const REPORT_ID = "a0000000-0000-4000-8000-000000000201";
const SECTION_ID = "a0000000-0000-4000-8000-000000000301";
const GROUP_ID = "a0000000-0000-4000-8000-000000000401";
const VIEWER_GROUP_ID = "a0000000-0000-4000-8000-000000000501";

interface OrgStub {
  findUnique?: ReturnType<typeof vi.fn>;
  upsert?: ReturnType<typeof vi.fn>;
}

function makePrisma(org: OrgStub = {}): PrismaService {
  const stub = {
    reportSection: {
      findFirst: () => Promise.resolve({ id: SECTION_ID }),
    },
    viewerGroupAccess: {
      findMany: () => Promise.resolve([{ groupId: VIEWER_GROUP_ID }]),
    },
    reportingGroup: {
      findUnique: () => Promise.resolve({ name: "Core Development" }),
    },
    organization: {
      findUnique:
        org.findUnique ??
        vi
          .fn()
          .mockResolvedValue({ shortName: "PEO", fullName: "Product Team" }),
      upsert: org.upsert ?? vi.fn(),
    },
  };
  return stub as unknown as PrismaService;
}

function viewerSession(): UserSession {
  return {
    userId: USER_ID,
    email: "viewer@test.local",
    name: "Viewer One",
    role: "viewer",
    activeReportId: REPORT_ID,
    activeReportSectionId: null,
    reportingGroupId: GROUP_ID,
  };
}

describe("hydrateSession", () => {
  beforeEach(() => {
    clearOrgCache();
  });

  it("returns hydrated fields without mutating the caller-owned session", async () => {
    const session = viewerSession();
    const originalSession = { ...session };

    const result = await hydrateSession(session, makePrisma());

    expect(result).not.toBe(session);
    expect(session).toEqual(originalSession);
    expect(result).toEqual({
      ...originalSession,
      activeReportSectionId: SECTION_ID,
      viewerGroupAccess: [VIEWER_GROUP_ID],
      reportingGroupName: "Core Development",
      organization: { shortName: "PEO", fullName: "Product Team" },
    });
  });

  it("reads the seeded singleton with findUnique and never upserts on the happy path", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValue({ shortName: "PEO", fullName: "Product Team" });
    const upsert = vi.fn();

    const result = await hydrateSession(
      viewerSession(),
      makePrisma({ findUnique, upsert }),
    );

    expect(findUnique).toHaveBeenCalledOnce();
    expect(upsert).not.toHaveBeenCalled();
    expect(result.organization).toEqual({
      shortName: "PEO",
      fullName: "Product Team",
    });
  });

  it("falls back to an upsert-create only when the singleton row is absent", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const upsert = vi
      .fn()
      .mockResolvedValue({ shortName: "Org", fullName: "Organization" });

    const result = await hydrateSession(
      viewerSession(),
      makePrisma({ findUnique, upsert }),
    );

    expect(findUnique).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledOnce();
    expect(result.organization).toEqual({
      shortName: "Org",
      fullName: "Organization",
    });
  });
});
