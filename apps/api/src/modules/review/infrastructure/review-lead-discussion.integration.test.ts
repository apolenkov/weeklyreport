import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper.js";
import { ReportSectionsPrismaRepository } from "../../report-sections/test-seams/index.js";
import { ReviewActionsPrismaRepository } from "./review-actions.prisma-repository.js";

const STABLE_ID = "83600000-0000-4000-8000-000000000101";
const UNAVAILABLE = { status: "unavailable" };

describe("Lead item discussion read (PostgreSQL integration)", () => {
  // Uses the existing exact-target guard and destructive integration fixture.
  // Run only in the coordinated, reset + seeded, serial integration phase.
  const prisma = createTestPrisma();
  const repo = new ReviewActionsPrismaRepository(
    prisma as unknown as PrismaService,
  );
  const sections = new ReportSectionsPrismaRepository(
    prisma as unknown as PrismaService,
  );
  let data: Awaited<ReturnType<typeof seedTestData>>;

  beforeEach(async () => {
    await cleanDatabase();
    data = await seedTestData(prisma);
  });

  afterAll(async () => {
    try {
      await cleanDatabase();
    } finally {
      await disconnectTestPrisma();
    }
  });

  const actor = () => ({ userId: data.lead.id, role: "lead" as const });
  const read = (stableId = STABLE_ID) =>
    repo.readLeadItemDiscussion(actor(), {
      reportSectionId: data.section.id,
      stableId,
    });
  const seedItem = () =>
    prisma.item.create({
      data: {
        reportSectionId: data.section.id,
        stableId: STABLE_ID,
        projectId: data.project.id,
        type: "current",
        text: "Synthetic discussion target",
        tag: "feature",
        workflowStatus: "in_progress",
        stageNames: ["dev"],
      },
    });

  it("returns the lineage's ordered comments across physical recreation", async () => {
    const item = await seedItem();
    const first = await repo.insertLeadItemComment(actor(), item.id, "First");
    const second = await repo.insertLeadItemComment(actor(), item.id, "Second");
    const draft = expectDefined(await sections.getSectionById(data.section.id));
    await sections.saveSection(draft, draft.version);

    const view = await read();
    expect(view).toEqual({
      status: "available",
      comments: [
        expect.objectContaining({ id: first.id, text: "First" }),
        expect.objectContaining({ id: second.id, text: "Second" }),
      ],
    });
  });

  it("returns an empty available discussion for an own item without comments", async () => {
    await seedItem();
    expect(await read()).toEqual({ status: "available", comments: [] });
  });

  it("answers unavailable for a missing lineage, a foreign section and an inactive actor", async () => {
    await seedItem();
    expect(await read("83600000-0000-4000-8000-000000000199")).toEqual(
      UNAVAILABLE,
    );
    await prisma.reportSection.update({
      where: { id: data.section.id },
      data: { authorId: data.head.id },
    });
    expect(await read()).toEqual(UNAVAILABLE);
    await prisma.reportSection.update({
      where: { id: data.section.id },
      data: { authorId: data.lead.id },
    });
    await prisma.user.update({
      where: { id: data.lead.id },
      data: { isActive: false },
    });
    expect(await read()).toEqual(UNAVAILABLE);
  });

  it("answers unavailable for an archived report and writes nothing", async () => {
    await seedItem();
    await prisma.report.update({
      where: { id: data.report.id },
      data: { archived: true, periodState: "archived" },
    });
    const before = await prisma.report.findUniqueOrThrow({
      where: { id: data.report.id },
    });
    expect(await read()).toEqual(UNAVAILABLE);
    expect(
      await prisma.report.findUniqueOrThrow({ where: { id: data.report.id } }),
    ).toEqual(before);
    expect(await prisma.recordComment.count()).toBe(0);
  });
});
