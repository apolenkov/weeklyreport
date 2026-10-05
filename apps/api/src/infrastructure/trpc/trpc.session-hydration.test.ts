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
        vi.fn().mockResolvedValue({ name: "Software Development" }),
    },
    organization: {
      findUnique:
        stubs.organizationFindUnique ??
        vi
          .fn()
          .mockResolvedValue({ shortName: "Demo", fullName: "Product Team" }),
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
      reportingGroupName: "Software Development",
      organization: { shortName: "Demo", fullName: "Product Team" },
    });
  });

  it("reads the seeded singleton with findUnique and never upserts on the happy path", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValue({ shortName: "Demo", fullName: "Product Team" });
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
      shortName: "Demo",
      fullName: "Product Team",
    });
  });

  it("fails loud when the singleton organization row is absent (no code-default upsert)", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const upsert = vi.fn();

    await expect(
      hydrateSession(
        viewerSession(),
        makePrisma({
          organizationFindUnique: findUnique,
          organizationUpsert: upsert,
        }),
      ),
    ).rejects.toThrow(/Organization singleton row 'singleton' is missing/);

    expect(findUnique).toHaveBeenCalledOnce();
    // Read hydration must not create or mutate the singleton when it is absent.
    expect(upsert).not.toHaveBeenCalled();
  });

  it("reuses the organization value within the cache TTL", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValue({ shortName: "Demo", fullName: "Product Team" });
    const prisma = makePrisma({ organizationFindUnique: findUnique });

    await hydrateSession(viewerSession(), prisma);
    await hydrateSession(viewerSession(), prisma);

    expect(findUnique).toHaveBeenCalledOnce();
  });

  it("skips the section and viewer lookups when the live read already supplied them", async () => {
    const findMany = vi.fn().mockResolvedValue([]);

    const result = await hydrateSession(
      { ...viewerSession(), viewerGroupAccess: [VIEWER_GROUP_ID] },
      makePrisma({ viewerGroupAccessFindMany: findMany }),
      { liveResolved: true },
    );

    expect(findMany).not.toHaveBeenCalled();
    expect(result.viewerGroupAccess).toEqual([VIEWER_GROUP_ID]);
    expect(result.activeReportSectionId).toBeNull();
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
