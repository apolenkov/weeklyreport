import type { ReactNode } from "react";

import {
  STATUS_OVERVIEW_COLUMN_HEADER_IDS,
  type STATUS_OVERVIEW_COLUMNS,
} from "./status-overview-layout";

// One timeline cell of a week, named by its column heading.
export function Lane({
  column,
  className,
  children,
}: {
  readonly column: (typeof STATUS_OVERVIEW_COLUMNS)[number];
  readonly className: string;
  readonly children: ReactNode;
}) {
  return (
    <div
      data-overview-lineage-lane={column.source}
      role="group"
      aria-labelledby={STATUS_OVERVIEW_COLUMN_HEADER_IDS[column.key]}
      className={className}
    >
      {children}
    </div>
  );
}
