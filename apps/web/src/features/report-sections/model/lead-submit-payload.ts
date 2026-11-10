import {
  type DraftSaveContent,
  toActivityStatusPayload,
} from "./lead-section-draft-payload";

// A detail as the draft carries it: text once written, otherwise missing.
const written = (detail: unknown): string | null =>
  typeof detail === "string" ? detail : null;

/** A saved risk or decision that still misses a detail a submission needs. */
export interface UnfinishedDraftRecord {
  readonly kind: "risk" | "decision";
  readonly key: string;
  readonly label: string;
}

/**
 * The unfinished risks and decisions a draft carries. They are saved for the
 * author but cannot be submitted, so each one blocks the submission by name.
 */
export function unfinishedDraftRecords(
  draftPayload: DraftSaveContent,
): readonly UnfinishedDraftRecord[] {
  const risks = draftPayload.risks.flatMap((risk, index) =>
    written(risk.impact) === null || written(risk.mitigation) === null
      ? [
          {
            kind: "risk" as const,
            key: risk.stableId ?? risk.id ?? String(index),
            label: `Finish the risk "${risk.risk}": add its impact and mitigation.`,
          },
        ]
      : [],
  );
  const decisions = draftPayload.decisions.flatMap((decision, index) =>
    written(decision.impact) === null
      ? [
          {
            kind: "decision" as const,
            key: decision.stableId ?? decision.id ?? String(index),
            label: `Finish the decision "${decision.text}": add its impact.`,
          },
        ]
      : [],
  );
  return [...risks, ...decisions];
}

/**
 * The submission built from a draft. Only finished risks and decisions travel:
 * callers refuse to submit while `unfinishedDraftRecords` is not empty, so
 * nothing the author saved is dropped by a submission.
 */
export function buildLeadSubmitPayload(
  draftPayload: DraftSaveContent,
  version: number,
) {
  return {
    ...draftPayload,
    version,
    risks: draftPayload.risks.flatMap((risk) => {
      const impact = written(risk.impact);
      const mitigation = written(risk.mitigation);
      return impact === null || mitigation === null
        ? []
        : [{ ...risk, impact, mitigation }];
    }),
    decisions: draftPayload.decisions.flatMap((decision) => {
      const impact = written(decision.impact);
      return impact === null ? [] : [{ ...decision, impact }];
    }),
    projectStatuses: draftPayload.projectStatuses.map((status) => ({
      projectId: status.projectId,
      status: status.status ?? ("green" as const),
    })),
    activityStatuses: (draftPayload.activityStatuses ?? []).map((status) =>
      toActivityStatusPayload({ ...status, status: status.status ?? "green" }),
    ),
    stageStatuses: (draftPayload.stageStatuses ?? []).map((status) => ({
      ...status,
      status: status.status ?? ("green" as const),
    })),
    confirmed: true as const,
  };
}
