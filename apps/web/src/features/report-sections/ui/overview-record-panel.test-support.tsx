import { render } from "@testing-library/react";
import { vi } from "vitest";

import type { StatusOverviewItem } from "../model/status-overview";
import { resolveInitialItem } from "./item-edit-dialog-helpers";
import { createItemEditDraftStore } from "./item-edit-draft-store";
import { OverviewRecordContext } from "./overview-record-context";
import { item, projection } from "./status-overview-item-icons.test-support";
import { StatusOverviewItemPreview } from "./status-overview-item-preview";
export function setupPanel(
  step = false,
  options: {
    record?: StatusOverviewItem;
    owned?: string[];
    selected?: string[];
    pending?: boolean;
    error?: string;
  } = {},
) {
  const record = options.record ?? (step ? projection : item);
  const move = vi.fn();
  const store = createItemEditDraftStore({
    item: {
      ...resolveInitialItem({
        item: null,
        week: "current",
        seedProduct: {
          id: "product-1",
          name: "Payments",
          stages: [],
          overallStatus: "on-track",
        },
        currentUserName: undefined,
      }),
      text: "Original text",
      nextStepText: "Draft plan",
      stageNames: options.selected ?? ["Development"],
    },
    activities: [],
    products: [],
    week: "current",
  });

  const save = vi.fn(),
    close = vi.fn();
  render(
    <OverviewRecordContext.Provider
      value={{
        active: {
          id: "item-1",
          source: record.source,
          store,
          save,
          close,
          details: vi.fn(),
          remove: vi.fn(),
          move,
          pending: options.pending ?? false,
          error: options.error ?? null,
        },
        submitted: false,
      }}
    >
      <StatusOverviewItemPreview
        item={record}
        ownedStages={options.owned ?? ["Development", "Testing"]}
        onEditItem={vi.fn()}
      />
    </OverviewRecordContext.Provider>,
  );
  return { save, close, store, move };
}
