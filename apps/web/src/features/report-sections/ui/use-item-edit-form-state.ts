import { useRef, useState, useSyncExternalStore } from "react";

import { useDialogFocus } from "../../../shared/hooks/dialogs/use-dialog-focus";
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
  useDialogFocus({
    open: (args.presentation ?? "dialog") === "dialog",
    onClose: args.onCancel,
    containerRef: dialogSurfaceRef,
  });
  return {
    isCreate: store.isCreate,
    initial: store.initial,
    dialogSurfaceRef,
    ...fields,
    ...store.setters,
    errors,
    setErrors,
  };
}
