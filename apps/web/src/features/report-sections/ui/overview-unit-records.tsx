import { AlertDialog } from "@weeklyreport/ui/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@weeklyreport/ui/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@weeklyreport/ui/components/ui/sheet";
import { useContext, useState } from "react";

import type { StatusOverviewUnit } from "../model/status-overview";
import { OverviewRecordContext } from "./overview-record-context";
import type { ItemHandlers } from "./status-overview-item-handlers";
export function OverviewUnitRecords({
  unit,
  onAddRecord,
}: {
  readonly unit: StatusOverviewUnit;
  readonly onAddRecord: ItemHandlers["onAddRecord"];
}) {
  const { deleteRecord } = useContext(OverviewRecordContext);
  const [openId, setOpenId] = useState<string | null>(null);
  const records = unit.records ?? [];
  const selected = records.find((row) => row.key === openId);
  const risks = records.filter((row) => row.kind === "risk").length;
  return (
    <div className="flex flex-wrap items-start gap-2 text-sm">
      {!unit.historical && onAddRecord && (
        <button
          data-overview-focus={`add-risk:${unit.key}`}
          className="min-h-11 rounded-md px-2 text-primary"
          onClick={() =>
            onAddRecord({ kind: "risk", unitKind: unit.kind, unitId: unit.id })
          }
        >
          + Risk or decision
        </button>
      )}
      {(!onAddRecord || unit.historical || records.length > 0) && (
        <Collapsible>
          <CollapsibleTrigger className="min-h-11 px-2">
            {risks} {risks === 1 ? "risk" : "risks"} · {records.length - risks}{" "}
            {records.length - risks === 1 ? "decision" : "decisions"}
          </CollapsibleTrigger>
          <CollapsibleContent>
            {records.length > 0 ? (
              <ul>
                {records.map((record) => (
                  <li key={record.key}>
                    <button
                      className="min-h-11 text-left underline"
                      onClick={() => setOpenId(record.key)}
                    >
                      {record.text}
                    </button>
                    <small>
                      {record.kind} ·{" "}
                      {
                        record.details.find(
                          ([label]) => label === "Severity",
                        )?.[1]
                      }{" "}
                      {record.details.some(([, value]) => !value)
                        ? " · Incomplete"
                        : ""}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No risks or decisions.</p>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
      {selected && (
        <RecordDetails
          selected={selected}
          close={() => setOpenId(null)}
          deleteRecord={deleteRecord}
        />
      )}
    </div>
  );
}

function RecordDetails({
  selected,
  close,
  deleteRecord,
}: {
  selected: NonNullable<StatusOverviewUnit["records"]>[number];
  close: () => void;
  deleteRecord: React.ContextType<typeof OverviewRecordContext>["deleteRecord"];
}) {
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <SheetContent className="p-4" aria-describedby={undefined}>
        <SheetTitle>
          {selected.kind === "risk" ? "Risk" : "Decision"}
        </SheetTitle>
        <p>{selected.text}</p>
        <dl>
          {selected.details.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value ?? "Not provided"}</dd>
            </div>
          ))}
        </dl>
        {deleteRecord && selected.stableId && (
          <AlertDialog.Root>
            <AlertDialog.Trigger>Delete</AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Overlay className="fixed inset-0 z-(--layer-overlay) bg-overlay" />
              <AlertDialog.Content className="fixed top-1/2 left-1/2 z-(--layer-dialog) -translate-x-1/2 rounded border bg-card p-4">
                <AlertDialog.Title>
                  Delete this {selected.kind}?
                </AlertDialog.Title>
                <AlertDialog.Description>
                  {selected.text}
                </AlertDialog.Description>
                <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
                <AlertDialog.Action
                  onClick={() => {
                    if (selected.stableId)
                      deleteRecord(selected.kind, selected.stableId);
                    close();
                  }}
                >
                  Delete
                </AlertDialog.Action>
              </AlertDialog.Content>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        )}
      </SheetContent>
    </Sheet>
  );
}
