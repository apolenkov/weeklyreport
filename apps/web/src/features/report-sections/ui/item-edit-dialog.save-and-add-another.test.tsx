import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { KanbanItem, Product } from "../model/types";
import { ItemEditDialog } from "./item-edit-dialog";

const products: Product[] = [
  {
    id: "p1",
    name: "Alpha",
    overallStatus: "on-track",
    stages: [
      {
        stageName: "Dev",
        status: "on-track",
        ownership: "mine",
        assignee: "Lead",
      },
    ],
  },
];

describe("ItemEditDialog — Save and add another", () => {
  it("renders Save and add another button in create mode when onSaveAndAddAnother is passed", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onSaveAndAddAnother = vi.fn();
    render(
      <ItemEditDialog
        open={true}
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        stagesForProduct={() => ["Dev"] as const}
        onSave={onSave}
        onSaveAndAddAnother={onSaveAndAddAnother}
        onCancel={vi.fn()}
      />,
    );

    const addAnotherBtn = screen.getByRole("button", {
      name: "Save and add another",
    });
    expect(addAnotherBtn).toBeInTheDocument();
    expect(addAnotherBtn).not.toBeDisabled();

    await user.type(
      screen.getByLabelText(/Description \*/i),
      "Modal batch item",
    );
    await user.click(addAnotherBtn);

    expect(onSaveAndAddAnother).toHaveBeenCalledTimes(1);
    expect(onSaveAndAddAnother).toHaveBeenCalledWith(
      expect.objectContaining({ text: "Modal batch item" }),
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("does not render Save and add another button in edit mode", () => {
    const onSave = vi.fn();
    const onSaveAndAddAnother = vi.fn();
    const existing: KanbanItem = {
      id: "it-1",
      parent: { kind: "product", id: "p1" },
      productId: "p1",
      productName: "Alpha",
      activityId: null,
      text: "Existing text",
      status: "in-progress",
      author: "Lead",
      stageNames: ["Dev"],
    };
    render(
      <ItemEditDialog
        open={true}
        item={existing}
        products={products}
        week="current"
        defaultProductId="p1"
        stagesForProduct={() => ["Dev"] as const}
        onSave={onSave}
        onSaveAndAddAnother={onSaveAndAddAnother}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Save and add another" }),
    ).toBeNull();
  });
});
