import { Button } from "@weeklyreport/ui/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@weeklyreport/ui/components/ui/sheet";
import { ArrowRight, Maximize2, MessageSquare, Trash2 } from "lucide-react";
import type { RefObject } from "react";
import { toast } from "sonner";

import type { StatusOverviewItem } from "../model/status-overview";
import { ItemCommentsView } from "./item-comments-view";
import { RecordAction } from "./overview-record-actions";
import { OverviewRecordSurface } from "./overview-record-surface";
export function ReadOnlyPanel({
  item,
  trigger,
  closePanel,
  submitted,
  discussion,
  openDiscussion,
}: {
  item: StatusOverviewItem;
  trigger: RefObject<HTMLButtonElement | null>;
  closePanel: () => void;
  submitted: boolean;
  discussion: boolean;
  openDiscussion: () => void;
}) {
  const close = () => {
    closePanel();
    trigger.current?.focus();
  };
  const reason = "You do not have permission to edit this record.";
  return (
    <OverviewRecordSurface
      trigger={trigger}
      nested={discussion}
      dirty={false}
      close={closePanel}
      cancel={close}
    >
      <p className="whitespace-pre-wrap">{item.text}</p>
      <RecordAction
        label={`Discussion (${item.comments.length})`}
        Icon={MessageSquare}
        act={openDiscussion}
      />
      {!submitted && (
        <>
          {(
            [
              [
                item.source === "next"
                  ? "Move to this week"
                  : "Move to next week",
                ArrowRight,
              ],
              ["More details", Maximize2],
              ["Delete", Trash2],
            ] as const
          ).map(([label, Icon]) => (
            <RecordAction
              key={label}
              label={label}
              Icon={Icon}
              reason={reason}
              act={() => undefined}
            />
          ))}
          <Button
            aria-disabled
            aria-description={reason}
            title={reason}
            onUnavailable={() => toast.info(reason)}
          >
            Save
          </Button>
        </>
      )}
      <button onClick={close}>Close</button>
    </OverviewRecordSurface>
  );
}
export function RecordDiscussion({
  item,
  setDiscussion,
  origin,
  id,
}: {
  item: StatusOverviewItem;
  setDiscussion: (open: boolean) => void;
  origin: RefObject<HTMLElement | null>;
  id: string;
}) {
  const heading = origin.current
    ?.closest("section")
    ?.querySelector<HTMLElement>("[data-overview-focus-heading]");
  return (
    <Sheet open onOpenChange={setDiscussion}>
      <SheetContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="p-4"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (event.target instanceof HTMLElement)
            (
              event.target.querySelector<HTMLElement>("textarea:enabled") ??
              event.target.querySelector<HTMLElement>("h2")
            )?.focus();
        }}
        onEscapeKeyDown={(event) => {
          if (event.isComposing) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const target = origin.current?.isConnected ? origin.current : heading;
          target?.focus();
        }}
      >
        <SheetTitle tabIndex={-1}>Discussion</SheetTitle>
        <ItemCommentsView
          id={id}
          item={item}
          onClose={() => setDiscussion(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
