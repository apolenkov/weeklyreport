import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper.js";
import {
  ReviewAccessError,
  ReviewNotFoundError,
} from "../application/review.service.js";
import { ReviewActionsService } from "../application/review-actions.service.js";
import { ReviewActionsPrismaRepository } from "./review-actions.prisma-repository.js";

// The writer's locked recheck remains necessary for races. These real-query
// tests additionally prove that already-private anchors stop at the service
// precheck, before group permissions or a coordinated writer are reached.
describe.each([
  { kind: "risk", missing: "impact" },
  { kind: "risk", missing: "mitigation" },
  { kind: "decision", missing: "impact" },
] as const)("review prechecks: $kind without $missing", ({ kind, missing }) => {
  const prisma = createTestPrisma();
  const repo = new ReviewActionsPrismaRepository(
    prisma as unknown as PrismaService,
  );
  const service = new ReviewActionsService(repo);
  let data: Awaited<ReturnType<typeof seedTestData>>;
  let recordId: string;

  const anchor = () =>
    kind === "risk" ? { riskId: recordId } : { decisionId: recordId };
  const comments = () =>
    prisma.recordComment.findMany({ orderBy: { id: "asc" } });
  const setComplete = (complete: boolean) =>
    kind === "risk"
      ? prisma.risk.update({
          where: { id: recordId },
          data: {
            impact: complete || missing !== "impact" ? "Date slips" : null,
            mitigation:
              complete || missing !== "mitigation" ? "Second vendor" : null,
          },
        })
      : prisma.decision.update({
          where: { id: recordId },
          data: { impact: complete ? "Date slips" : null },
        });
  const record = () =>
    kind === "risk"
      ? prisma.risk.findUniqueOrThrow({ where: { id: recordId } })
      : prisma.decision.findUniqueOrThrow({ where: { id: recordId } });

  async function reviewer(role: "head" | "admin" | "viewer") {
    await prisma.user.update({ where: { id: data.head.id }, data: { role } });
    const groupId = expectDefined(data.head.reportingGroupId);
    if (role === "viewer")
      await prisma.viewerGroupAccess.create({
        data: { viewerUserId: data.head.id, groupId, canReview: true },
      });
    return {
      userId: data.head.id,
      role,
      reportingGroupId: groupId,
      viewerGroupAccess: [groupId],
    };
  }

  beforeEach(async () => {
    await cleanDatabase();
    data = await seedTestData(prisma);
    const common = {
      reportSectionId: data.section.id,
      impact: "Date slips",
      stageNames: ["Development"],
    };
    const created =
      kind === "risk"
        ? await prisma.risk.create({
            data: {
              ...common,
              projectId: data.project.id,
              risk: "Vendor may slip",
              mitigation: "Second vendor",
              severity: "at-risk",
            },
          })
        : await prisma.decision.create({
            data: {
              ...common,
              productId: data.project.id,
              text: "Choose vendor",
              owner: "Lead",
            },
          });
    recordId = created.id;
  });

  afterEach(() => vi.restoreAllMocks());

  it.each(["head", "admin", "viewer"] as const)(
    "stops nonauthor %s creation and reviewer-owned deletion before either writer",
    async (role) => {
      const actor = await reviewer(role);
      const existing = await service.comment(actor, {
        ...anchor(),
        text: "Keep original discussion",
      });
      await setComplete(false);
      const before = { comments: await comments(), record: await record() };
      const insert = vi.spyOn(repo, "insertComment");
      const remove = vi.spyOn(repo, "deleteComment");

      await expect(
        service.comment(actor, { ...anchor(), text: "Must not appear" }),
      ).rejects.toMatchObject({
        constructor: ReviewNotFoundError,
        message: "Record not found.",
      });
      expect(insert).not.toHaveBeenCalled();
      await expect(
        service.deleteComment(actor, { commentId: existing.id }),
      ).rejects.toMatchObject({
        constructor: ReviewNotFoundError,
        message: "Comment not found.",
      });
      expect(remove).not.toHaveBeenCalled();
      expect({ comments: await comments(), record: await record() }).toEqual(
        before,
      );

      await setComplete(true);
      expect(await comments()).toEqual(before.comments);
      const next = await service.comment(actor, {
        ...anchor(),
        text: "Allowed after re-completion",
      });
      await expect(
        service.deleteComment(actor, { commentId: existing.id }),
      ).resolves.toEqual({ success: true });
      expect(await comments()).toMatchObject([{ id: next.id }]);
    },
  );

  it("uses inaccessible responses before an unrelated Head's group denial", async () => {
    const actor = await reviewer("head");
    const existing = await service.comment(actor, {
      ...anchor(),
      text: "Previously admitted",
    });
    const otherGroup = await prisma.reportingGroup.create({
      data: { name: "Other reporting group" },
    });
    await prisma.user.update({
      where: { id: actor.userId },
      data: { reportingGroupId: otherGroup.id },
    });
    await setComplete(false);
    const before = await comments();
    const foreign = { ...actor, reportingGroupId: otherGroup.id };
    const insert = vi.spyOn(repo, "insertComment");
    const remove = vi.spyOn(repo, "deleteComment");

    await expect(
      service.comment(foreign, { ...anchor(), text: "Denied" }),
    ).rejects.toMatchObject({
      constructor: ReviewNotFoundError,
      message: "Record not found.",
    });
    await expect(
      service.deleteComment(foreign, { commentId: existing.id }),
    ).rejects.toMatchObject({
      constructor: ReviewNotFoundError,
      message: "Comment not found.",
    });
    expect(insert).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(await comments()).toEqual(before);
  });

  it("requires reviewer permission even for the private anchor's author", async () => {
    await setComplete(false);
    const author = {
      userId: data.lead.id,
      role: "lead" as const,
      reportingGroupId: expectDefined(data.lead.reportingGroupId),
    };
    const insert = vi.spyOn(repo, "insertComment");
    await expect(
      service.comment(author, { ...anchor(), text: "Not a reviewer" }),
    ).rejects.toBeInstanceOf(ReviewAccessError);
    expect(insert).not.toHaveBeenCalled();
    expect(await comments()).toEqual([]);

    await prisma.user.update({
      where: { id: author.userId },
      data: { role: "head" },
    });
    const authorHead = { ...author, role: "head" as const };
    const created = await service.comment(authorHead, {
      ...anchor(),
      text: "Own draft with normal reviewer permission",
    });
    await expect(
      service.deleteComment(authorHead, { commentId: created.id }),
    ).resolves.toEqual({ success: true });
    expect(await comments()).toEqual([]);
  });
});

afterAll(async () => {
  try {
    await cleanDatabase();
  } finally {
    await disconnectTestPrisma();
  }
});
