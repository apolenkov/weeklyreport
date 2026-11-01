import { useDndContext, useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";

import type { StatusOverviewItem } from "../model/status-overview";
import { overviewDroppableId, resolveDrop } from "../model/status-overview-dnd";
import {
  STATUS_OVERVIEW_COLUMN_HEADER_IDS,
  type STATUS_OVERVIEW_COLUMNS,
} from "./status-overview-layout";

const DROP_TARGET_CLASS =
  "ring-2 ring-inset ring-[var(--color-ring)] bg-[var(--color-surface-hover)]";

// One timeline cell of a week. Current and Next lanes are drop targets while
// the pointer is inside them and the dragged card may actually land there —
// the own lane and Previous never light up.
export function Lane({
  column,
  laneKey,
  className,
  children,
}: {
  readonly column: (typeof STATUS_OVERVIEW_COLUMNS)[number];
  readonly laneKey: string;
  readonly className: string;
  readonly children: ReactNode;
}) {
  const source = column.source;
  const { setNodeRef, isOver } = useDroppable({
    id: overviewDroppableId(source, laneKey),
    data: { column: source },
    disabled: source === "previous",
  });
  const { active } = useDndContext();
  const dragged = active?.data.current?.item as StatusOverviewItem | undefined;
  const accepts = isOver && resolveDrop(dragged, source) !== null;
  return (
    <div
      ref={setNodeRef}
      data-overview-lineage-lane={source}
      role="group"
      aria-labelledby={STATUS_OVERVIEW_COLUMN_HEADER_IDS[column.key]}
      className={accepts ? `${className} ${DROP_TARGET_CLASS}` : className}
    >
      {children}
    </div>
  );
}
