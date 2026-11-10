// The activity board counts finished risks and decisions only: an unfinished
// one is its author's private draft (openspec: lead-incomplete-record-drafts)
// and is left out where the rows are read, not after.
import { describe, expect, it, vi } from "vitest";

import { ActivityPrismaRepository } from "./activity.prisma-repository.js";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const LEAD_ID = "22222222-2222-4222-8222-222222222222";
const SECTION_ID = "33333333-3333-4333-8333-333333333333";
const EDITED_AT = new Date("2026-11-03T09:00:00.000Z");

function buildRepository() {
  const sectionFindMany = vi.fn().mockResolvedValue([
    {
      id: SECTION_ID,
      authorId: LEAD_ID,
      status: "draft",
      updatedAt: EDITED_AT,
      submittedAt: null,
      items: [],
      // What the database returns once the filter below is applied.
      risks: [{ updatedAt: EDITED_AT }],
      decisions: [],
    },
  ]);
  const tx = {
    report: {
      findUnique: vi.fn().mockResolvedValue({
        id: REPORT_ID,
        periodStart: new Date("2026-11-02T00:00:00.000Z"),
        periodEnd: new Date("2026-11-08T00:00:00.000Z"),
        periodStatus: "open",
        publishedSnapshot: null,
      }),
    },
    user: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { id: LEAD_ID, name: "Lead 1", email: "lead1@example.test" },
        ]),
    },
    reportSection: { findMany: sectionFindMany },
  };
  const prisma = {
    $transaction: vi.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };
  return {
    repo: new ActivityPrismaRepository(prisma as never),
    sectionFindMany,
  };
}

describe("ActivityPrismaRepository — unfinished risks and decisions", () => {
  it("reads only finished risks and decisions for the live board", async () => {
    const { repo, sectionFindMany } = buildRepository();

    const activity = await repo.getLiveActivity(REPORT_ID, {
      userId: "44444444-4444-4444-8444-444444444444",
      role: "admin",
    } as never);

    expect(sectionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          risks: {
            where: { impact: { not: null }, mitigation: { not: null } },
            select: { updatedAt: true },
          },
          decisions: {
            where: { impact: { not: null } },
            select: { updatedAt: true },
          },
        }) as unknown,
      }),
    );
    expect(activity.rows).toEqual([
      expect.objectContaining({ leadId: LEAD_ID, riskCount: 1 }),
    ]);
  });
});
