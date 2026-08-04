import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { getSnapshot } from "./admin-snapshot.queries.js";

const EXECUTION_CREATED_AT = new Date("2026-04-07T09:00:00.000Z");
const RULE_FIRE_AT = new Date("2026-04-10T09:00:00.000Z");

function prismaWith(execution: unknown): PrismaService {
  return {
    reportingGroup: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
    project: { findMany: vi.fn().mockResolvedValue([]) },
    report: { findMany: vi.fn().mockResolvedValue([]) },
    reminderRule: { findMany: vi.fn().mockResolvedValue([]) },
    reminderExecution: { findMany: vi.fn().mockResolvedValue([execution]) },
    reminderPolicy: { findMany: vi.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
}

// The snapshot used to fabricate reportId=null and scheduledFor=createdAt;
// both must come from the owning rule's real columns (reportId, fireAt).
describe("getSnapshot — reminder execution facts", () => {
  it("maps reportId and scheduledFor from the owning rule, never createdAt", async () => {
    const prisma = prismaWith({
      id: "e0000000-0000-4000-8000-000000000001",
      ruleId: "e0000000-0000-4000-8000-000000000002",
      dedupeKey: "dedupe-key",
      status: "pending",
      sentAt: null,
      recipientEmail: "lead@test.local",
      error: null,
      createdAt: EXECUTION_CREATED_AT,
      rule: {
        reportId: "e0000000-0000-4000-8000-000000000003",
        fireAt: RULE_FIRE_AT,
      },
    });

    const snapshot = await getSnapshot(prisma);

    expect(snapshot.reminderExecutions[0]).toMatchObject({
      reportId: "e0000000-0000-4000-8000-000000000003",
      scheduledFor: RULE_FIRE_AT,
    });
    expect(snapshot.reminderExecutions[0]?.scheduledFor).not.toEqual(
      EXECUTION_CREATED_AT,
    );
  });
});
