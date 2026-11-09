import {
  isCompleteDecision,
  isCompleteRisk,
  type RecordOmission,
} from "@weeklyreport/shared";

import type { PrismaReportSectionWithRelations as SectionRow } from "../report-sections.include.js";

type Bucket = RecordOmission["buckets"][number];

interface OmittedRecord {
  readonly kind: Bucket["kind"];
  readonly productId: string | null;
  readonly activityId: string | null;
  readonly stageNames: readonly string[];
}

// Code-unit order, matching the canonical-set rule of the bucket schema;
// locale order could rank two names the other way round.
const byCodeUnit = (left: string, right: string): number =>
  left < right ? -1 : Number(left > right);

const canonicalStages = (stageNames: readonly string[]): string[] =>
  [...new Set(stageNames)].toSorted(byCodeUnit);

function toBucketScope(record: OmittedRecord): Omit<Bucket, "count"> {
  if (record.productId !== null) {
    return {
      kind: record.kind,
      parentKind: "product",
      parentId: record.productId,
      stageNames: canonicalStages(record.stageNames),
    };
  }
  if (record.activityId !== null) {
    return {
      kind: record.kind,
      parentKind: "activity",
      parentId: record.activityId,
      stageNames: [],
    };
  }
  throw new Error("An omitted record must name a Product or an Activity");
}

/**
 * Counts the incomplete risks and decisions a frozen section leaves out,
 * grouped by record kind, parent and stage set. Buckets carry no record
 * identity or text, and come from the same raw row the complete content is
 * projected from, so the two cannot disagree.
 */
export function toRecordOmission(row: SectionRow): RecordOmission {
  const omitted: readonly OmittedRecord[] = [
    ...row.risks
      .filter((risk) => !isCompleteRisk(risk))
      .map((risk) => ({
        kind: "risk" as const,
        productId: risk.projectId,
        activityId: risk.activityId,
        stageNames: risk.stageNames,
      })),
    ...row.decisions
      .filter((decision) => !isCompleteDecision(decision))
      .map((decision) => ({
        kind: "decision" as const,
        productId: decision.productId,
        activityId: decision.activityId,
        stageNames: decision.stageNames,
      })),
  ];
  const scopes = omitted.map(toBucketScope);
  const byKey = Map.groupBy(scopes, (scope) => JSON.stringify(scope));
  const buckets = [...byKey.entries()]
    .toSorted(([left], [right]) => byCodeUnit(left, right))
    .flatMap(([, group]) => {
      const [head] = group;
      return head ? [{ ...head, count: group.length }] : [];
    });
  return { version: 1, buckets };
}
