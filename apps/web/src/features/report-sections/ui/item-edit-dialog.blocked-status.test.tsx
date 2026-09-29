import { SAFE_TEXT_MAX_LENGTH } from "@customreport/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ItemEditDialog } from "./item-edit-dialog";

const products = [
  {
    id: "p1",
    name: "Product 1",
    overallStatus: "on-track" as const,
    stages: [],
  },
];

describe("ItemEditDialog blocked-status boundary", () => {
  it("offers only progress statuses because alarms derive from covering risks", () => {
    render(
      <ItemEditDialog
        open
        item={null}
        products={products}
        week="current"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "In progress" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "✕ Blocked" }),
    ).not.toBeInTheDocument();
  });

  it("still requires a stage choice when several stages are owned", () => {
    const onSave = vi.fn();
    render(
      <ItemEditDialog
        open
        item={null}
        products={products}
        week="current"
        stagesForProduct={() => ["Development", "Testing"]}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Description *"), {
      target: { value: "Needs a stage" },
    });
    fireEvent.change(screen.getByLabelText("Product"), {
      target: { value: "product:p1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save item" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Select at least one stage.")).toBeInTheDocument();
  });
});

describe("ItemEditDialog — pause reason accessibility", () => {
  it("exposes the pause reason as required and advertises the shared character limit before save", () => {
    render(
      <ItemEditDialog
        open
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        stagesForProduct={() => ["Development"]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // The field is required only when rendered — it mounts with Paused.
    expect(screen.queryByLabelText(/Pause reason/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Paused/ }));

    const reason = screen.getByLabelText("Pause reason *");
    expect(reason).toBeRequired();
    // Limit is associated, not enforced — over-limit input must not truncate.
    expect(reason).toHaveAttribute(
      "aria-describedby",
      "item-paused-reason-limit",
    );
    expect(reason).not.toHaveAttribute("maxlength");
    expect(
      document.getElementById("item-paused-reason-limit"),
    ).toHaveTextContent(`0 / ${SAFE_TEXT_MAX_LENGTH} characters`);
  });
});

describe("ItemEditDialog — pause reason length", () => {
  it("rejects a reason over the shared server limit before saving", () => {
    const onSave = vi.fn();
    render(
      <ItemEditDialog
        open
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        // A single owned stage auto-applies, isolating the pause-reason check.
        stagesForProduct={() => ["Development"]}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Description *"), {
      target: { value: "Paused migration work" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Paused/ }));

    const reason = screen.getByLabelText("Pause reason *");
    const overLimit = "x".repeat(SAFE_TEXT_MAX_LENGTH + 1);
    fireEvent.change(reason, { target: { value: overLimit } });
    fireEvent.click(screen.getByRole("button", { name: "Save item" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(reason).toHaveValue(overLimit);
    expect(reason).toHaveAttribute("aria-invalid", "true");
    expect(reason).toHaveAttribute(
      "aria-describedby",
      "item-paused-reason-limit item-paused-reason-error",
    );
    expect(
      screen.getByText(
        `Pause reason must be ${SAFE_TEXT_MAX_LENGTH} characters or fewer.`,
      ),
    ).toBeInTheDocument();
    expect(document.activeElement).toBe(reason);
  });
});
