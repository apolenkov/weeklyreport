import { SAFE_TEXT_MAX_LENGTH, safeText } from "@customreport/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { RecordTextareaField } from "./record-textarea-field";

describe("RecordTextareaField", () => {
  it("renders the label with a required-marker suffix and the placeholder", () => {
    render(
      <RecordTextareaField
        id="risk-text"
        label="Risk"
        required
        value=""
        onChange={vi.fn()}
        placeholder="e.g. Vendor API regression"
      />,
    );
    expect(screen.getByLabelText("Risk *")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("e.g. Vendor API regression"),
    ).toBeInTheDocument();
  });

  it("omits the required marker when required is not set", () => {
    render(
      <RecordTextareaField
        id="dec-deadline-note"
        label="Note"
        value=""
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Note")).toBeInTheDocument();
  });

  it("calls onChange with the new value on input", () => {
    const onChange = vi.fn();
    render(
      <RecordTextareaField
        id="item-text"
        label="Description"
        value=""
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Ship it" },
    });
    expect(onChange).toHaveBeenCalledWith("Ship it");
  });

  it("wires aria-invalid, aria-describedby and renders the error paragraph when error is set", () => {
    render(
      <RecordTextareaField
        id="risk-impact"
        label="Impact"
        required
        value=""
        onChange={vi.fn()}
        error="Impact is required"
      />,
    );
    const textarea = screen.getByLabelText("Impact *");
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea).toHaveAttribute("aria-describedby", "risk-impact-error");
    const errorEl = screen.getByRole("alert");
    expect(errorEl).toHaveAttribute("id", "risk-impact-error");
    expect(errorEl).toHaveTextContent("Impact is required");
  });

  it("sets aria-invalid=false and no aria-describedby when there is no error", () => {
    render(
      <RecordTextareaField
        id="dec-impact"
        label="Impact"
        value=""
        onChange={vi.fn()}
      />,
    );
    const textarea = screen.getByLabelText("Impact");
    expect(textarea).toHaveAttribute("aria-invalid", "false");
    expect(textarea).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders the hint node between the label and the textarea", () => {
    render(
      <RecordTextareaField
        id="dec-text"
        label="Decision"
        value=""
        onChange={vi.fn()}
        hint={<p>Phrase it as a yes/no.</p>}
      />,
    );
    expect(screen.getByText("Phrase it as a yes/no.")).toBeInTheDocument();
  });

  it("applies minHeightPx as an inline style", () => {
    render(
      <RecordTextareaField
        id="risk-mitigation"
        label="Mitigation"
        value=""
        onChange={vi.fn()}
        minHeightPx={50}
      />,
    );
    expect(screen.getByLabelText("Mitigation")).toHaveStyle({
      minHeight: "50px",
    });
  });

  it("applies flex fill classes to the wrapper and textarea when fill is enabled", () => {
    render(
      <RecordTextareaField
        id="filled-field"
        label="Filled field"
        value=""
        onChange={vi.fn()}
        fill
      />,
    );
    const textarea = screen.getByLabelText("Filled field");
    expect(textarea.parentElement).toHaveClass("flex", "flex-1", "flex-col");
    expect(textarea).toHaveClass("flex-1");
  });

  it("omits flex fill classes from the wrapper and textarea when fill is disabled", () => {
    render(
      <RecordTextareaField
        id="plain-field"
        label="Plain field"
        value=""
        onChange={vi.fn()}
        fill={false}
      />,
    );
    const textarea = screen.getByLabelText("Plain field");
    expect(textarea.parentElement).not.toHaveClass(
      "flex",
      "flex-1",
      "flex-col",
    );
    expect(textarea).not.toHaveClass("flex-1");
  });

  it("associates a character count without truncating over-limit input", () => {
    const overLimit = "A".repeat(501);
    const onChange = vi.fn();
    render(
      <RecordTextareaField
        id="bounded-prose"
        label="Prose"
        value={overLimit}
        onChange={onChange}
        characterLimit={500}
        error="Prose must be 500 characters or fewer."
      />,
    );

    const textarea = screen.getByLabelText("Prose");
    expect(textarea).toHaveValue(overLimit);
    expect(textarea).not.toHaveAttribute("maxlength");
    expect(textarea).toHaveAccessibleDescription(
      "501 / 500 characters — 1 over the limit Prose must be 500 characters or fewer.",
    );
  });

  it("focuses the textarea on mount through a passed object ref", () => {
    const textareaRef = createRef<HTMLTextAreaElement>();
    render(
      <RecordTextareaField
        id="risk-text"
        label="Risk"
        value=""
        onChange={vi.fn()}
        focusOnMount
        textareaRef={textareaRef}
      />,
    );
    const textarea = screen.getByLabelText("Risk");
    expect(textareaRef.current).toBe(textarea);
    expect(textarea).toHaveFocus();
  });

  it("focuses the textarea on mount through the internal ref when no ref is passed", () => {
    render(
      <RecordTextareaField
        id="dec-text"
        label="Decision"
        value=""
        onChange={vi.fn()}
        focusOnMount
      />,
    );
    expect(screen.getByLabelText("Decision")).toHaveFocus();
  });

  it("describes the textarea by its hint", () => {
    render(
      <RecordTextareaField
        id="risk-note"
        label="Note"
        value=""
        onChange={vi.fn()}
        hint={<p>Keep it short.</p>}
      />,
    );
    expect(screen.getByLabelText("Note")).toHaveAccessibleDescription(
      "Keep it short.",
    );
  });
});

describe("RecordTextareaField over the limit", () => {
  it.each([
    ["non-BMP boundary", "😀".repeat(500), "500 / 500 characters", false],
    [
      "non-BMP overflow",
      "😀".repeat(501),
      "501 / 500 characters — 1 over the limit",
      true,
    ],
    [
      "combining sequences",
      "e\u0301".repeat(250),
      "500 / 500 characters",
      false,
    ],
  ] as const)(
    "matches the shared text boundary for %s",
    (_name, value, description, invalid) => {
      expect(safeText().safeParse(value).success).toBe(!invalid);
      render(
        <RecordTextareaField
          id="unicode-prose"
          label="Prose"
          value={value}
          onChange={vi.fn()}
          characterLimit={SAFE_TEXT_MAX_LENGTH}
        />,
      );
      const textarea = screen.getByLabelText("Prose");
      expect(textarea).toHaveValue(value);
      expect(textarea).not.toHaveAttribute("maxlength");
      expect(textarea).toHaveAttribute(
        "aria-invalid",
        invalid ? "true" : "false",
      );
      expect(textarea).toHaveAccessibleDescription(description);
    },
  );

  it("marks the textarea invalid at 501 of 500 characters", () => {
    render(
      <RecordTextareaField
        id="over"
        label="Note"
        value={"x".repeat(501)}
        onChange={vi.fn()}
        characterLimit={500}
      />,
    );
    expect(screen.getByLabelText("Note")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByText(/1 over the limit/)).toBeInTheDocument();
  });
});
