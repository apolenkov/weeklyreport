import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { StatusOverviewItem } from "../model/status-overview";
import { StatusOverviewItemPreview } from "./status-overview-item-preview";

const item: StatusOverviewItem = {
  key: "item-1",
  recordId: "item-1",
  source: "current",
  editTarget: { recordId: "item-1", source: "current" },
  stableId: "stable-1",
  text: "Original text",
  tag: "feature",
  stageNames: ["Development"],
  pausedReason: null,
  resolution: null,
  outcomeHistory: [],
  comments: [],
  canResolve: false,
  canRestore: false,
  workflowStatus: "in_progress",
  continuity: "continued",
};

const STATUS_BUTTON = "Choose outcome: Original text. Status: In progress";

describe("StatusOverviewItemPreview reveal and keyboard", () => {
  const handlers = {
    onEditItem: vi.fn(),
    onMoveItem: vi.fn(),
    onResolvePlan: vi.fn(),
    onSetStatus: vi.fn(),
    onSetStages: vi.fn(),
    ownedStages: ["Development", "Testing"],
  };

  it("reserves a decorative pencil and keeps hover free of extra controls",async()=>{
 render(<StatusOverviewItemPreview item={item} {...handlers}/>);
 const title=screen.getByRole("button",{name:"Edit text: Original text, This week"});
 expect(title.querySelector(".overview-pencil")).toHaveAttribute("aria-hidden","true");
 const controls=screen.getAllByRole("button");
 await userEvent.hover(title);
 expect(screen.getAllByRole("button")).toEqual(controls);
 expect(screen.queryByRole("button",{name:/Move|Discussion|Edit details/i})).toBeNull();
 });
 it("tabs from status to the record without adding stops for its stages",async()=>{
 render(<StatusOverviewItemPreview item={item} {...handlers}/>);
 await userEvent.tab();expect(screen.getByRole("button",{name:STATUS_BUTTON})).toHaveFocus();
 await userEvent.tab();const title=screen.getByRole("button",{name:/Edit text:/});expect(title).toHaveFocus();
 await userEvent.keyboard("{Enter}");expect(handlers.onEditItem).toHaveBeenCalledWith(item.editTarget);
 });
 it("opens the same record when its stage is tapped",async()=>{
 render(<StatusOverviewItemPreview item={item} {...handlers}/>);
 await userEvent.click(screen.getByRole("img",{name:"Stage: Development"}));
 expect(handlers.onEditItem).toHaveBeenCalledWith(item.editTarget);
 });
 it("withholds the pencil from frozen results",()=>{
 render(<StatusOverviewItemPreview item={{...item,source:"previous",editTarget:null}}/>);
 expect(document.querySelector(".overview-pencil")).toBeNull();
 expect(screen.queryByRole("button")).toBeNull();
 });
});
