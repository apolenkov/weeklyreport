import {
  type ItemOutcomeState,
  itemOutcomeStateSchema,
  type PromotePlanInput,
  type ReportSectionReadModel,
  type ResolvePlanInput,
} from "@customreport/shared";

import { LeadFormConstraintError } from "./lead-form-shared.js";

type Item = ReportSectionReadModel["items"][number];

function commandSource(source: Item, command: ResolvePlanInput): Item {
  if (
    command.source.kind !== "prior" ||
    source.type !== "current" ||
    !source.nextStepText?.trim()
  )
    return source;
  // A prior next-step promise is not last week's reported result. Its target
  // occurrence starts as a plan, including the state recovered by Restore.
  return {
    ...source,
    text: source.nextStepText,
    type: "next",
    workflowStatus: "planned",
    pausedReason: null,
    nextStepText: null,
  };
}

export function outcomeState(item: Item): ItemOutcomeState {
  return itemOutcomeStateSchema.parse({
    type: item.type,
    workflowStatus: item.workflowStatus,
    pausedReason: item.pausedReason ?? null,
    nextStepText: item.nextStepText ?? null,
    text: item.text,
  });
}

function nextPlanState(
  source: Item,
  command: ResolvePlanInput,
): ItemOutcomeState {
  if (command.source.kind === "current" && !command.text?.trim()) {
    throw new LeadFormConstraintError(
      "Describe the next-period commitment explicitly.",
    );
  }
  if (command.source.kind !== "current" || source.type !== "current") {
    return {
      type: "next",
      workflowStatus: "planned",
      pausedReason: null,
      nextStepText: null,
      text: source.text,
    };
  }
  if (source.workflowStatus === "done") {
    throw new LeadFormConstraintError(
      "Completed work cannot have a next-period commitment.",
    );
  }
  return { ...outcomeState(source), nextStepText: command.text ?? null };
}

function resolvedState(
  source: Item,
  command: ResolvePlanInput,
): ItemOutcomeState {
  switch (command.outcome) {
    case "done":
      return {
        type: "current",
        workflowStatus: "done",
        pausedReason: null,
        nextStepText: null,
        text: source.text,
      };
    case "continue":
      return {
        type: "current",
        workflowStatus: "in_progress",
        pausedReason: null,
        nextStepText:
          command.nextStepText !== undefined
            ? command.nextStepText
            : command.source.kind === "current"
              ? (source.nextStepText ?? null)
              : null,
        text: source.text,
      };
    case "plan_next":
      return nextPlanState(source, command);
    case "wont_do":
      // Cancellation is orthogonal to progress. Restore recovers this tuple,
      // including a pause reason or a separate next-period commitment.
      return outcomeState(source);
  }
}

// The prior occurrence is evidence, never a mutation target. Current Plan next
// keeps this week's result and stores a separate commitment on the same task.
export function resolveItemTransition(
  original: Item,
  command: ResolvePlanInput,
) {
  const source = commandSource(original, command);
  if (command.source.kind === "current" && source.resolution != null) {
    throw new LeadFormConstraintError("Restore this plan before changing it.");
  }
  const preservesText =
    command.outcome === "wont_do" ||
    (command.outcome === "plan_next" &&
      command.source.kind === "current" &&
      source.type === "current");
  const text = preservesText ? source.text : (command.text ?? source.text);
  return {
    // The superseded result stays readable in the audit event: beforeState keeps
    // the previous text and afterState the text this transition commits.
    beforeState: outcomeState(source),
    afterState: itemOutcomeStateSchema.parse({
      ...resolvedState(source, command),
      text,
    }),
    text,
  };
}

export function restoreItemTransition(source: Item) {
  if (source.resolution == null) {
    throw new LeadFormConstraintError("This plan is not cancelled.");
  }
  return {
    beforeState: outcomeState(source),
    // Events written before the state carried text fall back to the live text so
    // a restore never blanks the result it is recovering.
    afterState: itemOutcomeStateSchema.parse({
      ...source.resolution.previousState,
      text: source.resolution.previousState.text ?? source.text,
    }),
    reversesEventId: source.resolution.eventId,
  };
}

// The linked commitment becomes the selected week's active text while the
// superseded result stays readable in the event's before-state. Completed and
// cancelled records cannot be promoted, and a blank commitment is not a move.
export function promoteItemTransition(
  source: Item,
  target: PromotePlanInput["target"] = "current",
) {
  if (source.workflowStatus === "done") {
    throw new LeadFormConstraintError("Completed work cannot be promoted.");
  }
  if (source.resolution != null) {
    throw new LeadFormConstraintError("Restore this plan before promoting it.");
  }
  const continuation = source.nextStepText?.trim() ?? "";
  if (continuation === "") {
    throw new LeadFormConstraintError(
      "This record has no next step to promote.",
    );
  }
  return {
    beforeState: outcomeState(source),
    afterState: itemOutcomeStateSchema.parse({
      type: target,
      workflowStatus: source.workflowStatus,
      pausedReason: source.pausedReason ?? null,
      nextStepText: null,
      text: continuation,
    }),
  };
}
