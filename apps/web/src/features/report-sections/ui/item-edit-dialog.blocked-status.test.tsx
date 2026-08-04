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
      screen.getByRole("button", { name: "! In Progress" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "✓ Completed" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "✕ Blocked" }),
    ).not.toBeInTheDocument();
  });

  it("opens a legacy stored-blocked item as In Progress", () => {
    render(
      <ItemEditDialog
        open
        item={{
          id: "i1",
          parent: { kind: "product", id: "p1" },
          productId: "p1",
          productName: "Product 1",
          activityId: null,
          status: "blocked",
          text: "Legacy blocked row",
          author: "Lead",
        }}
        products={products}
        week="current"
        stagesForProduct={() => ["Development"]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "! In Progress" }),
    ).toHaveAttribute("aria-pressed", "true");
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
    fireEvent.click(screen.getByRole("button", { name: "Save Item" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Select at least one stage.")).toBeInTheDocument();
  });
});
