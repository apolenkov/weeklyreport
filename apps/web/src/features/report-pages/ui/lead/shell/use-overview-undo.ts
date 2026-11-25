import { useEffect, useRef } from "react";
import { toast } from "sonner";

import {
  type DraftPatch,
  type ItemReplyScope,
  useItemReplyScope,
} from "../../../../report-sections";
import { focusCompletionIssue } from "../chrome/overview-completion-focus";
import { persistOverviewChange } from "./overview-persist-change";
import { undoRefusal, type UndoTarget, workSignature } from "./overview-undo";
import { useEditorSettle } from "./use-editor-settle";
import type { ReadyEditor } from "./use-overview-controller";

type Reverse = (
  editor: ReadyEditor,
) =>
  | DraftPatch
  | { kind: "restore-input"; restore: () => void }
  | { kind: "restore-outcome"; recordId: string; stableId: string }
  | null;
interface RestoreConditions {
  input?: boolean;
  deletion?: boolean;
  restoreWeek?: "current" | "next";
}
export interface OverviewUndoWrite extends RestoreConditions {
  destination?: "current" | "next" | undefined;
  section: ReadyEditor["draft"]["section"];
  target: UndoTarget;
  patch: DraftPatch;
  reverse: Reverse;
  message: string;
}
interface ConfirmedUndo extends RestoreConditions {
  target: UndoTarget;
  scope: string;
  signature: string;
  changed: boolean;
  reverse: Reverse;
}

export type UndoOffer = Omit<ConfirmedUndo, "changed"> & {
  message: string;
  destination?: "current" | "next" | undefined;
};
export function useOverviewUndo(
  editor: ReadyEditor | null,
  editing: boolean,
  editingId: string | null,
) {
  const reply = useItemReplyScope();
  const environment = useRef({ editing, editingId, reply });
  const offers = useRef(new Set<ConfirmedUndo>());
  const { latest, until } = useEditorSettle(editor);
  useEffect(() => {
    environment.current = { editing, editingId, reply };
    for (const offer of offers.current) {
      if (
        editor?.draft.receiptScope !== offer.scope ||
        workSignature(editor.draft.section, offer.target) !== offer.signature
      )
        offer.changed = true;
    }
  }, [editor, editing, editingId, reply]);
  useEffect(() => {
    const active = offers.current;
    return () => {
      for (const offer of active) offer.changed = true;
      active.clear();
    };
  }, []);
  const persist = (ready: ReadyEditor, target: UndoTarget, patch: DraftPatch) =>
    persistOverviewChange(ready, target, patch, until);
  const undo = (offer: ConfirmedUndo) =>
    executeUndo(offer, latest.current, environment.current, persist);
  const announce = ({ message, destination, ...saved }: UndoOffer) => {
    announceUndo(
      { ...saved, changed: false },
      { message, destination },
      {
        offers: offers.current,
        undo,
        inScope: () => latest.current?.draft.receiptScope === saved.scope,
      },
    );
  };
  const write = async ({
    section,
    target,
    patch,
    reverse,
    message,
    destination,
    ...conditions
  }: OverviewUndoWrite) => {
    const ready = latest.current;
    if (
      !ready ||
      ready.view.viewModel.isReadOnly ||
      ready.draft.section !== section ||
      ready.outcomes.pending ||
      ready.draft.saveRecovery
    )
      return false;
    const expected = await persist(ready, target, patch);
    if (expected === false) return false;
    announce({
      target,
      signature: expected,
      destination,
      ...conditions,
      reverse,
      message,
      scope: ready.draft.receiptScope,
    });
    return true;
  };
  return { write, announce };
}

function executeUndo(
  offer: ConfirmedUndo,
  ready: ReadyEditor | null,
  environment: {
    editing: boolean;
    editingId: string | null;
    reply: ItemReplyScope | null;
  },
  persist: (
    ready: ReadyEditor,
    target: UndoTarget,
    patch: DraftPatch,
  ) => Promise<string | false>,
) {
  const { editing: open, reply: scope } = environment;
  if (
    ready?.draft.receiptScope !== offer.scope ||
    ready.view.viewModel.isReadOnly
  ) {
    toast.error("Can’t undo: this work changed after that.");
    return true;
  }
  const changed =
    offer.changed ||
    offer.signature !== workSignature(ready.draft.section, offer.target);
  const reason = undoRefusal({
    ownEditor: environment.editingId === offer.target.stableId,
    deletion: offer.deletion === true,
    occupied:
      offer.restoreWeek &&
      ready.draft.section.items.some(
        (row) =>
          row.type === offer.restoreWeek &&
          row.stableId === offer.target.stableId,
      )
        ? offer.restoreWeek
        : undefined,
    saving: ready.draft.autosave.isInFlight || ready.outcomes.pending,
    editing: open,
    reply: !!scope?.store.read(
      `${ready.draft.section.reportSectionId}:${offer.target.stableId}`,
    ).value,
    changed: changed || !!ready.draft.saveRecovery,
  });
  if (reason) {
    toast.error(
      offer.input && open
        ? "Can’t put it back now: save or cancel the open form first."
        : reason,
    );
    return changed;
  }
  const patch = offer.reverse(ready);
  if (!patch) {
    toast.error("Can’t undo: this work changed after that.");
    return true;
  }
  if (patch.kind === "restore-input") {
    offer.changed = true;
    patch.restore();
    return true;
  }
  if (patch.kind === "restore-outcome")
    return restoreOutcome(ready, offer, patch);
  offer.changed = true;
  void persist(ready, offer.target, patch).then((signature) => {
    if (signature !== false) toast.success("Change undone.");
  });
  return true;
}

function showDestination(
  week: OverviewUndoWrite["destination"],
  target: UndoTarget,
  inScope: () => boolean,
) {
  if (!week) return {};
  const selector = `[data-overview-week-tab="${week}"]`;
  const show = () => {
    if (inScope()) focusCompletionIssue(`title:${week}:${target.stableId}`);
  };
  if (!document.querySelector(selector)) {
    show();
    return {};
  }
  return { cancel: { label: "Show", onClick: show } };
}

function announceUndo(
  offer: ConfirmedUndo,
  { message, destination }: Pick<UndoOffer, "message" | "destination">,
  {
    offers,
    undo,
    inScope,
  }: {
    offers: Set<ConfirmedUndo>;
    undo: (offer: ConfirmedUndo) => boolean;
    inScope: () => boolean;
  },
) {
  const { target } = offer;
  offers.add(offer);
  const release = () => {
    offers.delete(offer);
  };
  toast.success(message, {
    duration: 8000,
    ...showDestination(destination, target, inScope),
    action: {
      label: "Undo",
      onClick: (event) => {
        if (!undo(offer)) event.preventDefault();
      },
    },
    onAutoClose: release,
    onDismiss: release,
  });
}

function restoreOutcome(
  ready: ReadyEditor,
  offer: ConfirmedUndo,
  patch: Extract<NonNullable<ReturnType<Reverse>>, { kind: "restore-outcome" }>,
) {
  if (!ready.outcomes.canExecute) {
    toast.error(
      ready.outcomes.blockedReason ?? "Still saving. Try Undo in a moment.",
    );
    return false;
  }
  offer.changed = true;
  void ready.outcomes
    .restore(
      { recordId: patch.recordId, commandId: crypto.randomUUID() },
      patch.stableId,
    )
    .then(() => toast.success("Change undone."))
    .catch(() => toast.error("Undo was not confirmed."));
  return true;
}
