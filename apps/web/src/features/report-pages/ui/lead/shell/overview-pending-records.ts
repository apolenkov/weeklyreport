import type { ReportSectionReadModel } from "@weeklyreport/shared";

import {
  formSectionOf,
  sectionToDraftPayload,
} from "../../../../report-sections";
import type { ReadyEditor } from "./use-overview-controller";

interface PendingRecord {
  id: string;
  label: string;
  overviewFocus: string;
  fields: string;
}
function records(section: ReportSectionReadModel) {
  const payload = sectionToDraftPayload(section);
  const indexed = new Map<string, PendingRecord>();
  function add(
    kind: string,
    row: {
      stableId?: string | null | undefined;
      activityId?: string | null | undefined;
      id?: string | undefined;
    },
    text: string,
    product: string | null | undefined,
  ) {
    const { stableId, activityId: activity } = row;
    const id = `unsaved:${kind}:${stableId ?? indexed.size}`;
    const overviewFocus = product
      ? `product:${product}`
      : activity
        ? `activity:${activity}`
        : "report-details";
    const old = indexed.get(id);
    indexed.set(id, {
      id,
      overviewFocus,
      label: `Unsaved ${kind}: ${text}`,
      fields: (old?.fields ?? "") + JSON.stringify({ ...row, id: undefined }),
    });
  }
  for (const item of payload.items)
    add("item", item, item.text, item.projectId);
  for (const risk of payload.risks)
    add("risk", risk, risk.risk, risk.projectId);
  for (const decision of payload.decisions)
    add("decision", decision, decision.text, decision.productId);
  return indexed;
}

export function overviewPendingRecords(editor: ReadyEditor | null) {
  if (!editor) return [];
  const saved = editor.view.data.byPeriodData?.section;
  if (
    saved?.reportSectionId !== editor.draft.section.reportSectionId ||
    !(editor.draft.autosave.dirty || editor.draft.autosave.isInFlight)
  )
    return [];
  const before = records(formSectionOf(saved));
  const after = records(editor.draft.section);
  const pending: PendingRecord[] = [];
  for (const [key, row] of new Map([...before, ...after])) {
    if (before.get(key)?.fields !== after.get(key)?.fields) pending.push(row);
  }
  return pending;
}
