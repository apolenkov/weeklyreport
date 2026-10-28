import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { KanbanItem, Product } from "../model/types";
import { createItemEditDraftStore } from "./item-edit-draft-store";
import { ItemInlineEditor } from "./item-inline-editor";

const products: Product[] = [
  {
    id: "product",
    name: "Payments",
    overallStatus: "on-track",
    stages: [
      {
        stageName: "Development",
        ownership: "mine",
        status: "on-track",
        assignee: "Lead",
      },
    ],
  },
];
const base = {
  item: null,
  products,
  defaultProductId: "product",
  week: "current" as const,
  stagesForProduct: () => ["Development"],
  currentUserName: "Lead",
  onCancel: vi.fn(),
};

describe("ItemInlineEditor", () => {
  it("offers a simplified overview editor without legacy planning fields", async () => {
    const user = userEvent.setup();
    const onWeekChange = vi.fn();
    render(
      <ItemInlineEditor
        {...base}
        onSave={vi.fn()}
        onWeekChange={onWeekChange}
        showNextStep={false}
        showPriority={false}
      />,
    );

    expect(screen.queryByRole("textbox", { name: /Next step/ })).toBeNull();
    expect(screen.queryByLabelText(/Priority rank/)).toBeNull();
    expect(
      screen.getByRole("radiogroup", { name: "Active week" }),
    ).toBeVisible();

    const nextWeek = screen.getByRole("radio", { name: "Next week" });
    nextWeek.focus();
    expect(nextWeek).toHaveFocus();
    expect(nextWeek.closest("label")).toHaveClass(
      "focus-within:ring-2",
      "focus-within:ring-[var(--color-ring)]",
    );

    await user.click(nextWeek);
    expect(onWeekChange).toHaveBeenCalledWith("next");
  });

  it("hides a legacy next-week field in the basic editor without clearing its value", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const legacyItem: KanbanItem = {
      id: "legacy-current",
      parent: { kind: "product", id: "product" },
      productId: "product",
      productName: "Payments",
      activityId: null,
      stageNames: ["Development"],
      status: "in-progress",
      text: "Current result",
      nextStepText: "Preserve this next-week plan",
      author: "Lead",
    };
    const draftStore = createItemEditDraftStore({
      ...base,
      activities: [],
      item: legacyItem,
    });
    render(
      <ItemInlineEditor
        {...base}
        item={legacyItem}
        draftStore={draftStore}
        onSave={onSave}
        showNextStep={false}
        showPriority={false}
      />,
    );

    expect(screen.queryByLabelText(/Next step/)).toBeNull();
    await user.click(screen.getByText("Done"));
    await user.click(screen.getByText("Save update"));
    expect(onSave).not.toHaveBeenCalled();
    const guidance = document.querySelector<HTMLElement>('[role="alert"]');
    expect(guidance).not.toBeNull();
    // TASK-503.22 / C5002: the focused fallback also states the actual rule.
    expect(guidance).toHaveTextContent(
      "A completed item cannot have a next step.",
    );
    expect(guidance).not.toHaveTextContent("Cancel, then choose");
    const nextStep = screen.getByRole("textbox", { name: /Next step/ });
    expect(nextStep).toHaveValue("Preserve this next-week plan");
    expect(nextStep).toHaveFocus();
    await user.clear(nextStep);
    expect(nextStep).toBeInTheDocument();
    expect(nextStep).toHaveFocus();
    await user.type(nextStep, "Revised");
    expect(nextStep).toHaveValue("Revised");
    await user.clear(nextStep);
    await user.click(screen.getByRole("button", { name: "Save update" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed", nextStepText: null }),
    );
    expect(draftStore.getSnapshot()).toMatchObject({
      text: "Current result",
      nextStepText: "",
    });
  });

  it("retains entered result and plan when its timeline row is remounted", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const draftStore = createItemEditDraftStore({ ...base, activities: [] });
    const { rerender } = render(
      <ItemInlineEditor
        key="before-echo"
        {...base}
        draftStore={draftStore}
        onSave={onSave}
      />,
    );
    await user.type(
      screen.getByRole("textbox", { name: /Description/ }),
      "My unsaved result",
    );
    await user.type(
      screen.getByRole("textbox", { name: /Next step/ }),
      "My next commitment",
    );
    rerender(
      <ItemInlineEditor
        key="after-echo"
        {...base}
        draftStore={draftStore}
        onSave={onSave}
      />,
    );
    expect(screen.getByRole("textbox", { name: /Description/ })).toHaveValue(
      "My unsaved result",
    );
    expect(screen.getByRole("textbox", { name: /Next step/ })).toHaveValue(
      "My next commitment",
    );
    await user.click(screen.getByRole("button", { name: "Save update" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "My unsaved result",
        nextStepText: "My next commitment",
      }),
    );
  });

  it("keeps recovery fields available but blocks both click and keyboard saving", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ItemInlineEditor {...base} saveDisabled onSave={onSave} />);
    const text = screen.getByRole("textbox", { name: /Description/ });
    await user.type(text, "Retain this result");
    expect(screen.getByRole("button", { name: "Save update" })).toBeDisabled();
    fireEvent.keyDown(text, { key: "Enter", ctrlKey: true });
    fireEvent.submit(screen.getByRole("form"));
    expect(onSave).not.toHaveBeenCalled();
    expect(text).toHaveValue("Retain this result");
  });

  it("moves focus to Cancel when a save locks the focused control, so Escape still asks to discard", async () => {
    const user = userEvent.setup();
    const props = { ...base, onSave: vi.fn() };
    const { rerender } = render(<ItemInlineEditor {...props} />);
    await user.type(
      screen.getByRole("textbox", { name: /Description/ }),
      "Pending canonical save",
    );
    screen.getByRole("button", { name: "Save update" }).focus();

    rerender(<ItemInlineEditor {...props} saveDisabled />);

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("alertdialog", { name: "Discard changes?" }),
    ).toBeVisible();
  });

  it("moves focus to Cancel when a save disables the textarea that held it", async () => {
    const user = userEvent.setup();
    const props = { ...base, onSave: vi.fn() };
    const { rerender } = render(<ItemInlineEditor {...props} />);
    const text = screen.getByRole("textbox", { name: /Description/ });
    await user.type(text, "Saved with Ctrl+Enter");

    rerender(<ItemInlineEditor {...props} saveDisabled confirmationOnly />);

    expect(text).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("keeps focus in an enabled field when a save only blocks the Save button", async () => {
    const user = userEvent.setup();
    const props = { ...base, onSave: vi.fn() };
    const { rerender } = render(<ItemInlineEditor {...props} />);
    const text = screen.getByRole("textbox", { name: /Description/ });
    await user.type(text, "Still editing");

    rerender(<ItemInlineEditor {...props} saveDisabled />);

    expect(text).toHaveFocus();
  });

  it("does not pull focus back once the user has left the editor", async () => {
    const user = userEvent.setup();
    const props = { ...base, onSave: vi.fn() };
    const { rerender } = render(<ItemInlineEditor {...props} />);
    screen.getByRole("button", { name: "Save update" }).focus();
    await user.click(document.body);
    expect(document.body).toHaveFocus();

    rerender(<ItemInlineEditor {...props} saveDisabled />);

    expect(screen.getByRole("button", { name: "Cancel" })).not.toHaveFocus();
    expect(document.body).toHaveFocus();
  });

  it("saves a current commitment without claiming that work started", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ItemInlineEditor {...base} onSave={onSave} />);
    await user.type(
      screen.getByRole("textbox", { name: /Description/ }),
      "Start API implementation",
    );
    await user.click(screen.getByRole("button", { name: "Not started" }));
    await user.click(screen.getByRole("button", { name: "Save update" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ status: "planned", pausedReason: null }),
    );
  });
  it("guards browser unload only while the composer holds unsaved input", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ItemInlineEditor {...base} onSave={vi.fn()} />);
    const pristine = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(pristine);
    expect(pristine.defaultPrevented).toBe(false);
    await user.type(
      screen.getByRole("textbox", { name: /Description/ }),
      "Unsaved result",
    );
    const pending = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(pending);
    expect(pending.defaultPrevented).toBe(true);
    unmount();
    const closed = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(closed);
    expect(closed.defaultPrevented).toBe(false);
  });
  it("focuses text without a modal, preselects one stage and saves through the shared builder", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ItemInlineEditor {...base} onSave={onSave} />);
    const input = screen.getByRole("textbox", { name: /Description/ });
    expect(input).toHaveFocus();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Applied automatically")).toBeVisible();
    expect(
      screen.getByRole("group", { name: "SDLC Stages" }),
    ).toHaveTextContent("Development");
    await user.type(input, "Payment retry shipped");
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Payment retry shipped",
        stageNames: ["Development"],
        productId: "product",
        status: "in-progress",
      }),
    );
  });

  it("keeps typed input on blur, details expansion and validation failure", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ItemInlineEditor
        {...base}
        stagesForProduct={() => ["Development", "Testing"]}
        onSave={onSave}
      />,
    );
    const input = screen.getByRole("textbox", { name: /Description/ });
    await user.type(input, "Investigate retry");
    await user.click(screen.getByText("Edit details"));
    expect(input).toHaveValue("Investigate retry");
    expect(onSave).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save update" }));
    expect(screen.getByText("Select at least one stage.")).toBeVisible();
    expect(input).toHaveValue("Investigate retry");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not trap Tab and cancels Escape without saving", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(
      <>
        <ItemInlineEditor {...base} onSave={onSave} onCancel={onCancel} />
        <button type="button">After editor</button>
      </>,
    );
    const details = screen.getByText("Edit details");
    await user.click(details);
    screen.getByLabelText(/Priority rank/).focus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Save update" })).toHaveFocus();
    await user.tab();
    await user.tab();
    expect(screen.getByRole("button", { name: "After editor" })).toHaveFocus();
    const input = screen.getByRole("textbox", { name: /Description/ });
    input.focus();
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("requires a pause reason and clears it on changing progress", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ItemInlineEditor {...base} onSave={onSave} />);
    await user.type(
      screen.getByRole("textbox", { name: /Description/ }),
      "Retry work",
    );
    await user.click(screen.getByRole("button", { name: /Paused/ }));
    await user.click(screen.getByRole("button", { name: "Save update" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(
      screen.getByText("A reason is required to pause an item."),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Done/i }));
    await user.click(screen.getByRole("button", { name: "Save update" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed", pausedReason: null }),
    );
  });

  it("saves the result and the next step as distinct texts", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ItemInlineEditor {...base} onSave={onSave} />);
    await user.type(
      screen.getByRole("textbox", { name: /Description/ }),
      "Shipped retry telemetry",
    );
    await user.type(
      screen.getByRole("textbox", { name: /Next step/ }),
      "Review the first production traces",
    );
    await user.click(screen.getByRole("button", { name: "Save update" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Shipped retry telemetry",
        nextStepText: "Review the first production traces",
      }),
    );
  });

  it("clears only the next step, preserving the saved result", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <ItemInlineEditor
        {...base}
        item={{
          id: "item-with-plan",
          parent: { kind: "product", id: "product" },
          productId: "product",
          productName: "Payments",
          activityId: null,
          stageNames: ["Development"],
          status: "in-progress",
          text: "Retry telemetry is live",
          author: "Lead",
          nextStepText: "Review traces",
        }}
        onSave={onSave}
      />,
    );
    const nextStep = screen.getByRole("textbox", { name: /Next step/ });
    expect(nextStep).toHaveValue("Review traces");
    await user.clear(nextStep);
    await user.click(screen.getByRole("button", { name: "Save update" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Retry telemetry is live",
        nextStepText: null,
      }),
    );
  });

  it("keeps an invalid completed plan visible and focuses its actionable error", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ItemInlineEditor {...base} onSave={onSave} />);
    await user.type(
      screen.getByRole("textbox", { name: /Description/ }),
      "Retried the payment",
    );
    const nextStep = screen.getByRole("textbox", { name: /Next step/ });
    await user.type(nextStep, "Monitor the recovery");
    await user.click(screen.getByRole("button", { name: /Done/i }));
    await user.click(screen.getByRole("button", { name: "Save update" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(nextStep).toHaveFocus();
    expect(nextStep).toHaveValue("Monitor the recovery");
    expect(
      screen.getByText(
        "A completed item cannot have a next step. Resume it or clear the plan.",
      ),
    ).toBeVisible();
  });

  it("keeps a paused plan visible and explains that carry-over is suspended", async () => {
    const user = userEvent.setup();
    render(<ItemInlineEditor {...base} onSave={vi.fn()} />);
    await user.type(
      screen.getByRole("textbox", { name: /Next step/ }),
      "Resume after the vendor responds",
    );
    await user.click(screen.getByRole("button", { name: /Paused/ }));
    expect(
      screen.getByText(
        "This plan is retained, but carry-over is suspended until you resume this item.",
      ),
    ).toBeVisible();
  });

  it("focuses the next step when the overview opens the saved plan", () => {
    render(
      <ItemInlineEditor {...base} focusNextStep={true} onSave={vi.fn()} />,
    );
    expect(screen.getByRole("textbox", { name: /Next step/ })).toHaveFocus();
  });
  it("renders Save and add another button in create mode and calls onSaveAndAddAnother on click", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onSaveAndAddAnother = vi.fn();
    render(
      <ItemInlineEditor
        {...base}
        item={null}
        onSave={onSave}
        onSaveAndAddAnother={onSaveAndAddAnother}
      />,
    );

    const btn = screen.getByRole("button", { name: "Save and add another" });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();

    await user.type(
      screen.getByRole("textbox", { name: /Description/ }),
      "First batch item",
    );
    await user.click(btn);

    expect(onSaveAndAddAnother).toHaveBeenCalledTimes(1);
    expect(onSaveAndAddAnother).toHaveBeenCalledWith(
      expect.objectContaining({ text: "First batch item" }),
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not render Save and add another button in edit mode", () => {
    const onSave = vi.fn();
    const onSaveAndAddAnother = vi.fn();
    const existingItem: KanbanItem = {
      id: "item-1",
      parent: { kind: "product", id: "product" },
      productId: "product",
      productName: "Lead project",
      activityId: null,
      text: "Existing text",
      status: "in-progress",
      author: "Lead",
      stageNames: ["Development"],
    };
    render(
      <ItemInlineEditor
        {...base}
        item={existingItem}
        onSave={onSave}
        onSaveAndAddAnother={onSaveAndAddAnother}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Save and add another" }),
    ).toBeNull();
  });
});

describe("ItemInlineEditor discard guard", () => {
  it("confirms before discarding typed text and keeps it on Keep editing", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ItemInlineEditor {...base} onCancel={onCancel} onSave={vi.fn()} />);
    const text = screen.getByRole("textbox", { name: /Description/ });
    await user.type(text, "Draft update");
    await user.keyboard("{Escape}");

    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Discard changes?",
    );
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(text).toHaveValue("Draft update");
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("treats a status-only change as dirty and closes a clean draft at once", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ItemInlineEditor {...base} onCancel={onCancel} onSave={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Done" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
