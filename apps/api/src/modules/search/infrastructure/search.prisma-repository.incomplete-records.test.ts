// Live search never returns an unfinished risk or decision, not even to its
// author (openspec: search-contract-precision). The filter sits in each
// chunk's WHERE clause, so a draft cannot take a result slot or feed a snippet.
import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { SearchPrismaRepository } from "./search.prisma-repository.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const GROUP_ID = "22222222-2222-4222-8222-222222222222";

const RISK_FILTER = `r."impact" IS NOT NULL AND r."mitigation" IS NOT NULL`;
const DECISION_FILTER = `d."impact" IS NOT NULL`;

type SearchParams = Parameters<SearchPrismaRepository["search"]>[0];

async function liveSearchSql(
  overrides: Partial<SearchParams> = {},
): Promise<string> {
  const queryRaw = vi.fn().mockResolvedValue([]);
  const repo = new SearchPrismaRepository({ $queryRaw: queryRaw } as never);
  await repo.search({
    q: "delay",
    scope: "all",
    userId: USER_ID,
    groupIds: [GROUP_ID],
    limit: 10,
    excludeTypes: [],
    ...overrides,
  });
  const [query] = queryRaw.mock.calls[0] as [Prisma.Sql];
  return query.sql;
}

// The text of one UNION chunk: from its FROM clause to its own LIMIT.
function chunkFrom(sql: string, table: string): string {
  const start = sql.indexOf(`FROM "${table}"`);
  expect(start).toBeGreaterThan(-1);
  return sql.slice(start, sql.indexOf("LIMIT", start));
}

describe("SearchPrismaRepository — unfinished risks and decisions", () => {
  it.each(["all", "mine"] as const)(
    "filters unfinished risks and decisions before the limit in %s search",
    async (scope) => {
      const sql = await liveSearchSql({ scope });

      expect(chunkFrom(sql, "Risk")).toContain(RISK_FILTER);
      expect(chunkFrom(sql, "Decision")).toContain(DECISION_FILTER);
    },
  );

  it("leaves item and project search as it was", async () => {
    const sql = await liveSearchSql();

    expect(chunkFrom(sql, "Item")).not.toContain("IS NOT NULL");
    expect(chunkFrom(sql, "Project")).not.toContain(`"impact"`);
  });

  it("keeps the filter when other record kinds are excluded", async () => {
    const sql = await liveSearchSql({ excludeTypes: ["item", "project"] });

    expect(sql).not.toContain(`FROM "Item"`);
    expect(chunkFrom(sql, "Risk")).toContain(RISK_FILTER);
    expect(chunkFrom(sql, "Decision")).toContain(DECISION_FILTER);
  });
});
