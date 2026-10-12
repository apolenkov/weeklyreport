import type { UserSession } from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { ProductFeedbackPrismaRepository } from "./product-feedback.prisma-repository";
import { feedbackAccessFromSession } from "./product-feedback.repository";

function access(userId: string, role: UserSession["role"] = "lead") {
  const session: UserSession = {
    userId,
    role,
    name: `Lead ${userId}`,
    email: `${userId}@example.test`,
    reportingGroupId: "group-1",
  };
  return feedbackAccessFromSession(session);
}

describe("ProductFeedbackPrismaRepository single-item deletion", () => {
  it("lets an admin delete exactly one WeeklyReport item", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const repository = new ProductFeedbackPrismaRepository({
      productFeedback: { deleteMany },
    } as unknown as PrismaService);

    await repository.delete(access("admin", "admin"), "feedback-1");

    expect(deleteMany).toHaveBeenCalledWith({
      where: { id: "feedback-1", projectName: "weekly-report" },
    });
  });

  it("rejects non-admin deletion before querying the database", async () => {
    const deleteMany = vi.fn();
    const repository = new ProductFeedbackPrismaRepository({
      productFeedback: { deleteMany },
    } as unknown as PrismaService);

    await expect(
      repository.delete(access("lead-a"), "feedback-1"),
    ).rejects.toMatchObject({ code: "STORE_NOT_FOUND" });
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
