import type { SearchHit } from "@customreport/shared";
import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import type { SearchRepository } from "./search.service.js";

/**
 * Row shape returned by every UNION ALL chunk. All four chunks project the
 * same column list so the union compiles, then post-processing folds them
 * into typed SearchHit records.
 */
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

/**
 * 39-05 (PERF-05): Prisma repository for full-text search.
 *
 * Strategy: one $queryRaw with four UNION ALL chunks (Item, Risk, Decision,
 * Project), each chunk filtering its own `searchTsv @@ plainto_tsquery`,
 * ranked by `ts_rank`, snippeted by `ts_headline`, and limited to the
 * requested cap. The outer query orders by rank desc and slices to the
 * caller's limit.
 *
 * Why one query (not four parallel queries):
 *   - Postgres can plan the four GIN scans together and the result set is
 *     small (≤ limit per type, ≤ 200 rows worst case).
 *   - One round-trip beats four for the typical 20-row response.
 *   - The UNION ALL contract keeps the column shape deterministic for the
 *     RawHit projection.
 *
 * Safety: `q` flows through `Prisma.sql` parameter binding only. We never
 * splice it into the SQL text. `plainto_tsquery('russian', $param)` auto-
 * sanitises operator chars (`&`, `|`, `!`, `:`) — a malicious `q='foo & bar'`
 * is treated as the two tokens "foo" and "bar", not an injected operator.
 */
@Injectable()
export class SearchPrismaRepository implements SearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async search(params: {
    q: string;
    scope: "mine" | "all" | "published";
    userId: string;
    groupIds: string[] | null;
    excludeTypes: SearchHit["type"][];
    limit: number;
  }): Promise<SearchHit[]> {
    const { q, scope, userId, groupIds, excludeTypes, limit } = params;

    // Per-type limit BEFORE the union — keeps the worker query bounded
    // even when one type matches thousands of rows.
    const perType = limit;

    // Headline options: keep the markers consistent with the UI parser.
    const headlineOpts = "MaxWords=12,MinWords=4,StartSel=<<,StopSel=>>";

    // Mine-scope FK gates expressed as Prisma.sql fragments so we can
    // splice them into the UNION ALL with bound `userId`. For scope='all'
    // we splice an empty fragment.
    const itemMineFilter =
      scope === "mine"
        ? Prisma.sql`AND rs."authorId" = ${userId}`
        : Prisma.empty;
    const riskMineFilter =
      scope === "mine"
        ? Prisma.sql`AND rs."authorId" = ${userId}`
        : Prisma.empty;
    const decisionMineFilter =
      scope === "mine"
        ? Prisma.sql`AND rs."authorId" = ${userId}`
        : Prisma.empty;
    const projectMineFilter =
      scope === "mine" ? Prisma.sql`AND p."leadId" = ${userId}` : Prisma.empty;

    // TD-03: group-scope filters derived from the session's allowed group IDs.
    // null (admin) → no filter. Non-empty array → subquery against User.reportingGroupId.
    // The service guarantees groupIds is never an empty array here.
    const sectionGroupFilter =
      groupIds === null
        ? Prisma.empty
        : Prisma.sql`AND rs."authorId" IN (SELECT "id" FROM "User" WHERE "reportingGroupId" IN (${Prisma.join(groupIds)}))`;
    const projectGroupFilter =
      groupIds === null
        ? Prisma.empty
        : Prisma.sql`AND p."leadId" IN (SELECT "id" FROM "User" WHERE "reportingGroupId" IN (${Prisma.join(groupIds)}))`;

    // viewer-report-surface-parity (Decision 1): the `published` scope adds an
    // INNER JOIN to "Report" gated on `periodStatus = 'published'` for the
    // item/risk/decision chunks. This is the SAME column the viewer content
    // read gates on (`weekly-report.service.ts`: NOT_FOUND when
    // `periodStatus !== 'published'`), NOT `status` (the list column, which can
    // stay 'published' on a reopened period whose content is unreadable). The
    // join reaches Report via `rs."reportId"`, which every chunk already has.
    // For 'mine'/'all' this stays empty — those scopes are unchanged. The
    // `project` chunk has no Report and is excluded for the only consumer
    // (viewer), so it carries no published gate.
    const publishedReportJoin =
      scope === "published"
        ? Prisma.sql`INNER JOIN "Report" rpt ON rpt."id" = rs."reportId" AND rpt."periodStatus" = 'published'::"PeriodStatus"`
        : Prisma.empty;

    // Excluded types are omitted from the query entirely (chunk + its leading
    // UNION ALL), so they never consume a slot in the outer `LIMIT`. Only the
    // `project` chunk is currently excludable (the lead-role rule); guard each
    // optional chunk the same way if more become excludable.
    const projectChunk = excludeTypes.includes("project")
      ? Prisma.empty
      : Prisma.sql`
        UNION ALL
        (
          SELECT
            'project'::text AS "type",
            p."id"::text AS "id",
            p."name" AS "title",
            ts_headline('russian', p."name", plainto_tsquery('russian', ${q}), ${headlineOpts}) AS "snippet",
            ts_rank(p."searchTsv", plainto_tsquery('russian', ${q}))::float8 AS "rank",
            p."id"::text AS "projectId",
            NULL::text AS "reportId",
            NULL::text AS "reportSectionId",
            p."createdAt" AS "createdAt"
          FROM "Project" p
          WHERE p."searchTsv" @@ plainto_tsquery('russian', ${q})
          ${projectMineFilter}
          ${projectGroupFilter}
          ORDER BY "rank" DESC, p."createdAt" DESC
          LIMIT ${perType}
        )`;

    const rows = await this.prisma.$queryRaw<RawHit[]>(Prisma.sql`
      SELECT * FROM (
        (
          SELECT
            'item'::text AS "type",
            i."id"::text AS "id",
            -- Title: first 120 chars of the matched text (trimmed, single line)
            substring(regexp_replace(i."text", '\\s+', ' ', 'g') from 1 for 120) AS "title",
            ts_headline('russian', i."text", plainto_tsquery('russian', ${q}), ${headlineOpts}) AS "snippet",
            ts_rank(i."searchTsv", plainto_tsquery('russian', ${q}))::float8 AS "rank",
            i."projectId"::text AS "projectId",
            rs."reportId"::text AS "reportId",
            i."reportSectionId"::text AS "reportSectionId",
            i."createdAt" AS "createdAt"
          FROM "Item" i
          INNER JOIN "ReportSection" rs ON rs."id" = i."reportSectionId"
          ${publishedReportJoin}
          WHERE i."searchTsv" @@ plainto_tsquery('russian', ${q})
          ${itemMineFilter}
          ${sectionGroupFilter}
          ORDER BY "rank" DESC, i."createdAt" DESC
          LIMIT ${perType}
        )
        UNION ALL
        (
          SELECT
            'risk'::text AS "type",
            r."id"::text AS "id",
            substring(regexp_replace(r."risk", '\\s+', ' ', 'g') from 1 for 120) AS "title",
            ts_headline(
              'russian',
              coalesce(r."risk", '') || ' — ' || coalesce(r."impact", '') || ' — ' || coalesce(r."mitigation", ''),
              plainto_tsquery('russian', ${q}),
              ${headlineOpts}
            ) AS "snippet",
            ts_rank(r."searchTsv", plainto_tsquery('russian', ${q}))::float8 AS "rank",
            r."projectId"::text AS "projectId",
            rs."reportId"::text AS "reportId",
            r."reportSectionId"::text AS "reportSectionId",
            r."createdAt" AS "createdAt"
          FROM "Risk" r
          INNER JOIN "ReportSection" rs ON rs."id" = r."reportSectionId"
          ${publishedReportJoin}
          WHERE r."searchTsv" @@ plainto_tsquery('russian', ${q})
          ${riskMineFilter}
          ${sectionGroupFilter}
          ORDER BY "rank" DESC, r."createdAt" DESC
          LIMIT ${perType}
        )
        UNION ALL
        (
          SELECT
            'decision'::text AS "type",
            d."id"::text AS "id",
            substring(regexp_replace(d."text", '\\s+', ' ', 'g') from 1 for 120) AS "title",
            ts_headline('russian', d."text", plainto_tsquery('russian', ${q}), ${headlineOpts}) AS "snippet",
            ts_rank(d."searchTsv", plainto_tsquery('russian', ${q}))::float8 AS "rank",
            NULL::text AS "projectId",
            rs."reportId"::text AS "reportId",
            d."reportSectionId"::text AS "reportSectionId",
            d."createdAt" AS "createdAt"
          FROM "Decision" d
          INNER JOIN "ReportSection" rs ON rs."id" = d."reportSectionId"
          ${publishedReportJoin}
          WHERE d."searchTsv" @@ plainto_tsquery('russian', ${q})
          ${decisionMineFilter}
          ${sectionGroupFilter}
          ORDER BY "rank" DESC, d."createdAt" DESC
          LIMIT ${perType}
        )${projectChunk}
      ) hits
      ORDER BY "rank" DESC, "createdAt" DESC
      LIMIT ${limit}
    `);

    return rows.map(
      (r): SearchHit => ({
        type: r.type,
        id: r.id,
        title: r.title,
        snippet: r.snippet,
        rank: typeof r.rank === "number" ? r.rank : Number(r.rank),
        ...(r.projectId ? { projectId: r.projectId } : {}),
        ...(r.reportId ? { reportId: r.reportId } : {}),
        ...(r.reportSectionId ? { reportSectionId: r.reportSectionId } : {}),
        createdAt: r.createdAt.toISOString(),
      }),
    );
  }
}
