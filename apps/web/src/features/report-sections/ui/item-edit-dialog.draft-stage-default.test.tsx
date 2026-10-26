import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createDraftStageMemory } from "../model/draft-stage-memory";
import type { KanbanItem, Product } from "../model/types";
import { DraftStageMemoryProvider } from "./draft-stage-memory-context";
import { ItemEditDialog } from "./item-edit-dialog";

const PRODUCT: Product = {
  id: "p-multi",
  name: "Payments",
  overallStatus: "on-track",
  stages: [
    {
      stageName: "Development",
      status: "on-track",
      ownership: "mine",
      assignee: null,
    },
    {
      stageName: "Testing",
      status: "on-track",
      ownership: "mine",
      assignee: null,
    },
  ],
};

const SINGLE_PRODUCT: Product = {
  id: "p-single",
  name: "Onboarding",
  overallStatus: "on-track",
  stages: [
    {
      stageName: "Development",
      status: "on-track",
      ownership: "mine",
      assignee: null,
    },
  ],
};

function stagesForProduct(productId: string): readonly string[] {
  if (productId === PRODUCT.id) return ["Development", "Testing"];
  if (productId === SINGLE_PRODUCT.id) return ["Development"];
  return [];
}

function remembered(stageName: string) {
  const memory = createDraftStageMemory();
  const recordId = "saved-item";
  memory.stageChangedSelections([
    { recordId, productId: PRODUCT.id, stageNames: [stageName] },
  ]);
  memory.confirmPersisted({
    items: [{ id: recordId, projectId: PRODUCT.id, stageNames: [stageName] }],
    risks: [],
    decisions: [],
  });
  return memory;
}

function renderCreate(
  memory: ReturnType<typeof createDraftStageMemory>,
  onSave = vi.fn(),
) {
  render(
    <DraftStageMemoryProvider memory={memory}>
      <ItemEditDialog
        open
        item={null}
        products={[PRODUCT, SINGLE_PRODUCT]}
        activities={[{ id: "a-1", name: "On-call duty" }]}
        week="current"
        defaultProductId={PRODUCT.id}
        stagesForProduct={stagesForProduct}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    </DraftStageMemoryProvider>,
  );
  return { onSave };
}

describe("ItemEditDialog — editable draft stage default", () => {
  it("visibly pre-selects the remembered stage for a new item", () => {
    renderCreate(remembered("Testing"));

    expect(screen.getByRole("checkbox", { name: "Testing" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Development" }),
    ).not.toBeChecked();
  });

  it("keeps the default editable: clearing it cannot select every owned stage", () => {
    const { onSave } = renderCreate(remembered("Testing"));
    fireEvent.change(screen.getByRole("textbox", { name: /Description/ }), {
      target: { value: "Ship the importer" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Testing" }));
    fireEvent.click(screen.getByRole("button", { name: "Save item" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Select at least one stage.")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Development" }),
    ).not.toBeChecked();
  });

  it("keeps a saved record's stages instead of the remembered default", () => {
    const edited: KanbanItem = {
      id: "item-1",
      parent: { kind: "product", id: PRODUCT.id },
      productId: PRODUCT.id,
      productName: PRODUCT.name,
      activityId: null,
      text: "Ship the importer",
      status: "in-progress",
      author: "Test Lead",
      stageNames: ["Development"],
    };
    render(
      <DraftStageMemoryProvider memory={remembered("Testing")}>
        <ItemEditDialog
          open
          item={edited}
          products={[PRODUCT, SINGLE_PRODUCT]}
          week="current"
          stagesForProduct={stagesForProduct}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      </DraftStageMemoryProvider>,
    );

    expect(screen.getByRole("checkbox", { name: "Development" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Testing" })).not.toBeChecked();
  });

  it("shows no stage choice for an activity parent", () => {
    render(
      <DraftStageMemoryProvider memory={remembered("Testing")}>
        <ItemEditDialog
          open
          item={null}
          products={[PRODUCT, SINGLE_PRODUCT]}
          activities={[{ id: "a-1", name: "On-call duty" }]}
          week="current"
          defaultActivityId="a-1"
          stagesForProduct={stagesForProduct}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      </DraftStageMemoryProvider>,
    );

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows no remembered stage when the dialog has no memory provider", () => {
    render(
      <ItemEditDialog
        open
        item={null}
        products={[PRODUCT, SINGLE_PRODUCT]}
        week="current"
        defaultProductId={PRODUCT.id}
        stagesForProduct={stagesForProduct}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Testing" })).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Development" }),
    ).not.toBeChecked();
  });
});
