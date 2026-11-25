import { toast } from "sonner";

import {
  type ActionProps,
  weekMoveFocusKey,
} from "./status-overview-item-actions";
function isWeekShortcut(event: React.KeyboardEvent) {
  return (
    event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.metaKey &&
    ["ArrowRight", "ArrowLeft"].includes(event.key) &&
    !(
      event.target instanceof Element &&
      event.target.closest("input,textarea,[role=dialog]")
    )
  );
}

export function moveShortcut(
  props: ActionProps & { line: { moveReason: string | undefined } },
  event: React.KeyboardEvent,
) {
  const { item, line, onMoveItem } = props;
  if (!isWeekShortcut(event) || item.source === "previous" || !onMoveItem)
    return;
  const current = item.source === "current";
  event.preventDefault();
  if (event.key !== (current ? "ArrowRight" : "ArrowLeft")) {
    toast.info(
      current
        ? "Already in This week. Nothing was moved."
        : "Already in Next week. Nothing was moved.",
    );
    return;
  }
  if (line.moveReason) toast.info(line.moveReason);
  else onMoveItem(item, current ? "next" : "current", weekMoveFocusKey(item));
}
