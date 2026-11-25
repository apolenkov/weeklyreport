import {useCallback,useState, useSyncExternalStore } from "react";

import type { OverviewItemDialogState } from "./lead-status-overview-item-editor";
import {overviewPendingRecords} from "./overview-pending-records";
import { isRecordInputEdited } from "./overview-record-state";
import type { ReadyEditor } from "./use-overview-controller";
import { useSaveStatus } from "./use-save-status";

export const FALLBACK_READINESS = {
  canOpenConfirmation: false,
  submitPending: false,
  blockingIssues: [],
  pendingReviewCount: 0,
  willAutoPromote: [],
  unsetStatuses: [],
  autosaveState: "idle" as const,
};

const emptySubscription = () => () => undefined;
function overviewDraftIssues(
  editing: EditingState,
  itemDirty: boolean,
  activityIds: ReadonlySet<string>,
) {
  const issues = [...activityIds].map((id) => ({
    id: `unsaved:${id}`,
    label: "Unsaved activity fields",
    overviewFocus: `activity:${id}`,
  }));
  const item = editing.dialog.dialog;
  if (item && (itemDirty || item.submission)) {
    const parent =
      item.mode === "create"
        ? { kind: item.target.unitKind, id: item.target.unitId }
        : item.item.parent;
    issues.push({
      id: `unsaved:item:${item.stableId??"entry"}`,
      label: `Unsaved update: ${
        item.draftStore.getSnapshot().text || "Empty text"
      }`,
      overviewFocus:
        parent.kind === "unresolved"
          ? "report-details"
          : `${parent.kind}:${parent.id}`,
    });
  }
  const record = editing.record.state;
  if (record && isRecordInputEdited(record))
    issues.push({
      id: `unsaved:${record.kind}:${record.identity.stableId}`,
      label: `Unsaved ${record.kind}: ${record.value.text}`,
      overviewFocus: `${record.parent.kind}:${record.parent.id}`,
    });
  if (editing.plan.dialog)
    issues.push({
      id: "unsaved-plan",
      label: "Plan outcome awaiting confirmation",
      overviewFocus: editing.plan.dialog.unitKey ?? "report-details",
    });
  return issues;
}

interface EditingState {
  dialog: { dialog: OverviewItemDialogState | null };
  record: { state: Parameters<typeof isRecordInputEdited>[0] | null };
  plan: {
    dialog: { unitKey?: string | null | undefined } | null;
    pending: boolean;
  };
}
type ReasonIssue={label:string;overviewFocus:string};
function useReasonIssues(){
 const [issues,setIssues]=useState<ReadonlyMap<string,ReasonIssue>>(()=>new Map());
 const onReasonDraft=useCallback((id:string,issue:ReasonIssue|null)=>setIssues(previous=>{
   const next=new Map(previous);
   if(issue)next.set(id,issue);else next.delete(id);
   return next;
 }),[]);
 return {issues,onReasonDraft};
}
export function useOverviewReadiness(
  readyEditor: ReadyEditor | null,
  editing: EditingState,
  pendingActivityIds: ReadonlySet<string>,
) {
  const {issues,onReasonDraft}=useReasonIssues();
  const store = editing.dialog.dialog?.draftStore;
  const itemDirty = useSyncExternalStore(
    store?.subscribe ?? emptySubscription,
    () => store?.isDirty() ?? false,
    () => false,
  );
  const unsaved = overviewDraftIssues(editing, itemDirty, pendingActivityIds);
  for(const [id,issue] of issues)unsaved.push({id,...issue});
  for(const row of overviewPendingRecords(readyEditor))if(!unsaved.some(issue=>issue.id===row.id))unsaved.push(row);
  if (unsaved.length === 0 && (readyEditor?.draft.autosave.dirty || readyEditor?.draft.autosave.isInFlight))
    unsaved.push({
      id: "unsaved-section",
      label: "Section changes are waiting to save.",
      overviewFocus: "report-details",
    });
  const readiness = readyEditor
    ? {
        ...readyEditor.view.submitReadiness,
        canOpenConfirmation:
          readyEditor.view.submitReadiness.canOpenConfirmation &&
          unsaved.length === 0,
        blockingIssues: [
          ...unsaved,
          ...readyEditor.view.submitReadiness.blockingIssues,
        ],
      }
    : FALLBACK_READINESS;
  const saveStatus = useSaveStatus(
    readyEditor,
    unsaved.length,
    editing.plan.pending,
  );
  return { readiness, saveStatus,onReasonDraft };
}
