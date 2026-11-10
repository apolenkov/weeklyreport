import { Prisma } from "@prisma/client";
import type { RecordOmissionSummary } from "@weeklyreport/shared";

import type { SearchRepository } from "../application/search.service.js";

type OmissionParams = Omit<
  Parameters<SearchRepository["search"]>[0],
  "q" | "limit"
>;

interface RawOmissionTotals {
  readonly risks: number;
  readonly decisions: number;
  readonly unknown: boolean;
}

// Live corpus: the unfinished rows the same author and group filters admit,
// counted before any text match (openspec: search-contract-precision).
function buildLiveOmissionQuery(params: OmissionParams): Prisma.Sql {
  const mineFilter =
    params.scope === "mine"
      ? Prisma.sql`AND rs."authorId" = ${params.userId}`
      : Prisma.empty;
  const groupFilter =
    params.groupIds === null
      ? Prisma.empty
      : Prisma.sql`AND rs."authorId" IN (SELECT "id" FROM "User" WHERE "reportingGroupId" IN (${Prisma.join(params.groupIds)}))`;
  return Prisma.sql`
    SELECT
      (
        SELECT count(*) FROM "Risk" r
        INNER JOIN "ReportSection" rs ON rs."id" = r."reportSectionId"
        WHERE (r."impact" IS NULL OR r."mitigation" IS NULL)
        ${mineFilter} ${groupFilter}
      )::int AS "risks",
      (
        SELECT count(*) FROM "Decision" d
        INNER JOIN "ReportSection" rs ON rs."id" = d."reportSectionId"
        WHERE d."impact" IS NULL
        ${mineFilter} ${groupFilter}
      )::int AS "decisions",
      false AS "unknown"
  `;
}

// Published corpus: totals frozen with each admitted section's scope row. A
// section frozen before omissions were counted makes the answer unknown.
function buildPublishedOmissionQuery(params: OmissionParams): Prisma.Sql {
  const groupFilter =
    params.groupIds === null
      ? Prisma.empty
      : Prisma.sql`AND scope."groupId" IN (${Prisma.join(params.groupIds)})`;
  return Prisma.sql`
    SELECT
      coalesce(sum(scope."omittedRisks"), 0)::int AS "risks",
      coalesce(sum(scope."omittedDecisions"), 0)::int AS "decisions",
      coalesce(
        bool_or(scope."omittedRisks" IS NULL OR scope."omittedDecisions" IS NULL),
        false
      ) AS "unknown"
    FROM "PublishedSectionScope" scope
    INNER JOIN "Report" report
      ON report."id" = scope."reportId"
      AND report."periodStatus" = 'published'::"PeriodStatus"
    WHERE true ${groupFilter}
  `;
}

/**
 * Counts the unfinished risks and decisions a search corpus leaves out. An
 * excluded record kind contributes nothing, as it is not part of the corpus.
 */
export async function countSearchOmissions(
  prisma: Prisma.TransactionClient,
  params: OmissionParams,
): Promise<RecordOmissionSummary> {
  if (
    params.excludeTypes.includes("risk") &&
    params.excludeTypes.includes("decision")
  ) {
    return { risks: 0, decisions: 0, unknown: false };
  }
  const query =
    params.scope === "published"
      ? buildPublishedOmissionQuery(params)
      : buildLiveOmissionQuery(params);
  const [row] = await prisma.$queryRaw<RawOmissionTotals[]>(query);
  if (!row) return { risks: 0, decisions: 0, unknown: false };
  return {
    risks: params.excludeTypes.includes("risk") ? 0 : row.risks,
    decisions: params.excludeTypes.includes("decision") ? 0 : row.decisions,
    unknown: row.unknown,
  };
}
