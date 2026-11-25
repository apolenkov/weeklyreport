import { Popover, PopoverAnchor } from "@weeklyreport/ui/components/ui/popover";
import { MessageSquare, Pencil } from "lucide-react";
import {
  useContext,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { reviewRecordAnchor } from "../../../shared/ui/feedback/review-record-focus";
import { overviewMoveReason } from "../model/overview-move-reason";
import {
  OverviewRecordContext,
  OverviewUnitCollapsed,
  OverviewVisibleWeek,
} from "./overview-record-context";
import { OverviewRecordPanel } from "./overview-record-panel";
import { ReadOnlyPanel, RecordDiscussion } from "./overview-record-secondary";
import { moveShortcut } from "./overview-record-shortcut";
import { StageIcon } from "./overview-stages";
import { type ActionProps } from "./status-overview-item-actions";
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
    if (editable) onEditItem?.(item.editTarget);
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

function RecordTitle({
  item,
  activity,
  line: { trigger, editable, editor, reading, openRecord },
}: LineProps) {
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
      ref={trigger}
      data-overview-focus={`title:${item.source}:${item.stableId ?? item.key}`}
      aria-label={`${editable ? "Edit text" : "View text"}: ${item.text}, ${item.source === "next" ? "Next week" : "This week"}`}
      aria-expanded={!!editor || reading}
      aria-haspopup="dialog"
      onClick={openRecord}
      data-editable={editable}
      className="overview-record-trigger min-h-11 min-w-0 flex-1 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex min-w-0 flex-wrap items-center gap-1">
        {content}
      </span>
      {editable && (
        <Pencil aria-hidden="true" className="overview-pencil size-4" />
      )}
    </button>
  );
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
        onPointerUp={(event) => {
          if (event.target === event.currentTarget && line.editable)
            line.trigger.current?.click();
        }}
        onKeyDown={(event) => moveShortcut(props, event)}
      >
        <RecordStatus {...props} />
        <RecordTitle {...props} />
        {hasDiscussion && (
          <button
            aria-label={`Discussion: ${item.text}, ${item.comments.length} comments`}
            data-review-discussion=""
            aria-controls={line.commentsId}
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
        {item.workflowStatus === "paused" && item.pausedReason && (
          <span className="text-xs text-muted-foreground">
            {item.pausedReason}
          </span>
        )}
        {item.needsConfirmation && <span>Needs status</span>}
        {item.source !== "next" && (
          <>
            <ResolutionNote item={item} />
            <OutcomeAudit item={item} />
          </>
        )}
        {item.canRestore && props.onRestorePlan && (
          <button
            data-overview-focus={`restore:${item.source}:${item.stableId ?? item.key}`}
            onClick={() =>
              props.onRestorePlan?.(
                item,
                `restore:${item.source}:${item.stableId ?? item.key}`,
              )
            }
          >
            Restore
          </button>
        )}
      </div>
    </PopoverAnchor>
  );
}

function RecordPreview(props: ActionProps) {
  const line = useRecordLine(props);
  const collapsed = useContext(OverviewUnitCollapsed);
  const week = useContext(OverviewVisibleWeek);
  const visible = !collapsed && (!week || week === props.item.source);
  return (
    <Popover open={visible && (!!line.editor || line.reading)} modal={false}>
      <RecordLine {...props} line={line} />
      {visible && line.editor && (
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
      {visible && line.reading && (
        <ReadOnlyPanel
          {...line}
          item={props.item}
          closePanel={() => line.setReading(false)}
        />
      )}
      {visible && line.discussion && (
        <RecordDiscussion
          item={props.item}
          id={line.commentsId}
          origin={line.discussionOrigin}
          setDiscussion={line.setDiscussion}
        />
      )}
    </Popover>
  );
}

export function StatusOverviewItemPreview(props: ActionProps) {
  return (
    <RecordPreview
      key={`${props.item.source}:${props.item.stableId ?? props.item.key}`}
      {...props}
    />
  );
}
