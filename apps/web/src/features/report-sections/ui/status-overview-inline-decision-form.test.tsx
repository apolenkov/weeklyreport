// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

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
