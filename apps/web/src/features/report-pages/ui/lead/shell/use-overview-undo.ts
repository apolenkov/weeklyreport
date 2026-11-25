import { useEffect, useRef } from "react";
import { toast } from "sonner";

import {
  applyDraftPatch,
  type DraftPatch,
  useItemReplyScope,
} from "../../../../report-sections";
import { undoRefusal, type UndoTarget, workSignature } from "./overview-undo";
import { useEditorSettle } from "./use-editor-settle";
import type { ReadyEditor } from "./use-overview-controller";

type Reverse = (editor: ReadyEditor) => DraftPatch | {kind:"restore-outcome";recordId:string;stableId:string} | null;
export interface OverviewUndoWrite {
  section:ReadyEditor["draft"]["section"];
  target: UndoTarget;
  patch: DraftPatch;
  reverse: Reverse;
  message: string;
}
interface ConfirmedUndo {
  target: UndoTarget;
  scope: string;
  signature: string;
  changed: boolean;
  reverse: Reverse;
}

export type UndoOffer=Omit<ConfirmedUndo,"changed"> & {message:string};
export function useOverviewUndo(editor: ReadyEditor | null, editing: boolean) {
  const reply = useItemReplyScope();
  const environment = useRef({ editing, reply });
  const offers = useRef(new Set<ConfirmedUndo>());
  const { latest, until } = useEditorSettle(editor);
  useEffect(() => {
    environment.current = { editing, reply };
    for (const offer of offers.current) {
      if (
        !editor ||
        editor.draft.receiptScope !== offer.scope ||
        workSignature(editor.draft.section, offer.target) !== offer.signature
      )
        offer.changed = true;
    }
  }, [editor, editing, reply]);
  useEffect(() => {
    const active = offers.current;
    return () => {
      for (const offer of active) offer.changed = true;
      active.clear();
    };
  }, []);
  const persist=(ready:ReadyEditor,target:UndoTarget,patch:DraftPatch)=>persistChange(ready,target,patch,until);
  const undo = (offer: ConfirmedUndo) => {
    const ready = latest.current;
    const { editing: open, reply: scope } = environment.current;
    if (
      !ready ||
      ready.draft.receiptScope !== offer.scope ||
      ready.view.viewModel.isReadOnly
    ) {
      toast.error("Can’t undo: this work changed after that.");
      return false;
    }
    const changed =
      offer.changed ||
      offer.signature !== workSignature(ready.draft.section, offer.target);
    const reason = undoRefusal({
      saving: ready.draft.autosave.isInFlight || ready.outcomes.pending,
      editing: open,
      reply: offer.target.kind==="item" && !!scope?.store.read(
        `${ready.draft.section.reportSectionId}:${offer.target.stableId}`,
      ).value,
      changed: changed || !!ready.draft.saveRecovery,
    });
    if (reason) {
      toast.error(reason);
      return changed;
    }
    const patch = offer.reverse(ready);
    if (!patch) {
      toast.error("Can’t undo: this work changed after that.");
      return false;
    }
    if(patch.kind==="restore-outcome"){
      if(!ready.outcomes.canExecute){toast.error(ready.outcomes.blockedReason??"Still saving. Try Undo in a moment.");return false;}
      offer.changed=true;
      void ready.outcomes.restore({recordId:patch.recordId,commandId:crypto.randomUUID()},patch.stableId).then(()=>toast.success("Change undone.")).catch(()=>toast.error("Undo was not confirmed."));
      return true;
    }
    offer.changed = true;
    void persist(ready,offer.target,patch).then(signature=>{
      if(signature!==false)toast.success("Change undone.");
    });
    return true;
  };
  const announce = ({
    target,
    signature,
    reverse,
    message,
    scope,
  }: Omit<ConfirmedUndo, "changed"> & { message: string }) => {
    const offer = { target, signature, reverse, changed: false, scope };
    offers.current.add(offer);
    const release = () => {
      offers.current.delete(offer);
    };
    toast.success(message, {
      duration: 8000,
      action: {
        label: "Undo",
        onClick: (event) => {
          if (!undo(offer)) event.preventDefault();
        },
      },
      onAutoClose: release,
      onDismiss: release,
    });
  };
  const write = async ({
    section,target,
    patch,
    reverse,
    message,
  }: OverviewUndoWrite) => {
    const ready = latest.current;
    if (
      !ready ||
      ready.view.viewModel.isReadOnly ||
      ready.draft.section!==section || ready.outcomes.pending ||
      ready.draft.saveRecovery
    )
      return false;
    const expected=await persist(ready,target,patch);
    if(expected===false)return false;
    announce({
      target,
      signature: expected,
      reverse,
      message,
      scope: ready.draft.receiptScope,
    });
    return true;
  };
  return { write, announce };
}

async function persistChange(ready:ReadyEditor,target:UndoTarget,patch:DraftPatch,until:(predicate:(editor:ReadyEditor)=>boolean)=>Promise<ReadyEditor|null>){
    const { draft } = ready;
    const expected = workSignature(
      applyDraftPatch(draft.section, patch),
      target,
    );
    if (expected === workSignature(draft.section, target)) return false;
    draft.apply(patch);
    const adopted = await until(
      (next) =>
        next.draft.receiptScope === draft.receiptScope &&
        workSignature(next.draft.section, target) === expected,
    );
    if (!adopted) return false;
    const token = crypto.randomUUID();
    const result = await adopted.draft.savePersisted(token);
    if (result.status !== "accepted") {
      toast.error("The save was not confirmed.");
      return false;
    }
    const confirmed = await until(
      (next) =>
        next.draft.receiptScope === draft.receiptScope &&
        next.draft.lastSaveReceipt?.attemptToken === token,
    );
    const receipt = confirmed?.draft.lastSaveReceipt;
    if (
      !confirmed ||
      !receipt?.persistedItems ||
      !receipt.persistedRisks ||
      !receipt.persistedDecisions
    )
      return false;
    const persisted = {
      ...confirmed.draft.section,
      items: receipt.persistedItems,
      risks: receipt.persistedRisks,
      decisions: receipt.persistedDecisions,
    };
    if (
      workSignature(persisted, target) !== expected ||
      workSignature(confirmed.draft.section, target) !== expected
    )
      return false;
  return expected;
}
