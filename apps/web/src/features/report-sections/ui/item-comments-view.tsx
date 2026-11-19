"use client";

import type { StatusOverviewItem } from "../model/status-overview";
import { useItemReplyScope } from "./item-reply-context";
import { StatusOverviewCommentsView } from "./status-overview-comments-view";
import { useItemDiscussion } from "./use-item-reply-composer";

interface ItemCommentsViewProps {
  readonly id: string;
  readonly item: StatusOverviewItem;
  readonly onClose: () => void;
}

// Mounted only while open: the live read exists only where the page provides
// the discussion capability. The draft and its delivery attempt live in the
// page's discussion store, so closing this view discards nothing.
function LiveItemComments({ id, item, onClose }: ItemCommentsViewProps) {
  const discussion = useItemDiscussion(item);
  return (
    <StatusOverviewCommentsView
      id={id}
      itemLabel={item.text}
      comments={discussion.comments}
      onClose={onClose}
      {...discussion.reply}
    />
  );
}

/** The open comments of one Overview item. */
export function ItemCommentsView(props: ItemCommentsViewProps) {
  return useItemReplyScope() ? (
    <LiveItemComments {...props} />
  ) : (
    <StatusOverviewCommentsView
      id={props.id}
      itemLabel={props.item.text}
      comments={props.item.comments}
      onClose={props.onClose}
    />
  );
}
