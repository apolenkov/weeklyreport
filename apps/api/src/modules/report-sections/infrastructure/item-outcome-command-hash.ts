import { createHash } from "node:crypto";

import type {
  PromotePlanInput,
  ResolvePlanInput,
  RestorePlanInput,
} from "@weeklyreport/shared";

export type OutcomeCommandOperation = "resolve" | "restore" | "promote";
type OutcomeCommand = ResolvePlanInput | RestorePlanInput | PromotePlanInput;

// Version is a concurrency precondition, not command intent: a retry after
// reconciling the latest section must return the original receipt unchanged.
export function outcomeCommandHash(
  command: OutcomeCommand,
  operation: OutcomeCommandOperation,
): string {
  const resolve = command as ResolvePlanInput;
  const transition = command as PromotePlanInput | RestorePlanInput;
  const intent =
    operation === "resolve"
      ? {
          operation: "resolve",
          reportSectionId: resolve.reportSectionId,
          source:
            resolve.source.kind === "current"
              ? { kind: "current", recordId: resolve.source.recordId }
              : {
                  kind: "prior",
                  reportId: resolve.source.reportId,
                  recordId: resolve.source.recordId,
                },
          outcome: resolve.outcome,
          text: resolve.text,
          nextStepText: resolve.nextStepText,
          stageNames:
            resolve.stageNames === undefined
              ? undefined
              : // Code-unit order: the hash must be identical across ICU
                // versions and process locales (localeCompare is not).
                [...new Set(resolve.stageNames)].sort((a, b) =>
                  a < b ? -1 : a > b ? 1 : 0,
                ),
          priorityRank: resolve.priorityRank,
          parent:
            resolve.parent === undefined
              ? undefined
              : { kind: resolve.parent.kind, id: resolve.parent.id },
          reason: resolve.reason,
        }
      : {
          operation,
          reportSectionId: transition.reportSectionId,
          recordId: transition.recordId,
          ...(operation === "promote"
            ? { target: (transition as PromotePlanInput).target ?? "current" }
            : {}),
        };
  return createHash("sha256").update(JSON.stringify(intent)).digest("hex");
}
