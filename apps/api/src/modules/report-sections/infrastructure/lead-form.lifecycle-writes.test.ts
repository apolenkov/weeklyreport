import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import {
  LeadFormConstraintError,
  LeadFormDomainError,
  ReopenRequestError,
} from "../domain/lead-form-shared.js";
import { LeadFormPrismaRepository } from "./lead-form.prisma-repository.js";

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const SECTION_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const PUBLISHER_ID = "44444444-4444-4444-8444-444444444444";
const openReport = {
  id: REPORT_ID,
  status: "draft",
  periodState: "open",
  periodStatus: "open",
  archived: false,
  autoPublished: false,
  autoArchived: false,
  publishedAt: null,
  publishedById: null,
  reopenedAt: null,
} as const;
const publishedReport = {
  ...openReport,
  status: "published",
  periodState: "published",
  periodStatus: "published",
  publishedAt: new Date("2026-08-31T08:00:00.000Z"),
  publishedById: PUBLISHER_ID,
} as const;

function repositoryWithGate(report: object) {
  const sectionUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
  const reopenCreate = vi.fn().mockResolvedValue({});
  const sectionFindUnique = vi
    .fn()
    .mockResolvedValue({ authorId: USER_ID, status: "submitted" });
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([report]),
    reportSection: {
      updateMany: sectionUpdateMany,
      findUnique: sectionFindUnique,
    },
    reopenRequest: { create: reopenCreate },
  };
  const prisma = {
    $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    ),
  } as unknown as PrismaService;
  return {
    repo: new LeadFormPrismaRepository(prisma),
    reopenCreate,
    sectionFindUnique,
    sectionUpdateMany,
  };
}

describe("LeadFormPrismaRepository — canonical editable lifecycle lock", () => {
  it("rejects direct revoke after publish without changing the section", async () => {
    const { repo, sectionUpdateMany } = repositoryWithGate(publishedReport);

    await expect(
      repo.revokeSectionSubmission(SECTION_ID, USER_ID, {}),
    ).rejects.toBeInstanceOf(LeadFormConstraintError);
    expect(sectionUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects revoke as not-found when the section row vanished in the window", async () => {
    const prisma = {
      $transaction: vi.fn((callback: (client: unknown) => unknown) =>
        Promise.resolve(
          callback({
            $queryRaw: vi.fn().mockResolvedValue([]),
            reportSection: { updateMany: vi.fn() },
          }),
        ),
      ),
    } as unknown as PrismaService;
    const repo = new LeadFormPrismaRepository(prisma);

    await expect(
      repo.revokeSectionSubmission(SECTION_ID, USER_ID, {}),
    ).rejects.toBeInstanceOf(LeadFormDomainError);
  });

  it("returns zero for bulk revoke after publish without changing sections", async () => {
    const { repo, sectionUpdateMany } = repositoryWithGate(publishedReport);

    await expect(repo.revokeAllSubmitted(REPORT_ID, USER_ID, {})).resolves.toBe(
      0,
    );
    expect(sectionUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects reopen-request creation after publish", async () => {
    const { repo, reopenCreate, sectionFindUnique } =
      repositoryWithGate(publishedReport);

    await expect(
      repo.createReopenRequest(SECTION_ID, USER_ID),
    ).rejects.toBeInstanceOf(ReopenRequestError);
    expect(sectionFindUnique).not.toHaveBeenCalled();
    expect(reopenCreate).not.toHaveBeenCalled();
  });

  it("creates a request only after rechecking the submitted owner under the lock", async () => {
    const { repo, reopenCreate, sectionFindUnique } =
      repositoryWithGate(openReport);

    await expect(
      repo.createReopenRequest(SECTION_ID, USER_ID, " Need correction "),
    ).resolves.toBeUndefined();
    expect(sectionFindUnique).toHaveBeenCalledExactlyOnceWith({
      where: { id: SECTION_ID },
      select: { authorId: true, status: true },
    });
    expect(reopenCreate).toHaveBeenCalledExactlyOnceWith({
      data: {
        reportSectionId: SECTION_ID,
        requestedById: USER_ID,
        reason: "Need correction",
      },
    });
  });
});
