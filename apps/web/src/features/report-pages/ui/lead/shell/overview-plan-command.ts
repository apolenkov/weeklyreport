import type {
  ReportSectionReadModel,
  ResolvePlanInput,
} from "@weeklyreport/shared";

import type {
  RecordParent,
  StatusOverviewItem,
  StatusOverviewModel,
} from "../../../../report-sections";
import type { OpenWorkRegisterItem } from "./open-work-register-model";
import type { LeadFormEditorHandle } from "./use-lead-form-editor";

type ReadyEditor = Extract<LeadFormEditorHandle, { status: "ready" }>;
type SectionItem = ReportSectionReadModel["items"][number];
export type PlanOutcome = ResolvePlanInput["outcome"];

export interface OverviewPlanFields {
  readonly outcome: PlanOutcome | null;
  readonly resultText: string;
  readonly planText: string;
  readonly nextStepText: string;
  readonly reason: string;
  readonly parent: RecordParent;
  readonly stageNames: readonly string[];
}

export interface OverviewPlanState {
  readonly generation: string | null;
  readonly mode: "resolve" | "restore";
  readonly item: StatusOverviewItem;
  readonly source: ResolvePlanInput["source"];
  readonly unitKey: string | null;
  readonly editorAtOpen: ReadyEditor;
  readonly fields: OverviewPlanFields;
  // Fields as opened, to tell an edited composer from an untouched one.
  readonly baseline: OverviewPlanFields;
  readonly attempt?:
    | {
        readonly key: string;
        readonly commandId: string;
        readonly owner: symbol;
      }
    | null
    | undefined;
}

function initialParent(raw: SectionItem, editor: ReadyEditor): RecordParent {
  if (
    raw.projectId &&
    editor.draft.section.projects.some(
      (project) => project.projectId === raw.projectId,
    )
  ) {
    return { kind: "product", id: raw.projectId };
  }
  if (
    raw.activityId &&
    editor.draft.section.activities.some(
      (activity) => activity.activityId === raw.activityId,
    )
  ) {
    return { kind: "activity", id: raw.activityId };
  }
  return { kind: "unresolved" };
}

export function createOverviewPlanState(
  editor: ReadyEditor,
  model: StatusOverviewModel,
  item: StatusOverviewItem,
  {
    raw,
    source,
    mode,
  }: {
    readonly raw: SectionItem;
    readonly source: ResolvePlanInput["source"];
    readonly mode: "resolve" | "restore";
  },
): OverviewPlanState {
  const column =
    item.source === "previous"
      ? "previouslyPlanned"
      : item.source === "current"
        ? "currentWeek"
        : "nextWeek";
  const fields: OverviewPlanFields = {
    outcome: null,
    resultText: item.text,
    planText:
      item.source !== "previous" && raw.type === "current"
        ? (raw.nextStepText ?? "")
        : item.text,
    nextStepText: item.source === "previous" ? "" : (raw.nextStepText ?? ""),
    reason: "",
    parent: initialParent(raw, editor),
    stageNames: [...raw.stageNames],
  };
  return {
    generation: editor.generation,
    mode,
    item,
    source,
    editorAtOpen: editor,
    unitKey:
      model.units.find((unit) =>
        unit.columns[column].items.some(
          (candidate) => candidate.key === item.key,
        ),
      )?.key ?? null,
    fields,
    baseline: fields,
    attempt: null,
  };
}

function openWorkOverviewItem(
  openWork: OpenWorkRegisterItem,
): StatusOverviewItem {
  const item = openWork.occurrence.item;
  return {
    key: `open-work:${item.stableId}`,
    recordId: item.id,
    source: "previous",
    editTarget: null,
    stableId: item.stableId,
    text: item.text,
    tag: item.tag,
    stageNames: item.stageNames,
    pausedReason: item.pausedReason ?? null,
    resolution: item.resolution ?? null,
    outcomeHistory: item.outcomeHistory ?? [],
    comments: item.comments ?? [],
    canResolve: true,
    canRestore: false,
    workflowStatus: item.workflowStatus,
    continuity: null,
  };
}

/** Captures immutable prior lineage before opening the resume/replan composer. */
export function createOpenWorkPlanState(
  editor: ReadyEditor,
  openWork: OpenWorkRegisterItem,
): OverviewPlanState {
  const item = openWork.occurrence.item;
  const text = item.nextStepText?.trim() || item.text;
  const outcome =
    openWork.action.kind === "replan" ||
    openWork.action.kind === "plan" ||
    openWork.action.kind === "reopen"
      ? "plan_next"
      : "continue";
  const parent = initialParent(item, editor);
  const fields: OverviewPlanFields = {
    outcome,
    resultText: text,
    planText: text,
    nextStepText: "",
    reason: "",
    parent,
    stageNames: parent.kind === "activity" ? [] : [...item.stageNames],
  };
  return {
    generation: editor.generation,
    mode: "resolve",
    item: openWorkOverviewItem(openWork),
    source: {
      kind: "prior",
      reportId: openWork.occurrence.reportId,
      recordId: item.id,
    },
    unitKey: null,
    editorAtOpen: editor,
    fields,
    baseline: fields,
    attempt: null,
  };
}

export function nextPlanHint(state: OverviewPlanState): string {
  return state.source.kind === "current" && state.item.source === "current"
    ? "The current result stays unchanged. This is a separate commitment."
    : "This commitment will be planned for next week. The previous report stays unchanged.";
}

/** True when input beyond the outcome choice differs from what the composer opened with. */
export function isPlanInputEdited({
  fields,
  baseline,
}: Pick<OverviewPlanState, "fields" | "baseline">): boolean {
  const input = (value: OverviewPlanFields) =>
    JSON.stringify({ ...value, outcome: null });
  return input(fields) !== input(baseline);
}

function planSourceFields(item: SectionItem): string {
  return JSON.stringify({
    text: item.text,
    type: item.type,
    workflowStatus: item.workflowStatus,
    pausedReason: item.pausedReason ?? null,
    nextStepText: item.nextStepText ?? null,
    projectId: item.projectId ?? null,
    activityId: item.activityId ?? null,
    stageNames: item.stageNames,
    priorityRank: item.priorityRank ?? null,
    resolution: item.resolution ?? null,
    outcomeEventIds: (item.outcomeHistory ?? []).map((event) => event.id),
  });
}

function findPlanSource(
  section: ReportSectionReadModel,
  state: OverviewPlanState,
): SectionItem | undefined {
  return section.items.find((item) =>
    state.item.stableId
      ? item.stableId === state.item.stableId
      : item.id === state.source.recordId,
  );
}

export function overviewPlanRecoveryReason(
  editor: ReadyEditor | null,
  state: OverviewPlanState | null,
  owner: symbol,
): string | null {
  if (!state) return null;
  if (!editor || editor.view.viewModel.isReadOnly)
    return "The report is not editable right now. Your input is retained below.";
  if (editor.generation !== state.generation)
    return "The report context changed. Your input is retained; reopen this plan in an editable report before saving.";
  if (state.source.kind === "prior") return null;
  if (state.attempt && state.attempt.owner !== owner)
    return "The previous save outcome is unknown after navigation. Reload this report to confirm it before trying again.";
  // The mounted coordinator still owns the exact prepared request for an
  // idempotent retry, even if its successful server state arrived meanwhile.
  if (state.attempt) return null;
  const before = findPlanSource(state.editorAtOpen.draft.section, state);
  const current = findPlanSource(editor.draft.section, state);
  if (
    !before ||
    !current ||
    planSourceFields(before) !== planSourceFields(current)
  )
    return "This plan changed while you were editing. Your input is retained and has not overwritten those changes.";
  return null;
}

// Shared with the composer actions, which drop this error once the parent
// (and with it the stage set) changes.
export const STAGE_REQUIRED_ERROR = "Select at least one stage.";

function validateFields(fields: OverviewPlanFields) {
  if (fields.outcome === null) throw new Error("Choose a plan outcome.");
  if (fields.parent.kind === "unresolved")
    throw new Error("Select an attached product or activity.");
  const text =
    fields.outcome === "plan_next"
      ? fields.planText.trim()
      : fields.resultText.trim();
  if (fields.outcome !== "wont_do" && !text)
    throw new Error("Describe the result or next commitment.");
  if (fields.outcome === "wont_do" && !fields.reason.trim())
    throw new Error("Explain why this plan will not be done.");
  if (fields.parent.kind === "product" && fields.stageNames.length === 0)
    throw new Error(STAGE_REQUIRED_ERROR);
  return { text, outcome: fields.outcome, parent: fields.parent };
}

export function overviewPlanInput(
  state: Pick<OverviewPlanState, "fields" | "source">,
): Omit<ResolvePlanInput, "reportSectionId" | "version" | "commandId"> {
  const fields = state.fields;
  const { text, outcome, parent } = validateFields(fields);
  return {
    source: state.source,
    outcome,
    parent,
    stageNames: fields.parent.kind === "activity" ? [] : fields.stageNames,
    ...(fields.outcome === "wont_do"
      ? { reason: fields.reason.trim() }
      : { text }),
    ...(fields.outcome === "continue"
      ? { nextStepText: fields.nextStepText.trim() || null }
      : {}),
  };
}
