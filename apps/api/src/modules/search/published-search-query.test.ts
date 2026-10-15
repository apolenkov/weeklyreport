import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { SearchRepository } from "./application/search.service.js";
import { searchPublishedDocuments } from "./published-search-query.js";

const GROUP_ID = "10000000-0000-4000-8000-000000000001";
const REPORT_ID = "10000000-0000-4000-8000-000000000002";
const SECTION_ID = "10000000-0000-4000-8000-000000000003";
const RECORD_ID = "10000000-0000-4000-8000-000000000004";
const PROJECT_ID = "10000000-0000-4000-8000-000000000005";
const CREATED_AT = new Date("2026-08-24T12:00:00.000Z");

function params(
  overrides: Partial<Parameters<SearchRepository["search"]>[0]> = {},
): Parameters<SearchRepository["search"]>[0] {
  return {
    q: "release",
    scope: "published",
    userId: "10000000-0000-4000-8000-000000000006",
    groupIds: [GROUP_ID],
    excludeTypes: ["project"],
    limit: 17,
    ...overrides,
  };
}

describe("searchPublishedDocuments", () => {
  it("runs one bounded GIN-compatible query over frozen rows", async () => {
    const queryRaw = vi.fn(
      (query: { strings: readonly string[]; values: readonly unknown[] }) => {
        const sql = query.strings.join("?");
        expect(sql).toContain('FROM "PublishedSearchDocument"');
        expect(sql).toContain('document."searchTsv" @@ plainto_tsquery');
        expect(sql).toContain('document."groupId" IN');
        expect(sql).toContain("LIMIT ?");
        expect(sql).toMatch(
          /ORDER BY "rank" DESC, document\."createdAt" DESC,\s+document\."recordId" ASC, document\."reportId" ASC,\s+document\."recordType" ASC\s+LIMIT/,
        );
        expect(sql).not.toContain("publishedSnapshot");
        expect(sql).not.toContain("jsonb_to_recordset");
        expect(sql).not.toContain('JOIN "ReportSection"');
        expect(sql).not.toContain('JOIN "User"');
        expect(query.values).toContain(GROUP_ID);
        expect(query.values).toContain(17);
        return Promise.resolve([
          {
            type: "item",
            id: RECORD_ID,
            title: "Frozen release",
            snippet: "Frozen <<release>>",
            rank: 0.5,
            projectId: PROJECT_ID,
            reportId: REPORT_ID,
            reportSectionId: SECTION_ID,
            createdAt: CREATED_AT,
          },
        ]);
      },
    );
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;

    const hits = await searchPublishedDocuments(prisma, params());

    expect(hits).toEqual([
      {
        type: "item",
        id: RECORD_ID,
        title: "Frozen release",
        snippet: "Frozen <<release>>",
        rank: 0.5,
        projectId: PROJECT_ID,
        reportId: REPORT_ID,
        reportSectionId: SECTION_ID,
        createdAt: CREATED_AT.toISOString(),
      },
    ]);
    expect(queryRaw).toHaveBeenCalledOnce();
  });

  it("keeps admin published search unscoped by group", async () => {
    const queryRaw = vi.fn((query: { strings: readonly string[] }) => {
      expect(query.strings.join("?")).not.toContain('"groupId" IN');
      return Promise.resolve([]);
    });
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;

    await searchPublishedDocuments(prisma, params({ groupIds: null }));

    expect(queryRaw).toHaveBeenCalledOnce();
  });

  it("skips SQL when every frozen record type is excluded", async () => {
    const queryRaw = vi.fn();
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;

    const hits = await searchPublishedDocuments(
      prisma,
      params({ excludeTypes: ["item", "risk", "decision", "project"] }),
    );

    expect(hits).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
