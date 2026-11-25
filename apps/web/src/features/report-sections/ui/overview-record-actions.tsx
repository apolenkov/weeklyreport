import { Button } from "@weeklyreport/ui/components/ui/button";
import {
  ArrowLeft,
  ArrowRight,
  type LucideIcon,
  Maximize2,
  MessageSquare,
  Trash2,
} from "lucide-react";
import type { RefObject } from "react";
import { toast } from "sonner";

import type { PanelProps } from "./overview-record-context";

export function RecordAction({
  label,
  Icon,
  reason,
  act,
}: {
  readonly label: string;
  readonly Icon: LucideIcon;
  readonly reason?: string | undefined;
  readonly act: () => void;
}) {
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label={label}
      title={reason ?? label}
      aria-disabled={!!reason}
      aria-description={reason}
      onUnavailable={() => toast.info(reason)}
      onClick={act}
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}
export function PanelActions({
  item,
  editor,
  openDiscussion,
  moveReason,
  dirty,
  actionRow,
  deletion,
  cancel,
  save,
  askDelete,
  details,
}: Pick<PanelProps, "item" | "editor" | "openDiscussion" | "moveReason"> & {
  dirty: boolean;
  actionRow: RefObject<HTMLDivElement | null>;
  deletion: string | undefined;
  cancel: () => void;
  save: () => void;
  askDelete: () => void;
  details: () => void;
}) {
  return (
    <div ref={actionRow} className="flex flex-wrap items-center gap-1">
      <RecordAction
        label={`Discussion (${item.comments.length})`}
        Icon={MessageSquare}
        act={openDiscussion}
      />
      <RecordAction
        label={
          item.source === "next" ? "Move to this week" : "Move to next week"
        }
        Icon={item.source === "next" ? ArrowLeft : ArrowRight}
        reason={
          moveReason ??
          (dirty
            ? "Save or cancel your changes first."
            : editor.move
              ? undefined
              : "This entry cannot be moved.")
        }
        act={() => editor.move?.()}
      />
      <RecordAction label="More details" Icon={Maximize2} act={details} />
      <RecordAction
        label="Delete"
        Icon={Trash2}
        act={askDelete}
        reason={editor.pending ? "Still saving." : deletion}
      />
      <Button variant="ghost" className="ml-auto" onClick={cancel}>
        {editor.failed ? "Discard" : "Cancel"}
      </Button>
      <Button
        disabled={editor.pending}
        onClick={editor.failed ? editor.save : save}
      >
        {editor.failed ? "Retry" : "Save"}
      </Button>
    </div>
  );
}
