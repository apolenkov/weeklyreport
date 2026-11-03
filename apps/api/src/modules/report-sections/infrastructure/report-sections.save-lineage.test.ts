import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  captureRecordComments,
  reinsertRecordComments,
} from "./report-sections.save-lineage.js";

describe("comment lineage", () => {
  it("preserves the comment identity and author through item recreation", async () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const createMany = vi.fn();
    const tx = {
      recordComment: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "comment-id",
            reviewerId: "author-id",
            text: "message",
            createdAt,
            item: { stableId: "stable-id" },
            risk: null,
            decision: null,
          },
        ]),
        createMany,
      },
      item: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: "new-item-id", stableId: "stable-id" }]),
      },
      risk: { findMany: vi.fn().mockResolvedValue([]) },
      decision: { findMany: vi.fn().mockResolvedValue([]) },
    } as unknown as Prisma.TransactionClient;
    const captured = await captureRecordComments(tx, "section-id");
    await reinsertRecordComments(tx, "section-id", captured);
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          id: "comment-id",
          reviewerId: "author-id",
          text: "message",
          createdAt,
          itemId: "new-item-id",
          riskId: null,
          decisionId: null,
        },
      ],
    });
  });
});
