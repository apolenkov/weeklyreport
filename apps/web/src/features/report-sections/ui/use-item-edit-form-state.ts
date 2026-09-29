import { useRef, useState, useSyncExternalStore } from "react";

import { useDialogFocus } from "../../../shared/hooks/dialogs/use-dialog-focus";
import { useDiscardGuard } from "../../../shared/ui/dialogs/use-discard-guard";
import {
  createItemEditDraftStore,
  type ItemEditDraftSeed,
  type ItemEditDraftStore,
} from "./item-edit-draft-store";

export interface ItemEditErrors {
  text?: string | undefined;
  nextStepText?: string | undefined;
  parent?: string | undefined;
  stageNames?: string | undefined;
  pausedReason?: string | undefined;
}

interface UseItemEditFormStateArgs extends ItemEditDraftSeed {
  readonly presentation?: "dialog" | "inline" | undefined;
  readonly draftStore?: ItemEditDraftStore | undefined;
  readonly onCancel: () => void;
  readonly isPending?: boolean | undefined;
}

export function useItemEditFormState(args: UseItemEditFormStateArgs) {
  const [store] = useState(
    () => args.draftStore ?? createItemEditDraftStore(args),
  );
  const fields = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const [errors, setErrors] = useState<ItemEditErrors>({});
  const dialogSurfaceRef = useRef<HTMLDivElement>(null);
  const isDialog = (args.presentation ?? "dialog") === "dialog";
  // Any field change (not only text) makes the draft worth confirming.
  const { requestClose, discardDialog } = useDiscardGuard(
    JSON.stringify(fields) !== JSON.stringify(store.baseline),
    args.onCancel,
    args.isPending,
  );
  useDialogFocus({
    open: isDialog,
    onClose: requestClose,
    containerRef: dialogSurfaceRef,
  });
  return {
    isCreate: store.isCreate,
    initial: store.initial,
    dialogSurfaceRef,
    requestClose,
    discardDialog,
    ...fields,
    ...store.setters,
    errors,
    setErrors,
  };
}
