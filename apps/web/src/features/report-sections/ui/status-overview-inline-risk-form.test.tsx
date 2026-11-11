// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SAFE_TEXT_MAX_LENGTH } from "@weeklyreport/shared";
import { useState } from "react";
import { expect, it, vi } from "vitest";

import type { RiskComposerProps } from "../model/contextual-entry-contract";
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

function minimalProps(): RiskComposerProps {
  return {
    target: {
      kind: "risk",
      parent: { kind: "activity", id: "a", name: "Operations" },
    },
    value: {
      text: "Named risk",
      impact: null,
      mitigation: null,
      severity: "blocked",
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
  const { rerender } = render(<StatusOverviewInlineRiskForm {...props} />);
  expect(screen.getByLabelText("Risk")).toHaveFocus();
  expect(screen.getByText("Lead A")).toBeInTheDocument();
  expect(screen.queryByLabelText("Impact")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Mitigation")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await user.click(screen.getByRole("button", { name: "Save risk" }));
  expect(props.onSubmit).toHaveBeenCalledOnce();
  expect(props.onChange).not.toHaveBeenCalled();
  rerender(
    <StatusOverviewInlineRiskForm
      {...props}
      view={{ ...props.view, pending: true }}
    />,
  );
  expect(screen.getByRole("form")).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("button", { name: "Save risk" })).toBeDisabled();
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
      <StatusOverviewInlineRiskForm
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
    <StatusOverviewInlineRiskForm
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
  expect(screen.getByRole("button", { name: "Save risk" })).toBeDisabled();
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
      <StatusOverviewInlineRiskForm
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
  const { rerender } = render(<StatusOverviewInlineRiskForm {...props} />);
  rerender(
    <StatusOverviewInlineRiskForm
      {...props}
      view={{ ...props.view, errors: { impact: "Shorten this detail." } }}
    />,
  );
  expect(screen.getByLabelText("Impact")).toBeInTheDocument();
  rerender(<StatusOverviewInlineRiskForm {...props} />);
  expect(screen.getByLabelText("Impact")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Details" }));
  expect(screen.queryByLabelText("Impact")).not.toBeInTheDocument();
});
