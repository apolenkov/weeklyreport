import type { UserSession } from "@weeklyreport/shared";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaService } from "../../../infrastructure/prisma/prisma.service";
import { createNullLogger } from "../../../lib/logger.js";
import { expectDefined } from "../../../test-utils/expect-defined.js";
import {
  cleanDatabase,
  createTestPrisma,
  disconnectTestPrisma,
  seedTestData,
} from "../../../test-utils/prisma-test-helper";
import { WeeklyReportPrismaRepository } from "../../weekly-report/weekly-report.prisma-repository";
import { PublicationService } from "../application/publication.service.js";
import { PublicationPrismaRepository } from "./publication.prisma-repository";

// Russian (ICU "ru") order. "Ёлкин" starts with U+0401, which sorts before
// "Антонов" (U+0410) by code point, so the three orders differ.
const RUSSIAN_ORDER = [
  "Антонов",
  "Борисов",
  "Егоров",
  "Ёлкин",
  "Жуков",
] as const;

// Inserted out of order so neither insertion nor id order matches RUSSIAN_ORDER.
const CYRILLIC_LEADS = [
  {
    id: "a0000000-0000-4000-a000-000000000021",
    name: "Жуков",
    email: "zhukov-lead@test.local",
    samlId: "zhukov-lead-test",
  },
  {
    id: "a0000000-0000-4000-a000-000000000022",
    name: "Ёлкин",
    email: "yolkin-lead@test.local",
    samlId: "yolkin-lead-test",
  },
  {
    id: "a0000000-0000-4000-a000-000000000023",
    name: "Антонов",
    email: "antonov-lead@test.local",
    samlId: "antonov-lead-test",
  },
  {
    id: "a0000000-0000-4000-a000-000000000024",
    name: "Егоров",
    email: "egorov-lead@test.local",
    samlId: "egorov-lead-test",
  },
] as const;

describe("publication Russian author order (integration)", () => {
  const prisma = createTestPrisma();
  let repo: PublicationPrismaRepository;
  let service: PublicationService;
  let testData: Awaited<ReturnType<typeof seedTestData>>;
  let headSession: UserSession;
  let adminSession: UserSession;

  beforeEach(async () => {
    await cleanDatabase();
    testData = await seedTestData(prisma);
    repo = new PublicationPrismaRepository(prisma as unknown as PrismaService);
    service = new PublicationService(repo, createNullLogger(), () =>
      Promise.resolve(),
    );
    headSession = {
      userId: testData.head.id,
      email: testData.head.email,
      name: testData.head.name,
      role: "head",
      reportingGroupId: expectDefined(testData.head.reportingGroupId),
    };
    adminSession = {
      ...headSession,
      role: "admin",
      reportingGroupId: undefined,
    };

    // Rename the seeded lead so all five names are Cyrillic and comparable.
    await prisma.user.update({
      where: { id: testData.lead.id },
      data: { name: "Борисов" },
    });
    await prisma.user.createMany({
      data: CYRILLIC_LEADS.map((lead) => ({
        id: lead.id,
        email: lead.email,
        name: lead.name,
        lastName: lead.name,
        firstName: "Иван",
        role: "lead" as const,
        samlId: lead.samlId,
        reportingGroupId: testData.lead.reportingGroupId,
      })),
    });
    await prisma.reportSection.createMany({
      data: CYRILLIC_LEADS.map((lead) => ({
        reportId: testData.report.id,
        authorId: lead.id,
      })),
    });
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectTestPrisma();
  });

  it("orders Cyrillic authors by Russian collation in the preview", async () => {
    const readPreviewNames = async () =>
      (
        await service.getAssembledPreview(testData.report.id, headSession)
      ).sections.map((section) => section.authorName);

    const firstRead = await readPreviewNames();
    const secondRead = await readPreviewNames();

    expect(firstRead).toEqual([...RUSSIAN_ORDER]);
    expect(secondRead).toEqual(firstRead);

    // Guard against a tautology: a code-point sort must give a different order.
    const codePointOrder = [...RUSSIAN_ORDER].sort();
    expect(codePointOrder).not.toEqual([...RUSSIAN_ORDER]);
    expect(firstRead).not.toEqual(codePointOrder);
  });

  it("freezes the Russian order into the published snapshot", async () => {
    const preview = await service.getAssembledPreview(
      testData.report.id,
      headSession,
    );
    const publishedAt = new Date("2026-04-12T10:00:00.000Z");

    const outcome = await repo.saveAutoPublishedReport({
      ...preview,
      status: "published",
      publishedAt,
      publishedById: null,
    });

    expect(outcome.published).toBe(true);
    if (outcome.published) {
      expect(
        outcome.report.sections.map(({ authorName }) => authorName),
      ).toEqual([...RUSSIAN_ORDER]);
    }
    await expect(
      prisma.report.findUnique({
        where: { id: testData.report.id },
        select: { publishedSnapshot: true },
      }),
    ).resolves.toMatchObject({
      publishedSnapshot: {
        sections: RUSSIAN_ORDER.map((authorName) => ({ authorName })),
      },
    });
  });

  it("keeps the frozen order after an author is renamed", async () => {
    const preview = await service.getAssembledPreview(
      testData.report.id,
      headSession,
    );
    const publishedAt = new Date("2026-04-12T10:00:00.000Z");
    const outcome = await repo.saveAutoPublishedReport({
      ...preview,
      status: "published",
      publishedAt,
      publishedById: null,
    });
    expect(outcome.published).toBe(true);

    // "Антонов" moves to the end of the live order; the snapshot must not move.
    const antonov = expectDefined(
      CYRILLIC_LEADS.find((lead) => lead.name === "Антонов"),
    );
    await prisma.user.update({
      where: { id: antonov.id },
      data: { name: "Яковлев" },
    });
    await expect(
      prisma.user.findUnique({
        where: { id: antonov.id },
        select: { name: true },
      }),
    ).resolves.toEqual({ name: "Яковлев" });

    // The weekly-report read of a published period serves the frozen snapshot.
    const weeklyRepo = new WeeklyReportPrismaRepository(
      prisma as unknown as PrismaService,
    );
    const frozen = expectDefined(
      await weeklyRepo.getWeeklyReport(testData.report.id, adminSession),
    );
    expect(
      frozen.readModel.leadSections.map(({ authorName }) => authorName),
    ).toEqual([...RUSSIAN_ORDER]);
  });
});
