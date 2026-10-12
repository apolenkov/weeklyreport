import { Prisma } from "@prisma/client";
import type { SearchHit } from "@weeklyreport/shared";

import type { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { SearchRepository } from "./application/search.service.js";

interface RawPublishedHit {
  readonly type: "item" | "risk" | "decision";
  readonly id: string;
  readonly title: string;
  readonly snippet: string;
  readonly rank: number;
  readonly projectId: string | null;
  readonly reportId: string;
  readonly reportSectionId: string;
  readonly createdAt: Date;
}

type SearchParams = Parameters<SearchRepository["search"]>[0];
type PublishedRecordType = RawPublishedHit["type"];

const TITLE_TRUNCATE_LENGTH = 120;
const PUBLISHED_RECORD_TYPES = ["item", "risk", "decision"] as const;

function buildPublishedSearchQuery(
  params: SearchParams,
  includedTypes: readonly PublishedRecordType[],
): Prisma.Sql {
  const typeValues = includedTypes.map(
    (type) => Prisma.sql`${type}::"PublishedSearchRecordType"`,
  );
  const groupFilter =
    params.groupIds === null
      ? Prisma.empty
      : Prisma.sql`AND document."groupId" IN (${Prisma.join(params.groupIds)})`;
  const headlineOpts = "MaxWords=12,MinWords=4,StartSel=<<,StopSel=>>";

  return Prisma.sql`
    SELECT
      document."recordType"::text AS "type",
      document."recordId" AS "id",
      substring(regexp_replace(document."title", '\\s+', ' ', 'g') from 1 for ${TITLE_TRUNCATE_LENGTH}) AS "title",
      ts_headline(
        'russian', document."searchText", plainto_tsquery('russian', ${params.q}), ${headlineOpts}
      ) AS "snippet",
      ts_rank(
        document."searchTsv", plainto_tsquery('russian', ${params.q})
      )::float8 AS "rank",
      document."projectId",
      document."reportId",
      document."reportSectionId",
      document."createdAt"
    FROM "PublishedSearchDocument" document
    INNER JOIN "Report" report
      ON report."id" = document."reportId"
      AND report."periodStatus" = 'published'::"PeriodStatus"
    WHERE document."searchTsv" @@ plainto_tsquery('russian', ${params.q})
      AND document."recordType" IN (${Prisma.join(typeValues)})
      ${groupFilter}
    ORDER BY "rank" DESC, document."createdAt" DESC,
      document."reportId" DESC, document."recordId" DESC
    LIMIT ${params.limit}
  `;
}

function toSearchHit(row: RawPublishedHit): SearchHit {
  return {
    type: row.type,
    id: row.id,
    title: row.title,
    snippet: row.snippet,
    rank: typeof row.rank === "number" ? row.rank : Number(row.rank),
    ...(row.projectId ? { projectId: row.projectId } : {}),
    reportId: row.reportId,
    reportSectionId: row.reportSectionId,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Runs one bounded GIN-backed query over immutable publication documents. */
export async function searchPublishedDocuments(
  prisma: PrismaService,
  params: SearchParams,
): Promise<SearchHit[]> {
  const includedTypes = PUBLISHED_RECORD_TYPES.filter(
    (type) => !params.excludeTypes.includes(type),
  );
  if (includedTypes.length === 0) return [];

  const rows = await prisma.$queryRaw<RawPublishedHit[]>(
    buildPublishedSearchQuery(params, includedTypes),
  );
  return rows.map(toSearchHit);
}
