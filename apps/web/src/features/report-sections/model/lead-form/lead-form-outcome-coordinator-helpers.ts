import type {
  ItemOutcomeResult,
  ReportSectionReadModel,
  ResolvePlanInput,
  RestorePlanInput,
} from "@customreport/shared";

import type { AutosaveSnapshot } from "../autosave/autosave-types";
import type { LeadFormGeneration } from "./lead-form-generation";
import { leadFormGenerationOf } from "./lead-form-generation";
import {
  LeadFormWriteError,
  type LeadFormWritePort,
} from "./lead-form-write-port";

export type ResolvePlanCommandInput = Omit<
  ResolvePlanInput,
  "reportSectionId" | "version"
>;
export type RestorePlanCommandInput = Omit<
  RestorePlanInput,
  "reportSectionId" | "version"
>;

const WAIT_FOR_OUTCOME = "Wait for the current outcome update to finish.";

export interface OutcomeScope {
  readonly key: string;
  readonly generation: LeadFormGeneration;
  readonly sectionId: string;
  readonly authorId: string;
}

export type PreparedOutcomeCommand =
  | {
      readonly kind: "resolve";
      readonly scopeKey: string;
      readonly input: ResolvePlanInput;
    }
  | {
      readonly kind: "restore";
      readonly scopeKey: string;
      readonly input: RestorePlanInput;
    };

export interface OutcomeCoordinatorArgs {
  readonly writePort: LeadFormWritePort;
  readonly generation: LeadFormGeneration | null;
  readonly sectionId: string | null;
  readonly draftSection: ReportSectionReadModel | null;
  readonly version: number;
  readonly autosave: AutosaveSnapshot;
  readonly readOnly: boolean;
  readonly submitted: boolean;
  readonly acceptVersion: (sectionId: string, next: number) => boolean;
  readonly adoptServerSection: (section: ReportSectionReadModel) => void;
}

export function outcomeScopeOf(
  generation: LeadFormGeneration | null,
  sectionId: string | null,
  draftSection: ReportSectionReadModel | null,
): OutcomeScope | null {
  if (
    !generation ||
    !sectionId ||
    draftSection?.reportSectionId !== sectionId ||
    leadFormGenerationOf(draftSection) !== generation
  ) {
    return null;
  }
  return {
    key: `${generation}:${draftSection.authorId}`,
    generation,
    sectionId,
    authorId: draftSection.authorId,
  };
}

export function portOutcomePending(writePort: LeadFormWritePort): boolean {
  return writePort.pending.resolvePlan || writePort.pending.restorePlan;
}

export function blockedReasonOf(
  args: OutcomeCoordinatorArgs,
  scope: OutcomeScope | null,
  locallyPending: boolean,
): string | null {
  if (scope === null) return "This report section is unavailable.";
  if (args.readOnly) return "This report section is read-only.";
  if (args.submitted) return "This report section has already been submitted.";
  if (args.writePort.pending.submit) {
    return "Wait for submission to finish before changing an outcome.";
  }
  if (args.autosave.state === "error") {
    return "Retry the failed autosave before changing an outcome.";
  }
  if (args.autosave.dirty || args.autosave.isInFlight) {
    return "Wait for autosave to finish before changing an outcome.";
  }
  if (args.writePort.pending.saveDraft) {
    return "Wait for autosave to finish before changing an outcome.";
  }
  if (locallyPending || portOutcomePending(args.writePort)) {
    return WAIT_FOR_OUTCOME;
  }
  if (
    args.writePort.pending.fillFrom ||
    args.writePort.pending.revoke ||
    args.writePort.pending.reopen
  ) {
    return "Wait for the current report update to finish.";
  }
  return null;
}

export function commandError(message: string): LeadFormWriteError {
  return new LeadFormWriteError("error", message);
}

function currentRecordId(
  draftSection: ReportSectionReadModel,
  stableId: string,
): string {
  const current = draftSection.items.find(
    (candidate) => candidate.stableId === stableId,
  );
  if (!current?.id) {
    throw commandError(
      "This item changed on the server. Reload the report and try again.",
    );
  }
  return current.id;
}

export function prepareResolveCommand(
  registry: Map<string, PreparedOutcomeCommand>,
  input: ResolvePlanCommandInput,
  sourceStableId: string | null,
  scope: OutcomeScope,
  draftSection: ReportSectionReadModel,
  version: number,
): ResolvePlanInput {
  const existing = registry.get(input.commandId);
  if (existing) {
    if (existing.kind !== "resolve") {
      throw commandError("This command id is already used by another action.");
    }
    return existing.input;
  }
  const source = (() => {
    if (input.source.kind !== "current") return input.source;
    if (sourceStableId === null) {
      throw commandError(
        "The current item has no stable identity. Reload and try again.",
      );
    }
    return {
      ...input.source,
      recordId: currentRecordId(draftSection, sourceStableId),
    };
  })();
  const prepared: ResolvePlanInput = {
    ...input,
    source,
    reportSectionId: scope.sectionId,
    version,
  };
  registry.set(input.commandId, {
    kind: "resolve",
    scopeKey: scope.key,
    input: prepared,
  });
  return prepared;
}

export function prepareRestoreCommand(
  registry: Map<string, PreparedOutcomeCommand>,
  input: RestorePlanCommandInput,
  stableId: string,
  scope: OutcomeScope,
  draftSection: ReportSectionReadModel,
  version: number,
): RestorePlanInput {
  const existing = registry.get(input.commandId);
  if (existing) {
    if (existing.kind !== "restore") {
      throw commandError("This command id is already used by another action.");
    }
    return existing.input;
  }
  const prepared: RestorePlanInput = {
    ...input,
    recordId: currentRecordId(draftSection, stableId),
    reportSectionId: scope.sectionId,
    version,
  };
  registry.set(input.commandId, {
    kind: "restore",
    scopeKey: scope.key,
    input: prepared,
  });
  return prepared;
}

export function resultMatchesScope(
  result: ItemOutcomeResult,
  scope: OutcomeScope,
): boolean {
  return (
    result.section.reportSectionId === scope.sectionId &&
    result.section.authorId === scope.authorId &&
    leadFormGenerationOf(result.section) === scope.generation
  );
}

export { WAIT_FOR_OUTCOME };
