import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import type { Product } from "../model/types";
import { createItemEditDraftStore } from "./item-edit-draft-store";
import { StatusOverviewInlineItemEditor } from "./status-overview-inline-item-editor";

const products: Product[] = [
  { id: "p", name: "Product", overallStatus: "on-track", stages: [] },
];
const target = {
  kind: "item",
  parent: { kind: "product", id: "p", name: "Product" },
  week: "current",
} as const;
const stages = () => ["Build", "Test"];
function setup() {
  const draftStore = createItemEditDraftStore({
    item: null,
    products,
    activities: [],
    week: "current",
    defaultProductId: "p",
    stagesForProduct: stages,
  });
  return {
    target,
    products,
    activities: [],
    stagesForProduct: stages,
    draftStore,
    currentUserName: "Lead",
    onSave: vi.fn(),
    onSaveAndAddAnother: vi.fn(),
    onCancel: vi.fn(),
  };
}
describe("StatusOverviewInlineItemEditor", () => {
  it("validates stage selection and maps workflow status on save", async () => {
    const user = userEvent.setup();
    const props = setup();
    render(<StatusOverviewInlineItemEditor {...props} />);
    await user.type(screen.getByLabelText("Description"), "Result");
    await user.click(screen.getByRole("button", { name: "Details" }));
    await user.selectOptions(screen.getByLabelText("Progress"), "done");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Select at least one stage.")).toBeVisible();
    await user.click(screen.getByLabelText("Build"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed", stageNames: ["Build"] }),
    );
  });
  it("retains stale stages for explicit removal and validates latest eligibility", async () => {
    const user = userEvent.setup();
    const props = setup();
    const { rerender } = render(<StatusOverviewInlineItemEditor {...props} />);
    await user.type(screen.getByLabelText("Description"), "Draft");
    await user.click(screen.getByLabelText("Build"));
    rerender(
      <StatusOverviewInlineItemEditor
        {...props}
        stagesForProduct={() => ["Test"]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(props.onSave).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Remove unavailable stage Build" }),
    );
    await user.click(screen.getByLabelText("Test"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(props.onSave).toHaveBeenCalledOnce();
  });
  it("keeps pending input and guards cancel", async () => {
    const user = userEvent.setup();
    const props = setup();
    const requestCloseRef = createRef<(() => void) | null>();
    const { rerender } = render(
      <StatusOverviewInlineItemEditor
        {...props}
        requestCloseRef={requestCloseRef}
      />,
    );
    await user.type(screen.getByLabelText("Description"), "Draft");
    rerender(
      <StatusOverviewInlineItemEditor
        {...props}
        requestCloseRef={requestCloseRef}
        isPending
      />,
    );
    await user.type(screen.getByLabelText("Description"), " more");
    fireEvent.submit(screen.getByRole("form"));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Description")).toHaveValue("Draft more");
    rerender(
      <StatusOverviewInlineItemEditor
        {...props}
        requestCloseRef={requestCloseRef}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onCancel).not.toHaveBeenCalled();
    expect(
      screen.getByRole("alertdialog", { name: "Discard changes?" }),
    ).toBeVisible();
    expect(requestCloseRef.current).toBeTypeOf("function");
  });
  it("rejects a removed parent without losing the input", async () => {
    const user = userEvent.setup();
    const props = setup();
    const { rerender } = render(<StatusOverviewInlineItemEditor {...props} />);
    await user.type(screen.getByLabelText("Description"), "Draft");
    await user.click(screen.getByLabelText("Build"));
    rerender(<StatusOverviewInlineItemEditor {...props} products={[]} />);
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(
      screen.getByText("This parent is no longer eligible."),
    ).toBeVisible();
    expect(screen.getByLabelText("Description")).toHaveValue("Draft");
  });
  it("reveals and focuses a hidden invalid next step without losing input", async () => {
    const user = userEvent.setup();
    const activities = [{ id: "a", name: "Ops" }];
    const draftStore = createItemEditDraftStore({
      item: null,
      products: [],
      activities,
      week: "next",
      defaultActivityId: "a",
    });
    const onSave = vi.fn();
    render(
      <StatusOverviewInlineItemEditor
        target={{
          kind: "item",
          parent: { kind: "activity", id: "a", name: "Ops" },
          week: "next",
        }}
        products={[]}
        activities={activities}
        stagesForProduct={stages}
        draftStore={draftStore}
        currentUserName="Lead"
        onSave={onSave}
        onSaveAndAddAnother={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await user.type(screen.getByLabelText("Description"), "Keep this draft");
    await user.click(screen.getByRole("button", { name: "Details" }));
    await user.type(screen.getByLabelText("Next step"), "Invalid next step");
    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.queryByLabelText("Next step")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Next week item cannot have a next step/),
    ).toBeVisible();
    expect(screen.getByLabelText("Next step")).toHaveValue("Invalid next step");
    expect(screen.getByLabelText("Next step")).toHaveFocus();
    expect(screen.getByLabelText("Description")).toHaveValue("Keep this draft");
  });
  it("validates next week next step and supports activity keyboard save", async () => {
    const user = userEvent.setup();
    const onSaveAndAddAnother = vi.fn();
    const activity = {
      kind: "item",
      parent: { kind: "activity", id: "a", name: "Ops" },
      week: "next",
    } as const;
    const activities = [{ id: "a", name: "Ops" }];
    const draftStore = createItemEditDraftStore({
      item: null,
      products: [],
      activities,
      week: "next",
      defaultActivityId: "a",
    });
    render(
      <StatusOverviewInlineItemEditor
        target={activity}
        products={[]}
        activities={activities}
        stagesForProduct={stages}
        draftStore={draftStore}
        currentUserName="Lead"
        onSave={vi.fn()}
        onSaveAndAddAnother={onSaveAndAddAnother}
        onCancel={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByLabelText("Progress")).toHaveValue("planned");
    await user.type(screen.getByLabelText("Description"), "Activity");
    await user.type(screen.getByLabelText("Next step"), "Illegal plan");
    await user.keyboard("{Control>}{Shift>}{Enter}{/Shift}{/Control}");
    expect(onSaveAndAddAnother).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Next week item cannot have a next step/),
    ).toBeVisible();
    await user.clear(screen.getByLabelText("Next step"));
    await user.selectOptions(screen.getByLabelText("Progress"), "in_progress");
    await user.keyboard("{Control>}{Shift>}{Enter}{/Shift}{/Control}");
    expect(onSaveAndAddAnother).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "in-progress",
        activityId: "a",
        stageNames: [],
      }),
    );
  });
});
