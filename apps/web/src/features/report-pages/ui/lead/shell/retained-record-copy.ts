import type { RetainedIncompleteRecordsOutput } from "@weeklyreport/shared";

import { toIsoDateString } from "../../../../../shared/lib/format/format-date";
import type { RetainedDraftCopySource } from "../../../../../shared/lib/navigation/retained-draft-copy";
import type {
  DecisionInput,
  Parent,
  RiskInput,
} from "../../../../report-sections";

type SourceParent = Pick<Parent, "kind" | "id">;
export type RetainedRecordCopy = { readonly sourceParent: SourceParent } & (
  | { readonly kind: "risk"; readonly input: RiskInput }
  | { readonly kind: "decision"; readonly input: DecisionInput }
);

function sourceParent(
  productId: string | null | undefined,
  activityId: string | null | undefined,
): SourceParent | null {
  if (Boolean(productId) === Boolean(activityId)) return null;
  if (productId) return { kind: "product", id: productId };
  return activityId ? { kind: "activity", id: activityId } : null;
}

function uniqueRecord<T extends { readonly stableId: string }>(
  records: readonly T[],
  stableId: string,
): T | undefined {
  const matching = records.filter((record) => record.stableId === stableId);
  return matching.length === 1 ? matching[0] : undefined;
}

// This is source text, not target eligibility. The normal create owner chooses
// a current parent, validates stages and mints its own identity on explicit open.
export function readRetainedRecordCopy(
  data: RetainedIncompleteRecordsOutput,
  source: RetainedDraftCopySource,
): RetainedRecordCopy | null {
  if (
    data.status !== "available" ||
    data.reportId !== source.reportId ||
    data.reportSectionId !== source.reportSectionId
  )
    return null;
  if (source.kind === "risk") {
    const risk = uniqueRecord(data.risks, source.stableId);
    if (!risk) return null;
    const parent = sourceParent(risk.projectId, risk.activityId);
    return parent
      ? {
          kind: "risk",
          sourceParent: parent,
          input: {
            text: risk.risk,
            impact: risk.impact,
            mitigation: risk.mitigation,
            severity: risk.severity,
            stageNames: [...risk.stageNames],
          },
        }
      : null;
  }
  const decision = uniqueRecord(data.decisions, source.stableId);
  if (!decision) return null;
  const parent = sourceParent(decision.productId, decision.activityId);
  return parent
    ? {
        kind: "decision",
        sourceParent: parent,
        input: {
          text: decision.text,
          impact: decision.impact,
          deadline: decision.deadline ? toIsoDateString(decision.deadline) : "",
          stageNames: [...decision.stageNames],
        },
      }
    : null;
}
