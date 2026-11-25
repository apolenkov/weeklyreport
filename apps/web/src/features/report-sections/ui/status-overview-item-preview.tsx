import { Button } from "@weeklyreport/ui/components/ui/button";
import { Popover, PopoverAnchor } from "@weeklyreport/ui/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@weeklyreport/ui/components/ui/sheet";
import {
  ArrowRight,
  Maximize2,
  MessageSquare,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  useContext,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";

import { reviewRecordAnchor } from "../../../shared/ui/feedback/review-record-focus";
import { overviewMoveReason } from "../model/overview-move-reason";
import { ItemCommentsView } from "./item-comments-view";
import { RecordAction } from "./overview-record-actions";
import { OverviewRecordContext } from "./overview-record-context";
import { OverviewRecordPanel } from "./overview-record-panel";
import { OverviewRecordSurface } from "./overview-record-surface";
import { StageIcon } from "./overview-stages";
import {
  type ActionProps,
  weekMoveFocusKey,
} from "./status-overview-item-actions";
import { ResolutionNote } from "./status-overview-item-metadata";
import { OutcomeAudit } from "./status-overview-outcome-audit";
import { StatusControl } from "./status-overview-status-control";
import { StatusInput } from "./status-overview-status-input";
import { VerdictRail } from "./status-overview-verdict-controls";
import { useOverviewStatusInput } from "./use-overview-status-input";

const idleSubscribe = () => () => undefined;

function useRecordLine(props: ActionProps) {
  const { item, onEditItem } = props;
  const { active, submitted } = useContext(OverviewRecordContext);
  const editor =
    active?.source === item.source && active.id === item.recordId
      ? active
      : null;
  const dirty = useSyncExternalStore(
    editor?.store.subscribe ?? idleSubscribe,
    () => editor?.store.isDirty() ?? false,
    () => false,
  );
  const [reading, setReading] = useState(false);
  const [discussion, setDiscussion] = useState(false);
  const discussionOrigin = useRef<HTMLElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const commentsId = useId();
  const editable =
    !!item.editTarget && (!!onEditItem || !!editor) && !submitted;
  function openRecord() {
    if (editable && item.editTarget) onEditItem?.(item.editTarget);
    else setReading(true);
  }
  function openDiscussion() {
    discussionOrigin.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setDiscussion(true);
  }
  return {
    editor,
    submitted,
    dirty,
    reading,
    setReading,
    discussion,
    setDiscussion,
    discussionOrigin,
    trigger,
    commentsId,
    editable,
    openRecord,
    openDiscussion,
    moveReason: overviewMoveReason(item, props.occupied ?? false),
  };
}
type Line = ReturnType<typeof useRecordLine>;
type LineProps = ActionProps & { line: Line };

function RecordTitle({ item, activity, line }: LineProps) {
  const history = item.source === "previous";
  const content = (
    <>
      <span className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere]">
        {item.text}
      </span>
      {!activity &&
        item.stageNames.map((name) => (
          <span key={name} title={name} className={history ? "opacity-60" : ""}>
            <StageIcon name={name} />
          </span>
        ))}
    </>
  );
  if (history)
    return (
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {content}
      </span>
    );
  return (
    <button
      type="button"
      ref={line.trigger}
      data-overview-focus={`title:${item.source}:${item.stableId ?? item.key}`}
      aria-label={`${line.editable ? "Edit text" : "View text"}: ${item.text}, ${item.source === "next" ? "Next week" : "This week"}`}
      aria-expanded={!!line.editor || line.reading}
      aria-haspopup="dialog"
      onClick={line.openRecord}
      data-editable={line.editable}
      className="overview-record-trigger min-h-11 min-w-0 flex-1 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex min-w-0 flex-wrap items-center gap-1">
        {content}
      </span>
      {line.editable && (
        <Pencil aria-hidden="true" className="overview-pencil size-4" />
      )}
    </button>
  );
}

function moveShortcut(props: LineProps, event: React.KeyboardEvent) {
  const { item, line, onMoveItem } = props;
  if (
    !event.altKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.metaKey ||
    item.source === "previous" ||
    !onMoveItem
  )
    return;
  const current = item.source === "current";
  if (
    event.key !== (current ? "ArrowRight" : "ArrowLeft") ||
    (event.target instanceof Element &&
      event.target.closest("input,textarea,[role=dialog]"))
  )
    return;
  event.preventDefault();
  if (line.moveReason) toast.info(line.moveReason);
  else onMoveItem(item, current ? "next" : "current", weekMoveFocusKey(item));
}

function RecordStatus(props: LineProps) {
  const { item, line, onSetStatus } = props;
  const flow = useOverviewStatusInput(item, onSetStatus);
  if (item.source === "next") return null;
  if (item.source === "previous" && item.verdict === "pending") {
    if (!props.onVerdict)
      return (
        <span>
          <span role="img" aria-label="No outcome">
            ?
          </span>{" "}
          Not answered
        </span>
      );
    return (
      <VerdictRail
        item={item}
        onVerdict={props.onVerdict}
        onDecided={() => line.trigger.current?.focus()}
      />
    );
  }
  return (
    <>
      <StatusControl
        item={item}
        onSetStatus={onSetStatus ? flow.choose : undefined}
        onConfirmItem={props.onConfirmItem}
        onResolvePlan={props.onResolvePlan}
        onMoveItem={props.onMoveItem}
        moveReason={line.moveReason}
        lockReason={flow.lockReason}
      />
      <StatusInput item={item} flow={flow} />
    </>
  );
}
function RecordLine(props: LineProps) {
  const { item, line } = props;
  const history = item.source === "previous";
  const hasDiscussion = item.comments.length > 0 && !history;
  return (
    <PopoverAnchor asChild>
      <div
        role="group"
        tabIndex={-1}
        data-overview-item-preview=""
        data-open={!!line.editor || line.reading}
        aria-label={
          history && item.verdict === "pending"
            ? `Planned last week: ${item.text}`
            : undefined
        }
        id={
          item.recordId && hasDiscussion && !item.editTarget?.focusNextStep
            ? reviewRecordAnchor("item", item.recordId)
            : undefined
        }
        className="overview-record flex min-w-0 flex-wrap items-center gap-1 rounded-md text-sm data-[open=true]:ring-1 data-[open=true]:ring-ring"
        onPointerUp={event=>{if(event.target===event.currentTarget && line.editable)line.trigger.current?.click();}}
        onKeyDown={(event) => moveShortcut(props, event)}
      >
        <RecordStatus {...props} />
        <RecordTitle {...props} />
        {hasDiscussion && (
          <button
            aria-label={`Discussion: ${item.text}, ${item.comments.length} comments`}
            aria-haspopup="dialog"
            aria-expanded={line.discussion}
            onClick={line.openDiscussion}
            className="flex min-h-11 items-center gap-1"
          >
            <MessageSquare className="size-4" />
            {item.comments.length}
          </button>
        )}
        {line.dirty && (
          <span className="text-xs text-muted-foreground">Not saved</span>
        )}
        {item.needsConfirmation && <span>Needs status</span>}
        {item.source !== "next" && (
          <>
            <ResolutionNote item={item} />
            <OutcomeAudit item={item} />
          </>
        )}
        {item.canRestore && props.onRestorePlan && (
          <button onClick={() => props.onRestorePlan?.(item)}>Restore</button>
        )}
      </div>
    </PopoverAnchor>
  );
}

function ReadOnlyPanel({ line, item }: LineProps) {
  const close = () => {
    line.setReading(false);
    line.trigger.current?.focus();
  };
  const reason = "You do not have permission to edit this record.";
  return (
    <OverviewRecordSurface
      trigger={line.trigger}
      nested={line.discussion}
      dirty={false}
      close={() => line.setReading(false)}
      cancel={close}
    >
      <p className="whitespace-pre-wrap">{item.text}</p>
      <RecordAction
        label={`Discussion (${item.comments.length})`}
        Icon={MessageSquare}
        act={line.openDiscussion}
      />
      {!line.submitted && (
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
function RecordDiscussion({ line, item }: LineProps) {
  return (
    <Sheet open onOpenChange={line.setDiscussion}>
      <SheetContent
        aria-describedby={undefined}
        showCloseButton={false}
        className="p-4"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          line.discussionOrigin.current?.focus();
        }}
      >
        <SheetTitle>Discussion</SheetTitle>
        <ItemCommentsView
          id={line.commentsId}
          item={item}
          onClose={() => line.setDiscussion(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

function RecordPreview(props: ActionProps) {
  const line = useRecordLine(props);
  return (
    <Popover open={!!line.editor || line.reading} modal={false}>
      <RecordLine {...props} line={line} />
      {line.editor && (
        <OverviewRecordPanel
          item={props.item}
          editor={line.editor}
          owned={props.ownedStages ?? []}
          trigger={line.trigger}
          discussion={line.discussion}
          openDiscussion={line.openDiscussion}
          occupied={props.occupied ?? false}
          published={props.published ?? false}
          moveReason={line.moveReason}
        />
      )}
      {line.reading && <ReadOnlyPanel {...props} line={line} />}
      {line.discussion && <RecordDiscussion {...props} line={line} />}
    </Popover>
  );
}

export function StatusOverviewItemPreview(props: ActionProps) {
  return (
    <RecordPreview
      key={props.item.source + ":" + (props.item.stableId ?? props.item.key)}
      {...props}
    />
  );
}
