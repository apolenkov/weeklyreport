import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { groupScopeFilter } from "../../../lib/group-scope.js";
import { baseRow } from "../infrastructure/__tests__/report-sections-prisma-harness.js";
import { LeadFormPrismaRepository } from "../infrastructure/lead-form.prisma-repository.js";
import {
  LeadFormConstraintError,
  LeadFormDomainError,
  LeadFormService,
} from "./lead-form.service.js";
import { NOOP_REPORT_SECTIONS_TELEMETRY } from "./report-sections-telemetry.port.js";
import { applyRevokeTransition } from "./revoke-transition.js";

describe("applyRevokeTransition", () => {
  it("atomically restricts the transition to editable report periods", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });

    await expect(
      applyRevokeTransition(
        { reportSection: { updateMany } } as unknown as Pick<
          Prisma.TransactionClient,
          "reportSection"
        >,
        "44444444-4444-4444-8444-444444444444",
        "55555555-5555-4555-8555-555555555555",
        { scope: {}, expectedVersion: 3 },
      ),
    ).resolves.toBe(0);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            id: "44444444-4444-4444-8444-444444444444",
            status: "submitted",
            report: {
              archived: false,
              periodStatus: { in: ["open", "reopened"] },
            },
            version: 3,
          },
          {},
        ],
      },
      data: {
        status: "draft",
        revokedAt: expect.any(Date) as unknown,
        revokedBy: "55555555-5555-4555-8555-555555555555",
        submittedAt: null,
      },
    });
  });
});

describe("single revoke — actual service/repository write contract", () => {
  const sectionId = "11111111-1111-4111-8111-111111111111";
  const reportId = "22222222-2222-4222-8222-222222222222";
  const headId = "33333333-3333-4333-8333-333333333333";
  const groupId = "44444444-4444-4444-8444-444444444444";
  it.each(["head", "admin"] as const)(
    "carries admitted %s scope through the current producer to the atomic write",
    async (role) => {
      const row = baseRow({
        status: "submitted",
        submittedAt: new Date("2026-04-14T09:00:00Z"),
      });
      const section = {
        ...row,
        author: { ...row.author, reportingGroupId: groupId },
      };
      const updateMany = vi.fn().mockResolvedValue({ count: 1 });
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([
          {
            id: reportId,
            status: "draft",
            periodStatus: "open",
            periodState: "open",
            archived: false,
            autoPublished: false,
            autoArchived: false,
            publishedAt: null,
            publishedById: null,
            reopenedAt: null,
          },
        ]),
        reportSection: { updateMany },
      };
      const prisma = {
        reportSection: {
          findFirst: vi.fn().mockResolvedValue(section),
          findUnique: vi
            .fn()
            .mockResolvedValue({ report: { periodStatus: "open" } }),
        },
        $transaction: (operation: (client: typeof tx) => Promise<void>) =>
          operation(tx),
      } as unknown as PrismaService;
      const service = new LeadFormService(
        new LeadFormPrismaRepository(prisma),
        NOOP_REPORT_SECTIONS_TELEMETRY,
      );
      const scope = groupScopeFilter(
        { role, reportingGroupId: groupId, viewerGroupAccess: [] },
        "reportSection",
      );
      await expect(
        service.revokeSubmission(sectionId, headId, scope),
      ).resolves.toEqual({ success: true });
      expect(updateMany.mock.calls[0]?.[0]).toMatchObject({
        where: {
          AND: [
            {
              id: sectionId,
              status: "submitted",
              report: {
                archived: false,
                periodStatus: { in: ["open", "reopened"] },
              },
            },
            role === "head"
              ? { author: { reportingGroupId: { in: [groupId] } } }
              : {},
          ],
        },
        data: { status: "draft", submittedAt: null, revokedBy: headId },
      });
      expect(updateMany).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    { available: null, error: LeadFormDomainError },
    { available: { id: sectionId }, error: LeadFormConstraintError },
  ])(
    "classifies zero-row single revoke using scoped availability: $error.name",
    async ({ available, error }) => {
      const scope = {
        author: { reportingGroupId: "55555555-5555-4555-8555-555555555555" },
      };
      const findFirst = vi.fn().mockResolvedValue(available);
      const updateMany = vi.fn().mockResolvedValue({ count: 0 });
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([
          {
            id: reportId,
            status: "draft",
            periodStatus: "open",
            periodState: "open",
            archived: false,
            autoPublished: false,
            autoArchived: false,
            publishedAt: null,
            publishedById: null,
            reopenedAt: null,
          },
        ]),
        reportSection: { updateMany, findFirst },
      };
      const prisma = {
        $transaction: (operation: (client: typeof tx) => Promise<void>) =>
          operation(tx),
      } as unknown as PrismaService;
      const repo = new LeadFormPrismaRepository(prisma);
      await expect(
        repo.revokeSectionSubmission(sectionId, headId, scope),
      ).rejects.toBeInstanceOf(error);
      expect(findFirst).toHaveBeenCalledExactlyOnceWith({
        where: { AND: [{ id: sectionId }, scope] },
        select: { id: true },
      });
      expect(updateMany).toHaveBeenCalledTimes(1);
    },
  );
});
