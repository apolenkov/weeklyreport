import type { SearchHit } from "@customreport/shared";
import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { SearchRepository } from "./search.service.js";

interface RawHit {
  readonly type: "item" | "risk" | "decision" | "project";
  readonly id: string;
  readonly title: string;
  readonly snippet: string;
  readonly rank: number;
  readonly projectId: string | null;
  readonly reportId: string | null;
  readonly reportSectionId: string | null;
  readonly createdAt: Date;
}

interface SearchSqlContext {
  readonly q: string;
  readonly headlineOpts: string;
  readonly perType: number;
  readonly sectionMineFilter: Prisma.Sql;
  readonly projectMineFilter: Prisma.Sql;
  readonly sectionGroupFilter: Prisma.Sql;
  readonly projectGroupFilter: Prisma.Sql;
  readonly publishedReportJoin: Prisma.Sql;
}

type SearchParams = Parameters<SearchRepository["search"]>[0];

// Cap for hit titles in SQL (substring ... for N); keep UI snippets short.
const TITLE_TRUNCATE_LENGTH = 120;

// `q` is Prisma.sql-bound only; plainto_tsquery sanitises operators so
// `q='foo & bar'` becomes two tokens, not injected SQL operators.
function buildSqlContext(params: SearchParams): SearchSqlContext {
  const { q, scope, userId, groupIds, limit } = params;
  const sectionMineFilter =
    scope === "mine" ? Prisma.sql`AND rs."authorId" = ${userId}` : Prisma.empty;
  const projectMineFilter =
    scope === "mine" ? Prisma.sql`AND p."leadId" = ${userId}` : Prisma.empty;
  const sectionGroupFilter =
    groupIds === null
      ? Prisma.empty
      : Prisma.sql`AND rs."authorId" IN (SELECT "id" FROM "User" WHERE "reportingGroupId" IN (${Prisma.join(groupIds)}))`;
  const projectGroupFilter =
    groupIds === null
      ? Prisma.empty
      : Prisma.sql`AND p."leadId" IN (SELECT "id" FROM "User" WHERE "reportingGroupId" IN (${Prisma.join(groupIds)}))`;
  // The `published` scope gates on `periodStatus` — the lifecycle column — NOT
  // `status` (the list column, which can stay 'published' on a reopened period
  // whose content is unreadable). Projects join no section, so no published gate.
  const publishedReportJoin =
    scope === "published"
      ? Prisma.sql`INNER JOIN "Report" rpt ON rpt."id" = rs."reportId" AND rpt."periodStatus" = 'published'::"PeriodStatus"`
      : Prisma.empty;

  return {
    q,
    headlineOpts: "MaxWords=12,MinWords=4,StartSel=<<,StopSel=>>",
    perType: limit,
    sectionMineFilter,
    projectMineFilter,
    sectionGroupFilter,
    projectGroupFilter,
    publishedReportJoin,
  };
}

function buildItemChunk(context: SearchSqlContext): Prisma.Sql {
  const { q, headlineOpts, perType } = context;
  return Prisma.sql`(
    SELECT
      'item'::text AS "type", i."id"::text AS "id",
      substring(regexp_replace(i."text", '\\s+', ' ', 'g') from 1 for ${TITLE_TRUNCATE_LENGTH}) AS "title",
      ts_headline('russian', i."text", plainto_tsquery('russian', ${q}), ${headlineOpts}) AS "snippet",
      ts_rank(i."searchTsv", plainto_tsquery('russian', ${q}))::float8 AS "rank",
      i."projectId"::text AS "projectId", rs."reportId"::text AS "reportId",
      i."reportSectionId"::text AS "reportSectionId", i."createdAt" AS "createdAt"
    FROM "Item" i
    INNER JOIN "ReportSection" rs ON rs."id" = i."reportSectionId"
    ${context.publishedReportJoin}
    WHERE i."searchTsv" @@ plainto_tsquery('russian', ${q})
    ${context.sectionMineFilter} ${context.sectionGroupFilter}
    ORDER BY "rank" DESC, i."createdAt" DESC
    LIMIT ${perType}
  )`;
}

function buildRiskChunk(context: SearchSqlContext): Prisma.Sql {
  const { q, headlineOpts, perType } = context;
  return Prisma.sql`(
    SELECT
      'risk'::text AS "type", r."id"::text AS "id",
      substring(regexp_replace(r."risk", '\\s+', ' ', 'g') from 1 for ${TITLE_TRUNCATE_LENGTH}) AS "title",
      ts_headline(
        'russian',
        coalesce(r."risk", '') || ' — ' || coalesce(r."impact", '') || ' — ' || coalesce(r."mitigation", ''),
        plainto_tsquery('russian', ${q}), ${headlineOpts}
      ) AS "snippet",
      ts_rank(r."searchTsv", plainto_tsquery('russian', ${q}))::float8 AS "rank",
      r."projectId"::text AS "projectId", rs."reportId"::text AS "reportId",
      r."reportSectionId"::text AS "reportSectionId", r."createdAt" AS "createdAt"
    FROM "Risk" r
    INNER JOIN "ReportSection" rs ON rs."id" = r."reportSectionId"
    ${context.publishedReportJoin}
    WHERE r."searchTsv" @@ plainto_tsquery('russian', ${q})
    ${context.sectionMineFilter} ${context.sectionGroupFilter}
    ORDER BY "rank" DESC, r."createdAt" DESC
    LIMIT ${perType}
  )`;
}

function buildDecisionChunk(context: SearchSqlContext): Prisma.Sql {
  const { q, headlineOpts, perType } = context;
  return Prisma.sql`(
    SELECT
      'decision'::text AS "type", d."id"::text AS "id",
      substring(regexp_replace(d."text", '\\s+', ' ', 'g') from 1 for ${TITLE_TRUNCATE_LENGTH}) AS "title",
      ts_headline('russian', d."text", plainto_tsquery('russian', ${q}), ${headlineOpts}) AS "snippet",
      ts_rank(d."searchTsv", plainto_tsquery('russian', ${q}))::float8 AS "rank",
      NULL::text AS "projectId", rs."reportId"::text AS "reportId",
      d."reportSectionId"::text AS "reportSectionId", d."createdAt" AS "createdAt"
    FROM "Decision" d
    INNER JOIN "ReportSection" rs ON rs."id" = d."reportSectionId"
    ${context.publishedReportJoin}
    WHERE d."searchTsv" @@ plainto_tsquery('russian', ${q})
    ${context.sectionMineFilter} ${context.sectionGroupFilter}
    ORDER BY "rank" DESC, d."createdAt" DESC
    LIMIT ${perType}
  )`;
}

function buildProjectChunk(context: SearchSqlContext): Prisma.Sql {
  const { q, headlineOpts, perType } = context;
  return Prisma.sql`(
    SELECT
      'project'::text AS "type", p."id"::text AS "id", p."name" AS "title",
      ts_headline('russian', p."name", plainto_tsquery('russian', ${q}), ${headlineOpts}) AS "snippet",
      ts_rank(p."searchTsv", plainto_tsquery('russian', ${q}))::float8 AS "rank",
      p."id"::text AS "projectId", NULL::text AS "reportId",
      NULL::text AS "reportSectionId", p."createdAt" AS "createdAt"
    FROM "Project" p
    WHERE p."searchTsv" @@ plainto_tsquery('russian', ${q})
    ${context.projectMineFilter} ${context.projectGroupFilter}
    ORDER BY "rank" DESC, p."createdAt" DESC
    LIMIT ${perType}
  )`;
}

function buildIncludedChunks(
  context: SearchSqlContext,
  excludeTypes: readonly SearchHit["type"][],
): Prisma.Sql[] {
  const chunks = [
    { type: "item", sql: buildItemChunk(context) },
    { type: "risk", sql: buildRiskChunk(context) },
    { type: "decision", sql: buildDecisionChunk(context) },
    { type: "project", sql: buildProjectChunk(context) },
  ] satisfies readonly { type: SearchHit["type"]; sql: Prisma.Sql }[];
  return chunks
    .filter(({ type }) => !excludeTypes.includes(type))
    .map(({ sql }) => sql);
}

function buildSearchQuery(chunks: readonly Prisma.Sql[], limit: number) {
  return Prisma.sql`
    SELECT * FROM (${Prisma.join(chunks, " UNION ALL ")}) hits
    ORDER BY "rank" DESC, "createdAt" DESC
    LIMIT ${limit}
  `;
}

function toSearchHit(row: RawHit): SearchHit {
  return {
    type: row.type,
    id: row.id,
    title: row.title,
    snippet: row.snippet,
    rank: typeof row.rank === "number" ? row.rank : Number(row.rank),
    ...(row.projectId ? { projectId: row.projectId } : {}),
    ...(row.reportId ? { reportId: row.reportId } : {}),
    ...(row.reportSectionId ? { reportSectionId: row.reportSectionId } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

@Injectable()
export class SearchPrismaRepository implements SearchRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  readonly search = async (params: SearchParams): Promise<SearchHit[]> => {
    const chunks = buildIncludedChunks(
      buildSqlContext(params),
      params.excludeTypes,
    );
    if (chunks.length === 0) return [];

    const query = buildSearchQuery(chunks, params.limit);
    const rows = await this.prisma.$queryRaw<RawHit[]>(query);
    return rows.map(toSearchHit);
  };
}
