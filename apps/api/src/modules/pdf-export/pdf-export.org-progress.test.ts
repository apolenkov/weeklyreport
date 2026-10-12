import type {
  PublishedReportSnapshot,
  UserSession,
} from "@weeklyreport/shared";
import { describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { PdfExportPrismaRepository } from "./pdf-export.prisma-repository";

const REPORT_ID = "659b2767-0f86-41e2-b025-49730ca010e4";
const authorIds = Array.from(
  { length: 9 },
  (_, index) => `00000000-0000-4000-8000-0000000001${index}0`,
);
const full = {
  reportId: REPORT_ID,
  sections: authorIds.map((authorId) => ({ authorId, status: "submitted" })),
} as unknown as PublishedReportSnapshot;

// Scoping is covered in report-sections; the stub keeps 7 of 9 sections.
vi.mock("../report-sections/index.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../report-sections/index.js")>()),
  publishedReportScopeWhere: () => ({}),
  requirePublishedSnapshot: (snapshot: PublishedReportSnapshot) => snapshot,
  requireScopedPublishedSnapshot: (snapshot: PublishedReportSnapshot) => ({
    ...snapshot,
    sections: snapshot.sections.slice(0, 7),
  }),
}));

function repoFor() {
  const tx = {
    report: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: REPORT_ID, publishedSnapshot: full }),
    },
  };
  return new PdfExportPrismaRepository({
    $transaction: (cb: (t: unknown) => unknown) => cb(tx),
  } as unknown as PrismaService);
}

describe("getPublishedReportForExport org-wide progress", () => {
  it("freezes the org-wide count for a group-scoped head", async () => {
    const result = await repoFor().getPublishedReportForExport(REPORT_ID, {
      role: "head",
    } as UserSession);
    expect(result).toMatchObject({
      orgProgress: { submitted: 9, total: 9 },
    });
    expect(result?.sections).toHaveLength(7);
  });

  it("adds no org progress for a viewer", async () => {
    const result = await repoFor().getPublishedReportForExport(REPORT_ID, {
      role: "viewer",
    } as UserSession);
    expect(result).not.toHaveProperty("orgProgress");
  });
});
