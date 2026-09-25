import { PublishedSnapshotIntegrityError } from "@customreport/report-persistence";
import { describe, expect, it, vi } from "vitest";

import { publishedSnapshotFixture } from "../../../test-utils/prisma-test-helper.js";
import { LeadFormPrismaRepository } from "./lead-form.prisma-repository.js";

const reportId = "a0000000-0000-4000-8000-000000000010";
const authorId = "a0000000-0000-4000-8000-000000000001";
const otherAuthorId = "a0000000-0000-4000-8000-000000000002";
const sectionId = "a0000000-0000-4000-8000-000000000011";
const otherSectionId = "a0000000-0000-4000-8000-000000000012";

const ownSection = {
  reportSectionId: sectionId,
  authorId,
  authorName: "Published Lead",
  groupId: "a0000000-0000-4000-8000-000000000009",
  groupName: "Published Group",
};

function publishedReadPrisma(options: {
  sectionOwners: readonly (typeof ownSection)[];
  admittedSectionId: string | null;
}) {
  const liveFindUnique = vi
    .fn()
    .mockRejectedValue(
      new Error("published detail must not read live sections"),
    );
  const prisma = {
    $transaction: vi.fn((operation: (tx: unknown) => unknown) =>
      Promise.resolve(operation(prisma)),
    ),
    report: {
      findUnique: vi.fn().mockResolvedValue({
        periodStatus: "published",
        archived: false,
        publishedSnapshot: publishedSnapshotFixture({
          reportId,
          periodStart: "2026-04-27",
          periodEnd: "2026-05-01",
          publishedAt: "2026-05-04T09:30:00.000Z",
          sectionOwners: options.sectionOwners,
        }),
      }),
    },
    reportSection: { findUnique: liveFindUnique },
    publishedSectionScope: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          options.admittedSectionId === null
            ? null
            : { reportSectionId: options.admittedSectionId },
        ),
    },
  };
  return { prisma, liveFindUnique };
}

describe("LeadFormPrismaRepository published by-period read", () => {
  it("serves a restored published section from snapshot without live rows", async () => {
    const { prisma, liveFindUnique } = publishedReadPrisma({
      sectionOwners: [ownSection],
      admittedSectionId: sectionId,
    });

    const result = await new LeadFormPrismaRepository(
      prisma as never,
    ).getSectionForPeriod(reportId, authorId);

    expect(result?.section.authorName).toBe("Published Lead");
    expect(result?.readOnly).toBe(true);
    expect(liveFindUnique).not.toHaveBeenCalled();
  });

  it("raises a snapshot-integrity error when the admitted section is absent from the snapshot", async () => {
    const { prisma } = publishedReadPrisma({
      sectionOwners: [{ ...ownSection, reportSectionId: otherSectionId }],
      admittedSectionId: sectionId,
    });

    await expect(
      new LeadFormPrismaRepository(prisma as never).getSectionForPeriod(
        reportId,
        authorId,
      ),
    ).rejects.toBeInstanceOf(PublishedSnapshotIntegrityError);
  });

  it("raises a snapshot-integrity error when the admitted snapshot section belongs to another author", async () => {
    const { prisma } = publishedReadPrisma({
      sectionOwners: [{ ...ownSection, authorId: otherAuthorId }],
      admittedSectionId: sectionId,
    });

    await expect(
      new LeadFormPrismaRepository(prisma as never).getSectionForPeriod(
        reportId,
        authorId,
      ),
    ).rejects.toBeInstanceOf(PublishedSnapshotIntegrityError);
  });

  it("returns null when the lead has no published-section admission", async () => {
    const { prisma, liveFindUnique } = publishedReadPrisma({
      sectionOwners: [ownSection],
      admittedSectionId: null,
    });

    const result = await new LeadFormPrismaRepository(
      prisma as never,
    ).getSectionForPeriod(reportId, authorId);

    expect(result).toBeNull();
    expect(liveFindUnique).not.toHaveBeenCalled();
  });
});
