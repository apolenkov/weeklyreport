import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { SessionRevocationService } from "../admin/index.js";
import { isUserAccessBarred, readLiveAccess } from "./session-deactivation";

const USER_ID = "a0000000-0000-4000-8000-0000000000b1";

function makePrisma(row: { isActive: boolean } | null): PrismaService {
  return {
    user: { findUnique: () => Promise.resolve(row) },
  } as unknown as PrismaService;
}

function revocation(
  isRevoked: () => Promise<boolean>,
): Pick<SessionRevocationService, "isRevoked"> {
  return { isRevoked };
}

describe("isUserAccessBarred", () => {
  it("bars a deactivated user (isActive=false, not revoked)", async () => {
    const barred = await isUserAccessBarred(
      USER_ID,
      makePrisma({ isActive: false }),
      revocation(() => Promise.resolve(false)),
    );

    expect(barred).toBe(true);
  });

  it("permits an active, non-revoked user", async () => {
    const barred = await isUserAccessBarred(
      USER_ID,
      makePrisma({ isActive: true }),
      revocation(() => Promise.resolve(false)),
    );

    expect(barred).toBe(false);
  });

  it("bars a user present in the revoked set via the fast path", async () => {
    const barred = await isUserAccessBarred(
      USER_ID,
      // An active DB row must not rescue a revoked user.
      makePrisma({ isActive: true }),
      revocation(() => Promise.resolve(true)),
    );

    expect(barred).toBe(true);
  });

  it("fails OPEN when the revoked-set lookup throws, deferring to Prisma", async () => {
    const barred = await isUserAccessBarred(
      USER_ID,
      makePrisma({ isActive: true }),
      revocation(() => Promise.reject(new Error("redis down"))),
    );

    expect(barred).toBe(false);
  });

  it("bars a missing user row (hard-deleted account, not in revoked set)", async () => {
    const barred = await isUserAccessBarred(
      USER_ID,
      makePrisma(null),
      revocation(() => Promise.resolve(false)),
    );

    expect(barred).toBe(true);
  });
});

describe("readLiveAccess", () => {
  it("returns the database role and group, not token claims", async () => {
    const prisma = {
      user: {
        findUnique: () =>
          Promise.resolve({
            isActive: true,
            role: "lead",
            reportingGroupId: "g1",
            reportingGroup: { name: "Group One" },
            authoredReportSections: [{ id: "s1" }],
          }),
      },
    } as unknown as PrismaService;

    await expect(
      readLiveAccess(
        USER_ID,
        prisma,
        revocation(() => Promise.resolve(false)),
        { activeReportId: "r1" },
      ),
    ).resolves.toEqual({
      role: "lead",
      reportingGroupId: "g1",
      reportingGroupName: "Group One",
      reportSectionId: "s1",
      viewerGroupIds: null,
    });
  });

  it("reads a viewer's group grants in the same user query on request", async () => {
    const findUnique = vi.fn(() =>
      Promise.resolve({
        isActive: true,
        role: "viewer",
        reportingGroupId: null,
        reportingGroup: null,
        viewerGroupAccess: [{ groupId: "g1" }, { groupId: "g2" }],
      }),
    );
    const prisma = { user: { findUnique } } as unknown as PrismaService;

    await expect(
      readLiveAccess(
        USER_ID,
        prisma,
        revocation(() => Promise.resolve(false)),
        { withViewerGroups: true },
      ),
    ).resolves.toMatchObject({ viewerGroupIds: ["g1", "g2"] });
    expect(findUnique).toHaveBeenCalledOnce();
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          viewerGroupAccess: { select: { groupId: true } },
        }) as unknown,
      }),
    );
  });

  it("reads group name and own section in the same user query", async () => {
    const findUnique = vi.fn(() =>
      Promise.resolve({
        isActive: true,
        role: "lead",
        reportingGroupId: null,
        reportingGroup: null,
        authoredReportSections: [],
      }),
    );
    const prisma = { user: { findUnique } } as unknown as PrismaService;

    await expect(
      readLiveAccess(
        USER_ID,
        prisma,
        revocation(() => Promise.resolve(false)),
        { activeReportId: "r1" },
      ),
    ).resolves.toMatchObject({
      reportingGroupName: null,
      reportSectionId: null,
    });
    expect(findUnique).toHaveBeenCalledOnce();
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: {
        isActive: true,
        role: true,
        reportingGroupId: true,
        reportingGroup: { select: { name: true } },
        authoredReportSections: {
          where: { reportId: "r1" },
          select: { id: true },
          take: 1,
        },
      },
    });
  });

  it("skips the section lookup without an active report", async () => {
    const findUnique = vi.fn(() =>
      Promise.resolve({ isActive: true, role: "head", reportingGroupId: null }),
    );
    const prisma = { user: { findUnique } } as unknown as PrismaService;

    await readLiveAccess(
      USER_ID,
      prisma,
      revocation(() => Promise.resolve(false)),
    );

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: {
        isActive: true,
        role: true,
        reportingGroupId: true,
        reportingGroup: { select: { name: true } },
      },
    });
  });

  it("returns null for a deactivated user", async () => {
    await expect(
      readLiveAccess(
        USER_ID,
        makePrisma({ isActive: false }),
        revocation(() => Promise.resolve(false)),
      ),
    ).resolves.toBeNull();
  });
});
