import { describe, expect, it, vi } from "vitest";

import {
  queryDueDeadlineRules,
  queryDueEscalationRules,
} from "./reminders-due-rules.prisma-query.js";

const asNever = (value: unknown): never => value as never;

describe("due-rule recipient activity filter", () => {
  it("requires active draft authors for deadline recipients", async () => {
    const findMany = vi
      .fn<(args: unknown) => Promise<never[]>>()
      .mockResolvedValue([]);
    const prisma = {
      reminderRule: { findMany },
    };

    await queryDueDeadlineRules(asNever(prisma), new Date());

    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: { kind: "deadline", status: "active", policy: { active: true } },
      include: {
        policy: true,
        report: {
          select: {
            sections: {
              where: {
                status: "draft",
                author: { isActive: true },
              },
            },
          },
        },
      },
    });
  });

  it("requires active draft authors before escalation routing", async () => {
    const findMany = vi
      .fn<(args: unknown) => Promise<never[]>>()
      .mockResolvedValue([]);
    const prisma = {
      reminderRule: { findMany },
    };

    await queryDueEscalationRules(asNever(prisma), new Date(), {
      warn: vi.fn(),
    });

    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        kind: "escalation",
        status: "active",
        policy: { active: true },
      },
      include: {
        policy: true,
        report: {
          select: {
            sections: {
              where: {
                status: "draft",
                author: { isActive: true },
              },
            },
          },
        },
      },
    });
  });

  it("drops a due row whose rule identity is stale after a policy edit", async () => {
    const deadline = new Date("2026-04-13T18:00:00.000Z");
    const prisma = {
      reminderRule: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "b0000000-0000-4000-a000-0000000000b2",
            reportId: "b0000000-0000-4000-a000-0000000000b1",
            policyId: "b0000000-0000-4000-a000-0000000000b6",
            kind: "deadline",
            fireAt: new Date("2026-04-11T18:00:00.000Z"),
            deadline,
            timezone: "Europe/Moscow",
            status: "active",
            version: 1,
            policy: {
              id: "b0000000-0000-4000-a000-0000000000b6",
              kind: "deadline",
              offsetMinutes: -1440,
              timezone: "Europe/Moscow",
              audience: "LEAD_WITH_DRAFT",
              active: true,
              validFrom: new Date("2026-01-01T00:00:00.000Z"),
              validUntil: null,
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            },
            report: {
              id: "b0000000-0000-4000-a000-0000000000b1",
              periodStart: new Date("2026-04-07T00:00:00.000Z"),
              periodEnd: new Date("2026-04-13T23:59:59.999Z"),
              deadline,
              sections: [
                {
                  authorId: "b0000000-0000-4000-a000-0000000000b3",
                  author: {
                    id: "b0000000-0000-4000-a000-0000000000b3",
                    email: "lead@test.local",
                    name: "Lead",
                    notificationOptOut: false,
                  },
                },
              ],
            },
          },
        ]),
      },
    };

    await expect(
      queryDueDeadlineRules(
        asNever(prisma),
        new Date("2026-04-14T00:00:00.000Z"),
      ),
    ).resolves.toEqual([]);
  });
});
