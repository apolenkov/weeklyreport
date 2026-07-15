import type { SearchHit } from "@customreport/shared";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { SearchRepository } from "./search.service.js";

interface RawHit {
  type: "item" | "risk" | "decision" | "project";
  id: string;
  title: string;
  snippet: string;
  rank: number;
  projectId: string | null;
  reportId: string | null;
  reportSectionId: string | null;
  createdAt: Date;
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

/**
 * Builds the shared bound SQL fragments used by each result-type chunk.
 *
 * Safety: `q` flows through `Prisma.sql` parameter binding only — never
 * spliced into the SQL text. `plainto_tsquery('russian', $param)` auto-
 * sanitises operator chars (`&`, `|`, `!`, `:`), so a malicious
 * `q='foo & bar'` is treated as the two tokens "foo" and "bar", not an
 * injected operator.
 */
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
  // The `published` scope gates on `periodStatus` — the lifecycle column —
  // NOT `status` (the list column, which can stay 'published' on a reopened
  // period whose content is unreadable). Projects join no section, so they
  // carry no published gate.
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

/** Builds the complete parenthesized Item result chunk. */
function buildItemChunk(context: SearchSqlContext): Prisma.Sql {
  const { q, headlineOpts, perType } = context;
  return Prisma.sql`(
    SELECT
      'item'::text AS "type", i."id"::text AS "id",
      substring(regexp_replace(i."text", '\\s+', ' ', 'g') from 1 for 120) AS "title",
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

/** Builds the complete parenthesized Risk result chunk. */
function buildRiskChunk(context: SearchSqlContext): Prisma.Sql {
  const { q, headlineOpts, perType } = context;
  return Prisma.sql`(
    SELECT
      'risk'::text AS "type", r."id"::text AS "id",
      substring(regexp_replace(r."risk", '\\s+', ' ', 'g') from 1 for 120) AS "title",
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

/** Builds the complete parenthesized Decision result chunk. */
function buildDecisionChunk(context: SearchSqlContext): Prisma.Sql {
  const { q, headlineOpts, perType } = context;
  return Prisma.sql`(
    SELECT
      'decision'::text AS "type", d."id"::text AS "id",
      substring(regexp_replace(d."text", '\\s+', ' ', 'g') from 1 for 120) AS "title",
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

/** Builds the complete parenthesized Project result chunk. */
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

/** Uniformly omits every excluded type before the UNION is assembled. */
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

/** Joins present chunks without leaving a leading or trailing UNION ALL. */
function buildSearchQuery(chunks: readonly Prisma.Sql[], limit: number) {
  return Prisma.sql`
    SELECT * FROM (${Prisma.join(chunks, " UNION ALL ")}) hits
    ORDER BY "rank" DESC, "createdAt" DESC
    LIMIT ${limit}
  `;
}

/** Converts a raw SQL row to the shared search-hit contract. */
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

/** Prisma-backed full-text search across all uniformly excludable hit types. */
@Injectable()
export class SearchPrismaRepository implements SearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async search(params: SearchParams): Promise<SearchHit[]> {
    const chunks = buildIncludedChunks(
      buildSqlContext(params),
      params.excludeTypes,
    );
    if (chunks.length === 0) return [];

    const query = buildSearchQuery(chunks, params.limit);
    const rows = await this.prisma.$queryRaw<RawHit[]>(query);
    return rows.map(toSearchHit);
  }
}
