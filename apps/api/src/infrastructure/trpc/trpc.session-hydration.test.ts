import type { UserSession } from "@customreport/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../prisma/prisma.service";
import { clearOrgCache, hydrateSession } from "./trpc.session-hydration";

const USER_ID = "a0000000-0000-4000-8000-000000000101";
const REPORT_ID = "a0000000-0000-4000-8000-000000000201";
const SECTION_ID = "a0000000-0000-4000-8000-000000000301";
const GROUP_ID = "a0000000-0000-4000-8000-000000000401";
const VIEWER_GROUP_ID = "a0000000-0000-4000-8000-000000000501";

interface PrismaStubs {
  organizationFindUnique?: ReturnType<typeof vi.fn>;
  organizationUpsert?: ReturnType<typeof vi.fn>;
  reportingGroupFindUnique?: ReturnType<typeof vi.fn>;
  viewerGroupAccessFindMany?: ReturnType<typeof vi.fn>;
}

function makePrisma(stubs: PrismaStubs = {}): PrismaService {
  const stub = {
    reportSection: {
      findFirst: () => Promise.resolve({ id: SECTION_ID }),
    },
    viewerGroupAccess: {
      findMany:
        stubs.viewerGroupAccessFindMany ??
        vi.fn().mockResolvedValue([{ groupId: VIEWER_GROUP_ID }]),
    },
    reportingGroup: {
      findUnique:
        stubs.reportingGroupFindUnique ??
        vi.fn().mockResolvedValue({ name: "Core Development" }),
    },
    organization: {
      findUnique:
        stubs.organizationFindUnique ??
        vi
          .fn()
          .mockResolvedValue({ shortName: "PEO", fullName: "Product Team" }),
      upsert: stubs.organizationUpsert ?? vi.fn(),
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
      makePrisma({
        organizationFindUnique: findUnique,
        organizationUpsert: upsert,
      }),
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
      makePrisma({
        organizationFindUnique: findUnique,
        organizationUpsert: upsert,
      }),
    );

    expect(findUnique).toHaveBeenCalledOnce();
    expect(upsert).toHaveBeenCalledOnce();
    expect(result.organization).toEqual({
      shortName: "Org",
      fullName: "Organization",
    });
  });

  it("reuses the organization value within the cache TTL", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValue({ shortName: "PEO", fullName: "Product Team" });
    const prisma = makePrisma({ organizationFindUnique: findUnique });

    await hydrateSession(viewerSession(), prisma);
    await hydrateSession(viewerSession(), prisma);

    expect(findUnique).toHaveBeenCalledOnce();
  });

  it("skips viewer access hydration for non-viewer sessions", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const session = {
      ...viewerSession(),
      role: "head" as const,
      activeReportSectionId: SECTION_ID,
    };

    const result = await hydrateSession(
      session,
      makePrisma({ viewerGroupAccessFindMany: findMany }),
    );

    expect(findMany).not.toHaveBeenCalled();
    expect(result.viewerGroupAccess).toBeUndefined();
  });

  it("keeps a populated reporting group name without querying it again", async () => {
    const findUnique = vi.fn();
    const session = {
      ...viewerSession(),
      reportingGroupName: "Existing Group",
    };

    const result = await hydrateSession(
      session,
      makePrisma({ reportingGroupFindUnique: findUnique }),
    );

    expect(findUnique).not.toHaveBeenCalled();
    expect(result.reportingGroupName).toBe("Existing Group");
  });
});
