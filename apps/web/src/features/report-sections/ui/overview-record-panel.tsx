import { safeText } from "@weeklyreport/shared";
import { AlertDialog } from "@weeklyreport/ui/components/ui/alert-dialog";
import { Button } from "@weeklyreport/ui/components/ui/button";
import { GrowingTextarea } from "@weeklyreport/ui/components/ui/growing-textarea";
import { type RefObject, useRef, useState, useSyncExternalStore } from "react";

import { PanelActions } from "./overview-record-actions";
import type { ActiveRecordEditor, PanelProps } from "./overview-record-context";
import { OverviewRecordSurface } from "./overview-record-surface";
import { StageToggles } from "./overview-stages";
import { OverviewStepDetails } from "./overview-step-details";

export function OverviewRecordPanel({
  item,
  editor,
  owned,
  trigger,
  discussion,
  openDiscussion,
  occupied,
  published,
  moveReason,
}: PanelProps) {
  const [stepDetails, setStepDetails] = useState(false);
  const stepDetailsOrigin = useRef<HTMLButtonElement>(null);
  const state = usePanelFields(item, editor, owned, published);
  const { dirty, confirm, cancel, invalid, save } = state;
  return (
    <OverviewRecordSurface
      trigger={trigger}
      dirty={dirty || editor.pending}
      nested={
        discussion || !!confirm || stepDetails || editor.detailsOpen === true
      }
      close={editor.leave ?? editor.close}
      cancel={cancel}
    >
      <div
        role="presentation"
        inert={stepDetails || editor.detailsOpen === true}
        className="grid min-w-0 gap-3 text-sm"
        onKeyDown={(event) => {
          if (
            event.target instanceof HTMLTextAreaElement &&
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            save();
          }
        }}
      >
        <PanelFields {...state} {...{ item, editor, owned, occupied }} />
        {(invalid || editor.error) && (
          <p role="alert">{invalid || editor.error}</p>
        )}
        <PanelActions
          {...state}
          {...{ item, editor, openDiscussion, moveReason }}
          details={
            state.step
              ? (origin) => {
                  stepDetailsOrigin.current = origin;
                  setStepDetails(true);
                }
              : editor.details
          }
        />
      </div>
      {stepDetails && (
        <OverviewStepDetails
          editor={editor}
          close={() => setStepDetails(false)}
          restoreFocus={() => stepDetailsOrigin.current?.focus()}
          save={save}
          error={invalid}
        />
      )}
      <PanelConfirm {...state} item={item} editor={editor} />
    </OverviewRecordSurface>
  );
}

function usePanelFields(
  item: PanelProps["item"],
  editor: ActiveRecordEditor,
  owned: readonly string[],
  published: boolean,
) {
  const { store } = editor;
  const value = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const dirty = store.isDirty(value);
  const step = item.editTarget?.focusNextStep === true;
  const [confirm, setConfirm] = useState<"discard" | "delete" | null>(null);
  const [invalid, setInvalid] = useState("");
  const field = useRef<HTMLTextAreaElement>(null);
  const actionRow = useRef<HTMLDivElement>(null);
  const returnToDelete = useRef(false);
  const cancel = () => {
    returnToDelete.current = false;
    if (dirty) setConfirm("discard");
    else editor.close();
  };
  const save = () => {
    const error = validationError(value, step, owned);
    setInvalid(error);
    if (!error && !editor.pending) editor.save();
  };
  const deletion =
    (published || editor.published) && !step
      ? "Published in last week’s report. It can’t be deleted"
      : editor.remove
        ? undefined
        : "This entry cannot be deleted.";
  const askDelete = () => {
    returnToDelete.current = true;
    setConfirm("delete");
  };
  return {
    store,
    value,
    dirty,
    step,
    confirm,
    setConfirm,
    invalid,
    setInvalid,
    field,
    actionRow,
    returnToDelete,
    cancel,
    save,
    deletion,
    askDelete,
  };
}

function validationError(
  value: ReturnType<ActiveRecordEditor["store"]["getSnapshot"]>,
  step: boolean,
  owned: readonly string[],
) {
  const text = step ? value.nextStepText : value.text;
  if (!text.trim()) {
    return "The text can’t be empty. Press Esc to cancel.";
  }
  const parsed = safeText().safeParse(text);
  if (!parsed.success) {
    return parsed.error.issues[0]?.message ?? "Check the text.";
  }
  if (
    !step &&
    value.nextStepText.trim() &&
    !safeText().safeParse(value.nextStepText).success
  ) {
    return "Check the next step text.";
  }
  if (
    !step &&
    value.parent.kind === "product" &&
    (value.stageNames.length === 0 ||
      value.stageNames.some((name) => !owned.includes(name)))
  ) {
    return "Choose an available stage.";
  }
  return "";
}

function PanelConfirm({
  confirm,
  setConfirm,
  item,
  editor,
  step,
  field,
  actionRow,
  returnToDelete,
}: Pick<PanelProps, "item" | "editor"> & {
  returnToDelete: RefObject<boolean>;
  confirm: "discard" | "delete" | null;
  setConfirm: (value: null) => void;
  step: boolean;
  field: RefObject<HTMLTextAreaElement | null>;
  actionRow: RefObject<HTMLDivElement | null>;
}) {
  return (
    <AlertDialog.Root open={!!confirm}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-(--layer-overlay) bg-overlay" />
        <AlertDialog.Content
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-(--layer-dialog) -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-4 shadow-lg"
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            setConfirm(null);
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (returnToDelete.current
              ? actionRow.current?.querySelector<HTMLElement>(
                  '[aria-label="Delete"]',
                )
              : field.current
            )?.focus();
          }}
        >
          <AlertDialog.Title>
            {confirm === "delete"
              ? step
                ? "Delete this next step?"
                : "Delete this entry?"
              : "Discard changes?"}
          </AlertDialog.Title>
          {confirm === "delete" && (
            <AlertDialog.Description>{item.text}</AlertDialog.Description>
          )}
          <AlertDialog.Cancel asChild>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              {confirm === "delete" ? "Cancel" : "Keep editing"}
            </Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action asChild>
            <Button
              onClick={() => {
                if (confirm === "delete") editor.remove?.(step);
                else (editor.discard ?? editor.close)();
                setConfirm(null);
              }}
            >
              {confirm === "delete" ? "Delete" : "Discard"}
            </Button>
          </AlertDialog.Action>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

function PanelFields({
  item,
  editor,
  owned,
  occupied,
  step,
  field,
  store,
  value,
  setInvalid,
}: Pick<PanelProps, "item" | "editor" | "owned" | "occupied"> & {
  step: boolean;
  field: RefObject<HTMLTextAreaElement | null>;
  store: ActiveRecordEditor["store"];
  value: ReturnType<ActiveRecordEditor["store"]["getSnapshot"]>;
  setInvalid: (message: string) => void;
}) {
  return (
    <>
      <textarea
        ref={field}
        rows={3}
        aria-label={step ? "Step text" : "Record text"}
        className="w-full resize-y rounded-md border bg-card p-2"
        value={step ? value.nextStepText : value.text}
        onChange={(event) => {
          setInvalid("");
          (step ? store.setters.setNextStepText : store.setters.setText)(
            event.target.value,
          );
        }}
      />
      {!step &&
        (owned.length > 1 ||
          value.stageNames.some((name) => !owned.includes(name))) && (
          <fieldset disabled={editor.pending}>
            <legend>Stage</legend>
            <StageToggles
              owned={owned}
              selected={value.stageNames}
              onChange={store.setters.setStageNames}
            />
          </fieldset>
        )}
      {item.source === "current" && (
        <label>
          Next step
          <GrowingTextarea
            className="block rounded-md border px-2 py-1"
            readOnly={occupied}
            title={occupied ? "Next week already has this item" : undefined}
            value={value.nextStepText}
            onChange={(event) =>
              store.setters.setNextStepText(event.target.value)
            }
          />
        </label>
      )}
    </>
  );
}
