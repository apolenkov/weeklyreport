import { createHash } from "node:crypto";

import type { ResolvePlanInput, RestorePlanInput } from "@customreport/shared";

// Version is a concurrency precondition, not command intent: a retry after
// reconciling the latest section must return the original receipt unchanged.
export function outcomeCommandHash(
  command: ResolvePlanInput | RestorePlanInput,
): string {
  const intent =
    "outcome" in command
      ? {
          operation: "resolve",
          reportSectionId: command.reportSectionId,
          source:
            command.source.kind === "current"
              ? { kind: "current", recordId: command.source.recordId }
              : {
                  kind: "prior",
                  reportId: command.source.reportId,
                  recordId: command.source.recordId,
                },
          outcome: command.outcome,
          text: command.text,
          nextStepText: command.nextStepText,
          stageNames:
            command.stageNames === undefined
              ? undefined
              : [...new Set(command.stageNames)].sort((a, b) =>
                  a.localeCompare(b),
                ),
          priorityRank: command.priorityRank,
          parent:
            command.parent === undefined
              ? undefined
              : { kind: command.parent.kind, id: command.parent.id },
          reason: command.reason,
        }
      : {
          operation: "restore",
          reportSectionId: command.reportSectionId,
          recordId: command.recordId,
        };
  return createHash("sha256").update(JSON.stringify(intent)).digest("hex");
}
