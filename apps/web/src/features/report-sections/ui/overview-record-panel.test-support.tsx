import {render} from "@testing-library/react";
import {vi} from "vitest";
import {resolveInitialItem} from "./item-edit-dialog-helpers";
import {createItemEditDraftStore} from "./item-edit-draft-store";
import {OverviewRecordContext} from "./overview-record-context";
import {item,projection} from "./status-overview-item-icons.test-support";
import {StatusOverviewItemPreview} from "./status-overview-item-preview";
export function setupPanel(step = false) {
  const store = createItemEditDraftStore({
    item:{...resolveInitialItem({item:null,week:"current",seedProduct:undefined,currentUserName:undefined}),text:"Original text",nextStepText:"Draft plan",stageNames:["Development"]},
    activities: [],
    products: [],
    week: "current",
  });
  const record = step ? projection : item;
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
          pending: false,
          error: null,
        },
        submitted: false,
      }}
    >
      <StatusOverviewItemPreview
        item={record}
        ownedStages={["Development", "Testing"]}
        onEditItem={vi.fn()}
      />
    </OverviewRecordContext.Provider>,
  );
  return { save, close, store };
}
