// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { StatusOverviewInlineRiskForm } from "./status-overview-inline-risk-form";

it("emits risk edits and respects eligibility and save state", async () => {
  const onChange = vi.fn();
  const onSubmit = vi.fn();
  const user = userEvent.setup();
  const props = {
    target: {
      kind: "risk" as const,
      parent: { kind: "product" as const, id: "p", name: "Product A" },
    },
    value: {
      text: "Risk",
      impact: "Impact",
      mitigation: "Mitigation",
      severity: "blocked" as const,
      stageNames: ["Old"],
    },
    view: {
      eligibleStages: ["New"],
      authorName: "Lead",
      errors: { stageNames: "Select an eligible stage" },
      message: "Save failed",
      pending: false,
      dirty: true,
      canSubmit: false,
    },
    onChange,
    onSubmit,
    onCancel: vi.fn(),
  };
  const { rerender } = render(<StatusOverviewInlineRiskForm {...props} />);
  expect(screen.getByText("Product A")).toBeInTheDocument();
  expect(screen.getByText("Save failed")).toHaveAttribute("role", "alert");
  expect(screen.getByText("Select an eligible stage")).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: /Old/ })).toBeChecked();
  await user.click(screen.getByRole("checkbox", { name: "New" }));
  expect(onChange).toHaveBeenCalledWith({
    ...props.value,
    stageNames: ["Old", "New"],
  });
  expect(screen.getByRole("button", { name: "Save risk" })).toBeDisabled();
  rerender(
    <StatusOverviewInlineRiskForm
      {...props}
      target={{
        ...props.target,
        parent: { ...props.target.parent, kind: "activity" },
      }}
      view={{ ...props.view, pending: true }}
    />,
  );
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(/saving/i);
});

it("explains when eligibility disappears without removing the selected stage", () => {
  const onChange = vi.fn();
  const props = {
    target: {
      kind: "risk" as const,
      parent: { kind: "product" as const, id: "p", name: "Product" },
    },
    value: {
      text: "Text",
      impact: "Impact",
      mitigation: "Mitigation",
      severity: "blocked" as const,
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
  const { rerender } = render(<StatusOverviewInlineRiskForm {...props} />);
  rerender(
    <StatusOverviewInlineRiskForm
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
      kind: "risk" as const,
      parent: { kind: "activity" as const, id: "a", name: "Activity" },
    },
    value: {
      text: "Risk text",
      impact: "Impact",
      mitigation: "Mitigation",
      severity: "blocked" as const,
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
  const { rerender } = render(<StatusOverviewInlineRiskForm {...props} />);
  const text = screen.getByLabelText("Risk");
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
  screen.getByRole("button", { name: "Save risk" }).focus();
  await user.keyboard("{Enter}");
  expect(onSubmit).toHaveBeenCalledOnce();
  screen.getByRole("button", { name: "Cancel" }).focus();
  await user.keyboard("{Enter}");
  expect(onCancel).toHaveBeenCalledOnce();
  rerender(
    <StatusOverviewInlineRiskForm
      {...props}
      view={{ ...props.view, pending: true }}
    />,
  );
  expect(screen.getByRole("button", { name: "Save risk" })).toBeDisabled();
  expect(screen.getByLabelText("Risk")).toBeDisabled();
  expect(screen.getByRole("status")).toHaveTextContent(/saving/i);
  await user.click(screen.getByRole("button", { name: "Save risk" }));
  expect(onSubmit).toHaveBeenCalledOnce();
});
