import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@weeklyreport/ui/components/ui/tabs";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";

import { OverviewVisibleWeek } from "./overview-record-context";
import { STATUS_OVERVIEW_COLUMNS } from "./status-overview-layout";

const TABLE_BREAKPOINT = 1087;
export function OverviewWeekGrid({
  children,
  plans,
}: {
  readonly children: ReactNode;
  readonly plans: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  const [week, setWeek] = useState("current");
  const id = useId();
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setNarrow(entry.contentRect.width < TABLE_BREAKPOINT);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="overview-table min-w-0" data-week={week}>
      <Tabs value={week} onValueChange={setWeek}>
        {narrow && (
          <TabsList aria-label="Reporting week" className="w-full">
            {STATUS_OVERVIEW_COLUMNS.map((column) => (
              <TabsTrigger
                key={column.source}
                value={column.source}
                data-overview-week-tab={column.source}
                id={id + column.source}
                aria-controls={id}
                className="min-h-11"
              >
                {column.label}
                {column.source === "current" && plans > 0 ? ` (${plans})` : ""}
              </TabsTrigger>
            ))}
          </TabsList>
        )}
        <div
          id={id}
          role={narrow ? "tabpanel" : undefined}
          aria-labelledby={narrow ? id + week : undefined}
        >
          <OverviewVisibleWeek.Provider value={narrow ? week : null}>
            {children}
          </OverviewVisibleWeek.Provider>
        </div>
      </Tabs>
    </div>
  );
}
