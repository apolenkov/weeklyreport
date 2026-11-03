import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ItemComposerProps } from "../model/contextual-entry-contract";
import { firstInvalidControl } from "./item-edit-dialog-helpers";
import { StatusOverviewInlineItemForm } from "./status-overview-inline-item-form";

function props(): ItemComposerProps {
  return {
    target: {
      kind: "item",
      parent: { kind: "product", id: "p", name: "Atlas" },
      week: "next",
    },
    value: {
      text: "Draft",
      nextStepText: "Next",
      stageNames: ["Build"],
      status: "planned",
      pausedReason: "",
    },
    view: {
      eligibleStages: ["Build", "Test"],
      authorName: "Alex",
      errors: {},
      message: null,
      pending: false,
      dirty: true,
      canSubmit: true,
    },
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };
}

describe("StatusOverviewInlineItemForm", () => {
  it("lets a user remove an obsolete stage and select an eligible replacement", async () => {
    const user = userEvent.setup();
    const p = props();
    function ControlledForm({ stages }: { stages: string[] }) {
      const [value, setValue] = useState(p.value);
      return (
        <StatusOverviewInlineItemForm
          {...p}
          value={value}
          onChange={setValue}
          view={{
            ...p.view,
            eligibleStages: stages,
            errors: { stageNames: "Choose an eligible stage" },
          }}
        />
      );
    }
    const { rerender } = render(<ControlledForm stages={["Build", "Test"]} />);
    expect(screen.getByLabelText("Build")).toBeChecked();
    rerender(<ControlledForm stages={[]} />);
    const group = screen.getByRole("group", { name: "Stages (required)" });
    expect(group).toHaveAccessibleDescription(
      "No eligible stages available. Choose an eligible stage",
    );
    firstInvalidControl(
      { stageNames: "Choose an eligible stage" },
      group.closest("form"),
    )?.focus();
    expect(group).toHaveFocus();
    expect(screen.getByText(/Unavailable stage: Build/)).toBeInTheDocument();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Remove unavailable stage Build" }),
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    rerender(<ControlledForm stages={["Test"]} />);
    await user.click(screen.getByLabelText("Test"));
    expect(screen.getByLabelText("Test")).toBeChecked();
    expect(screen.getByLabelText("Description")).toHaveValue("Draft");
  });
  it("keeps newer edits usable while a save is pending without submitting twice", async () => {
    const user = userEvent.setup();
    const p = props();
    function ControlledForm() {
      const [value, setValue] = useState(p.value);
      return (
        <StatusOverviewInlineItemForm
          {...p}
          value={value}
          onChange={setValue}
          view={{ ...p.view, pending: true }}
        />
      );
    }
    render(<ControlledForm />);
    await user.type(screen.getByLabelText("Description"), " newer");
    await user.type(screen.getByLabelText("Next step"), " later");
    await user.selectOptions(screen.getByLabelText("Progress"), "paused");
    await user.type(screen.getByLabelText("Pause reason"), "Waiting");
    await user.click(screen.getByLabelText("Test"));
    expect(screen.getByLabelText("Description")).toHaveValue("Draft newer");
    expect(screen.getByLabelText("Next step")).toHaveValue("Next later");
    expect(screen.getByLabelText("Pause reason")).toHaveValue("Waiting");
    expect(screen.getByLabelText("Test")).toBeChecked();
    expect(screen.getByRole("status")).toHaveTextContent("Saving");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Save and add another" }),
    ).toBeDisabled();
    await user.keyboard("{Control>}{Shift>}{Enter}{/Shift}{/Control}");
    expect(p.onSubmit).not.toHaveBeenCalled();
  });
  it("shows context and controlled progress, and emits edits and stages", () => {
    const p = props();
    render(<StatusOverviewInlineItemForm {...p} />);
    expect(screen.getByText(/Atlas/)).toBeInTheDocument();
    expect(screen.getByText(/Next week/)).toBeInTheDocument();
    expect(screen.getByText(/Alex/)).toBeInTheDocument();
    expect(screen.getByLabelText("Progress")).toHaveValue("planned");
    fireEvent.change(screen.getByLabelText("Progress"), {
      target: { value: "in_progress" },
    });
    expect(p.onChange).toHaveBeenCalledWith({
      ...p.value,
      status: "in_progress",
    });
    fireEvent.click(screen.getByLabelText("Test"));
    expect(p.onChange).toHaveBeenCalledWith({
      ...p.value,
      stageNames: ["Build", "Test"],
    });
  });
  it("distinguishes Current product from Next activity context and labels", () => {
    const p = props();
    const { rerender } = render(
      <StatusOverviewInlineItemForm
        {...p}
        target={{ ...p.target, week: "current" }}
      />,
    );
    expect(
      screen.getByRole("form", { name: "Add item for Atlas, current week" }),
    ).toHaveTextContent("Product: Atlas · Current week · Owner: Alex");
    expect(screen.getByRole("option", { name: "Not started" })).toHaveValue(
      "planned",
    );
    expect(
      screen.getByRole("group", { name: "Stages (required)" }),
    ).toBeInTheDocument();
    rerender(
      <StatusOverviewInlineItemForm
        {...p}
        target={{
          ...p.target,
          parent: { kind: "activity", id: "a", name: "Support" },
        }}
      />,
    );
    expect(
      screen.getByRole("form", { name: "Add item for Support, next week" }),
    ).toHaveTextContent("Activity: Support · Next week · Owner: Alex");
    expect(screen.getByRole("option", { name: "Planned" })).toHaveValue(
      "planned",
    );
    expect(
      screen.queryByRole("group", { name: "Stages (required)" }),
    ).not.toBeInTheDocument();
  });
  it("exposes validation errors on the related fields and prevents invalid submission", () => {
    const p = props();
    render(
      <StatusOverviewInlineItemForm
        {...p}
        value={{
          ...p.value,
          text: "",
          status: "paused",
          pausedReason: "",
          stageNames: [],
        }}
        view={{
          ...p.view,
          canSubmit: false,
          errors: {
            text: "Enter a description",
            pausedReason: "Explain the pause",
            stageNames: "Choose a stage",
          },
        }}
      />,
    );
    expect(screen.getByLabelText("Description")).toBeRequired();
    expect(screen.getByLabelText("Description")).toHaveAccessibleDescription(
      "Enter a description",
    );
    expect(screen.getByLabelText("Pause reason")).toBeRequired();
    expect(screen.getByLabelText("Pause reason")).toHaveAccessibleDescription(
      "Explain the pause",
    );
    expect(
      screen.getByRole("group", { name: "Stages (required)" }),
    ).toHaveAccessibleDescription("Choose a stage");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.keyDown(screen.getByLabelText("Description"), {
      key: "Enter",
      ctrlKey: true,
      shiftKey: true,
    });
    expect(p.onSubmit).not.toHaveBeenCalled();
  });
  it("supports keyboard focus and both platform save-and-add shortcuts", async () => {
    const user = userEvent.setup();
    const p = props();
    render(<StatusOverviewInlineItemForm {...p} />);
    await user.tab();
    expect(screen.getByLabelText("Description")).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("Next step")).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("Progress")).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("Build")).toHaveFocus();
    await user.keyboard("{Control>}{Shift>}{Enter}{/Shift}{/Control}");
    await user.keyboard("{Meta>}{Shift>}{Enter}{/Shift}{/Meta}");
    expect(p.onSubmit).toHaveBeenCalledTimes(2);
    expect(p.onSubmit).toHaveBeenNthCalledWith(1, "save-and-add-another");
    expect(p.onSubmit).toHaveBeenNthCalledWith(2, "save-and-add-another");
  });
  it("submits the requested mode and supports the shortcut", () => {
    const p = props();
    render(<StatusOverviewInlineItemForm {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.keyDown(screen.getByLabelText("Description"), {
      key: "Enter",
      ctrlKey: true,
      shiftKey: true,
    });
    expect(p.onSubmit).toHaveBeenNthCalledWith(1, "save");
    expect(p.onSubmit).toHaveBeenNthCalledWith(2, "save-and-add-another");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(p.onCancel).toHaveBeenCalledOnce();
  });
  it("announces errors and preserves input while pending", () => {
    const p = props();
    render(
      <StatusOverviewInlineItemForm
        {...p}
        view={{
          ...p.view,
          errors: { text: "Required" },
          message: "Save failed",
          pending: true,
        }}
      />,
    );
    expect(screen.getByLabelText("Description")).toHaveValue("Draft");
    expect(screen.getByLabelText("Description")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByText("Save failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    fireEvent.keyDown(screen.getByLabelText("Description"), {
      key: "Enter",
      metaKey: true,
      shiftKey: true,
    });
    expect(p.onSubmit).not.toHaveBeenCalled();
  });
});
