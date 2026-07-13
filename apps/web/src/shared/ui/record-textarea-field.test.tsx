import { fireEvent, render, screen } from "@testing-library/react";
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
});
