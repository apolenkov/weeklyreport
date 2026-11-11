// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SAFE_TEXT_MAX_LENGTH } from "@weeklyreport/shared";
import { useState } from "react";
import { expect, it, vi } from "vitest";

import type { DecisionComposerProps } from "../model/contextual-entry-contract";
import { StatusOverviewInlineDecisionForm } from "./status-overview-inline-decision-form";

it("shows the derived author and emits decision intentions", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  const props = {
    target: {
      kind: "decision" as const,
      parent: { kind: "activity" as const, id: "a", name: "Activity A" },
    },
    value: { text: "Decision", impact: "Impact", deadline: "", stageNames: [] },
    view: {
      eligibleStages: ["Not applicable"],
      authorName: "Lead A",
      errors: { impact: "Impact is required" },
      message: null,
      pending: false,
      dirty: true,
      canSubmit: true,
    },
    onChange,
    onSubmit,
    onCancel,
  };
  render(<StatusOverviewInlineDecisionForm {...props} />);
  expect(screen.getByText("Lead A")).toBeInTheDocument();
  expect(screen.getByLabelText("Impact")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  await user.type(screen.getByLabelText("Deadline (optional)"), "2026-11-30");
  expect(onChange).toHaveBeenCalledWith({
    ...props.value,
    deadline: "2026-11-30",
  });
  await user.click(screen.getByRole("button", { name: "Save decision" }));
  expect(onSubmit).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onCancel).toHaveBeenCalledOnce();
});

it("explains when eligibility disappears without removing the selected stage", () => {
  const onChange = vi.fn();
  const props = {
    target: {
      kind: "decision" as const,
      parent: { kind: "product" as const, id: "p", name: "Product" },
    },
    value: {
      text: "Text",
      impact: "Impact",
      deadline: "",
      stageNames: ["Old"],
    },
    view: {
      eligibleStages: ["Old"],
      authorName: "Lead",
      errors: {},
      message: null,
      pending: false,
      dirty: true,
      canSubmit: false,
    },
    onChange,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
  };
  const { rerender } = render(<StatusOverviewInlineDecisionForm {...props} />);
  rerender(
    <StatusOverviewInlineDecisionForm
      {...props}
      view={{ ...props.view, eligibleStages: [] }}
    />,
  );
  expect(
    screen.getByText("No eligible owned stages available."),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("checkbox", { name: /Old.*no longer eligible/ }),
  ).toBeChecked();
  expect(onChange).not.toHaveBeenCalled();
});

it("exposes required errors, keyboard actions, and pending state", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  const props = {
    target: {
      kind: "decision" as const,
      parent: { kind: "activity" as const, id: "a", name: "Activity" },
    },
    value: {
      text: "Decision text",
      impact: "Impact",
      deadline: "",
      stageNames: [],
    },
    view: {
      eligibleStages: ["Hidden"],
      authorName: "Lead",
      errors: { text: "Required text", impact: "Required impact" },
      message: "Try again",
      pending: false,
      dirty: true,
      canSubmit: true,
    },
    onChange,
    onSubmit,
    onCancel,
  };
  const { rerender } = render(<StatusOverviewInlineDecisionForm {...props} />);
  const text = screen.getByLabelText("Decision");
  expect(text).toBeRequired();
  expect(text).toHaveAccessibleDescription("Required text");
  expect(screen.getByLabelText("Impact")).toHaveAccessibleDescription(
    "Required impact",
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Try again");
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  await user.type(text, "x");
  expect(onChange).toHaveBeenCalledWith({
    ...props.value,
    text: `${props.value.text}x`,
  });
  screen.getByRole("button", { name: "Save decision" }).focus();
  await user.keyboard("{Enter}");
  expect(onSubmit).toHaveBeenCalledOnce();
  screen.getByRole("button", { name: "Cancel" }).focus();
  await user.keyboard("{Enter}");
  expect(onCancel).toHaveBeenCalledOnce();
  rerender(
    <StatusOverviewInlineDecisionForm
      {...props}
      view={{ ...props.view, pending: true }}
    />,
  );
  expect(screen.getByRole("button", { name: "Save decision" })).toBeDisabled();
  expect(screen.getByLabelText("Decision")).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent(/saving/i);
  await user.click(screen.getByRole("button", { name: "Save decision" }));
  expect(onSubmit).toHaveBeenCalledOnce();
});

function minimalProps(): DecisionComposerProps {
  return {
    target: {
      kind: "decision",
      parent: { kind: "activity", id: "a", name: "Operations" },
    },
    value: {
      text: "Named decision",
      impact: null,
      deadline: "",
      stageNames: [],
    },
    view: {
      eligibleStages: [],
      authorName: "Lead A",
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

it("focuses primary text and submits missing details without opening them", async () => {
  const user = userEvent.setup();
  const props = minimalProps();
  const { rerender } = render(<StatusOverviewInlineDecisionForm {...props} />);
  expect(screen.getByLabelText("Decision")).toHaveFocus();
  expect(screen.getByText("Lead A")).toBeInTheDocument();
  expect(screen.queryByLabelText("Impact")).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText("Deadline (optional)"),
  ).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await user.click(screen.getByRole("button", { name: "Save decision" }));
  expect(props.onSubmit).toHaveBeenCalledOnce();
  expect(props.onChange).not.toHaveBeenCalled();
  rerender(
    <StatusOverviewInlineDecisionForm
      {...props}
      view={{ ...props.view, pending: true }}
    />,
  );
  expect(screen.getByRole("form")).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("button", { name: "Save decision" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(props.onCancel).toHaveBeenCalledOnce();
  expect(props.onSubmit).toHaveBeenCalledOnce();
});

it("keeps optional details across disclosure and shows context errors", async () => {
  const user = userEvent.setup();
  const props = minimalProps();
  function Controlled() {
    const [value, onChange] = useState(props.value);
    return (
      <StatusOverviewInlineDecisionForm
        {...props}
        value={value}
        onChange={onChange}
      />
    );
  }
  const { rerender } = render(<Controlled />);
  const disclosure = screen.getByRole("button", { name: "Details" });
  await user.click(disclosure);
  const impact = screen.getByLabelText("Impact");
  expect(impact).not.toBeRequired();
  await user.type(impact, "Later detail");
  await user.click(disclosure);
  expect(screen.queryByLabelText("Impact")).not.toBeInTheDocument();
  await user.click(disclosure);
  expect(screen.getByLabelText("Impact")).toHaveValue("Later detail");
  rerender(
    <StatusOverviewInlineDecisionForm
      {...props}
      view={{
        ...props.view,
        canSubmit: false,
        errors: {
          impact: "Shorten this detail.",
          parent: "Parent is no longer eligible.",
          stageNames: "Activity cannot have product stages.",
        },
      }}
    />,
  );
  expect(screen.getByLabelText("Impact")).toHaveAccessibleDescription(
    "Shorten this detail.",
  );
  expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  expect(screen.getByText("Parent is no longer eligible.")).toBeInTheDocument();
  expect(
    screen.getByText("Activity cannot have product stages."),
  ).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save decision" })).toBeDisabled();
});

it("keeps an error-opened detail focused when a correction clears its error", async () => {
  const user = userEvent.setup();
  const props = minimalProps();
  function Controlled() {
    const [value, onChange] = useState<typeof props.value>({
      ...props.value,
      impact: "x".repeat(SAFE_TEXT_MAX_LENGTH + 1),
    });
    const errors: Record<string, string> =
      value.impact && value.impact.length > SAFE_TEXT_MAX_LENGTH
        ? { impact: "Shorten this detail." }
        : {};
    return (
      <StatusOverviewInlineDecisionForm
        {...props}
        value={value}
        onChange={onChange}
        view={{ ...props.view, errors }}
      />
    );
  }
  render(<Controlled />);
  const impact = screen.getByLabelText("Impact");
  await user.click(impact);
  await user.keyboard("{End}{Backspace}Z");
  expect(screen.getByLabelText("Impact")).toBe(impact);
  expect(impact).toHaveFocus();
  expect(impact).toHaveValue(`${"x".repeat(SAFE_TEXT_MAX_LENGTH)}Z`);
  await user.keyboard("{Backspace}");
  expect(impact).toHaveFocus();
  expect(screen.queryByText("Shorten this detail.")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await user.click(screen.getByRole("button", { name: "Details" }));
  expect(screen.queryByLabelText("Impact")).not.toBeInTheDocument();
});

it("retains an error-triggered disclosure across prop updates until explicit collapse", async () => {
  const user = userEvent.setup();
  const props = minimalProps();
  const { rerender } = render(<StatusOverviewInlineDecisionForm {...props} />);
  rerender(
    <StatusOverviewInlineDecisionForm
      {...props}
      view={{ ...props.view, errors: { impact: "Shorten this detail." } }}
    />,
  );
  expect(screen.getByLabelText("Impact")).toBeInTheDocument();
  rerender(<StatusOverviewInlineDecisionForm {...props} />);
  expect(screen.getByLabelText("Impact")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Details" }));
  expect(screen.queryByLabelText("Impact")).not.toBeInTheDocument();
});
