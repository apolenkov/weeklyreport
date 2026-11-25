import { Button } from "@weeklyreport/ui/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@weeklyreport/ui/components/ui/sheet";
import { useSyncExternalStore } from "react";

import type { ActiveRecordEditor } from "./overview-record-context";

export function OverviewStepDetails({
  editor,
  close,
  restoreFocus,
  save,
  error,
}: {
  editor: ActiveRecordEditor;
  close: () => void;
  restoreFocus: () => void;
  save: () => void;
  error: string;
}) {
  const { store } = editor;
  const fields = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <SheetContent
        aria-describedby={undefined}
        className="p-4"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
      >
        <SheetTitle>Next step details</SheetTitle>
        <textarea
          aria-label="Step text"
          value={fields.nextStepText}
          disabled={editor.pending}
          onChange={(event) =>
            store.setters.setNextStepText(event.target.value)
          }
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              event.stopPropagation();
              save();
            }
          }}
        />
        {(error || editor.error) && <p role="alert">{error || editor.error}</p>}
        <div>
          <Button variant="ghost" onClick={close}>
            Back
          </Button>
          <Button disabled={editor.pending} onClick={save}>
            Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
