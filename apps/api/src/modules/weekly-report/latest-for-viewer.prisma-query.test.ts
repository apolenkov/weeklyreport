import type { UserSession } from "@customreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { queryVisibleReportId } from "./latest-for-viewer.prisma-query.js";

const viewer: UserSession = {
  userId: "a0000000-0000-4000-8000-000000000001",
  email: "viewer@example.test",
  name: "Viewer",
  role: "viewer",
  reportingGroupId: "b0000000-0000-4000-8000-000000000001",
};

describe("queryVisibleReportId", () => {
  it("returns null and includes the exact editable lifecycle filter", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = {
      report: { findFirst },
    } as unknown as PrismaService;

    await expect(
      queryVisibleReportId(
        prisma,
        "c0000000-0000-4000-8000-000000000001",
        viewer,
      ),
    ).resolves.toBeNull();

    const call = findFirst.mock.calls[0]?.[0] as {
      where: {
        id: string;
        periodStart: { lte: Date };
        archived?: boolean;
        OR: readonly Record<string, unknown>[];
      };
    };
    const where = call.where;
    expect(where.id).toBe("c0000000-0000-4000-8000-000000000001");
    expect(where.periodStart.lte).toBeInstanceOf(Date);
    expect(where.OR).toEqual([
      {
        status: "draft",
        periodStatus: "open",
        periodState: "open",
        archived: false,
      },
      {
        status: "published",
        periodStatus: "reopened",
        periodState: "open",
        archived: false,
      },
    ]);
  });
});
