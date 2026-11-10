// Own history never tells how many unfinished drafts a section holds unless
// the reader is its currently entitled author (openspec:
// lead-retained-incomplete-records, "Private draft entitlement is consistent
// across own reads"). The card's totals are those of the report.
import { describe, expect, it, vi } from "vitest";

import {
  baseRow,
  fullDecision,
  fullRisk,
  OWNED_PROJECT,
} from "./__tests__/report-sections-prisma-harness.js";
import { queryMyHistoryPage } from "./report-sections.my-history-query.js";

const SECTION_ID = "a0000000-0000-4000-8000-000000000011";
const AUTHOR_ID = "a0000000-0000-4000-8000-000000000001";
const DRAFT_ONLY_PRODUCT = "a0000000-0000-4000-8000-000000000021";
const AT = new Date("2026-04-14T12:00:00Z");

const product = (projectId: string) => ({
  projectId,
  project: { name: "Product" },
  stageNames: ["Development"],
});

// One finished risk, plus an unfinished risk and decision on another Product.
function liveRow() {
  return {
    ...baseRow({
      id: SECTION_ID,
      risks: [
        fullRisk(product(OWNED_PROJECT)),
        {
          ...fullRisk({
            ...product(DRAFT_ONLY_PRODUCT),
            id: "a0000000-0000-4000-8000-000000000031",
          }),
          mitigation: null,
        },
      ],
      decisions: [
        {
          ...fullDecision({
            productId: DRAFT_ONLY_PRODUCT,
            project: { name: "Product" },
            stageNames: ["Development"],
          }),
          impact: null,
        },
      ],
    }),
    createdAt: AT,
    updatedAt: AT,
    report: {
      id: "a0000000-0000-4000-8000-000000000012",
      periodStart: AT,
      periodEnd: new Date(AT.getTime() + 4 * 86_400_000),
      status: "draft",
      archived: false,
      periodStatus: "open",
      publishedAt: null,
    },
  };
}

// The second section read is the entitlement-filtered retained count.
function historyFor(entitledSources: unknown[]) {
  const findSections = vi
    .fn()
    .mockResolvedValueOnce([liveRow()])
    .mockResolvedValueOnce(entitledSources);
  const client = {
    reportSection: { findMany: findSections },
    report: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
  const prisma = {
    $transaction: (operation: (tx: typeof client) => unknown) =>
      Promise.resolve(operation(client)),
  } as never;
  return {
    findSections,
    page: queryMyHistoryPage(prisma, AUTHOR_ID, { limit: 20 }),
  };
}

describe("queryMyHistoryPage — unfinished drafts stay out of the card", () => {
  it("counts only finished records for an author who lost the authoring role", async () => {
    const { findSections, page } = historyFor([]);
    const [entry] = (await page).items;

    expect(entry).toMatchObject({ riskCount: 1, decisionCount: 0 });
    // The Product that holds nothing but drafts is not counted either.
    expect(entry?.productCount).toBe(1);
    expect(entry?.retainedDrafts).toBeUndefined();
    // Entitlement comes from the database row, not from the session.
    expect(findSections.mock.calls[1]?.[0]).toMatchObject({
      where: {
        authorId: AUTHOR_ID,
        author: { isActive: true, role: { in: ["lead", "head", "admin"] } },
      },
    });
  });

  it("tells the entitled author the draft count apart from the report totals", async () => {
    const source = {
      id: SECTION_ID,
      reportId: "a0000000-0000-4000-8000-000000000012",
      report: { status: "draft", periodStatus: "open", archived: false },
      risks: [
        { impact: "Impact", mitigation: "Mitigation" },
        { impact: "Impact", mitigation: null },
      ],
      decisions: [{ impact: null }],
    };
    const [entry] = (await historyFor([source]).page).items;

    expect(entry).toMatchObject({
      riskCount: 1,
      decisionCount: 0,
      retainedDrafts: { risks: 1, decisions: 1 },
    });
  });
});
