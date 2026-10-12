// One mounted dialog retains its draft across parent callback identity changes.

import { safeText } from "@customreport/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type { KanbanItem, Product } from "../model/types";
import { ItemEditDialog } from "./item-edit-dialog";

const products: Product[] = [
  { id: "p1", name: "DevOps Tools", overallStatus: "on-track", stages: [] },
];

describe("ItemEditDialog — form state across parent renders", () => {
  it("preserves typed text when parent re-renders with a new stagesForProduct ref", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const stagesV1 = () => ["Dev", "Testing"] as const;

    const { rerender } = render(
      <ItemEditDialog
        open={true}
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        stagesForProduct={stagesV1}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    const textField = screen.getByLabelText(/Description \*/i);
    fireEvent.change(textField, {
      target: { value: "user typed this — must survive" },
    });
    expect(textField).toHaveValue("user typed this — must survive");

    // Parent re-render: new function reference, same available stages.
    const stagesV2 = () => ["Dev", "Testing"] as const;
    rerender(
      <ItemEditDialog
        open={true}
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        stagesForProduct={stagesV2}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    // The mounted draft remains unchanged.
    expect(textField).toHaveValue("user typed this — must survive");
  });

  it("shows an existing next step in the modal editor", () => {
    render(
      <ItemEditDialog
        open={true}
        item={{
          id: "item-plan",
          parent: { kind: "product", id: "p1" },
          productId: "p1",
          productName: "DevOps Tools",
          activityId: null,
          stageNames: [],
          status: "in-progress",
          text: "Deploy the pipeline",
          author: "Test Lead",
          nextStepText: "Watch the first deployment",
        }}
        products={products}
        week="current"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("textbox", { name: /Next step/ })).toHaveValue(
      "Watch the first deployment",
    );
  });
});

describe("ItemEditDialog — compact touch floor", () => {
  it("footer actions, status chips and the priority select floor below md", () => {
    // jsdom cannot evaluate media queries; the class assertions are the teeth.
    // Desktop density is untouched (md:min-h restores the 40px/34px values).
    render(
      <ItemEditDialog
        open={true}
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        stagesForProduct={() => ["Dev"] as const}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    for (const name of [/^Cancel$/, /Save item/]) {
      const button = screen.getByRole("button", { name });
      expect(button.className).toContain("min-h-[var(--touch-target-min)]");
      expect(button.className).toContain("md:min-h-[40px]");
    }

    const statusChip = screen.getByRole("button", { name: /In Progress/i });
    expect(statusChip.className).toContain("min-h-[var(--touch-target-min)]");
    expect(statusChip.className).not.toContain("md:min-h-[34px]");

    const prioritySelect = document.querySelector("#item-priority-rank");
    expect(prioritySelect?.className).toContain(
      "max-md:min-h-[var(--touch-target-min)]",
    );
  });
});

describe("ItemEditDialog — create parent seeding", () => {
  it("leaves the parent explicitly unresolved when the requested product id is stale", () => {
    render(
      <ItemEditDialog
        open={true}
        item={null}
        products={products}
        week="current"
        defaultProductId="stale-id"
        stagesForProduct={() => ["Dev"] as const}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    // A stale requested product must not silently rebind to products[0]; the
    // lead picks explicitly from the unresolved parent state.
    expect(screen.getByLabelText("Product")).toHaveValue("unresolved:");
  });

  it("leaves the parent explicitly unresolved over a stale product id when activities exist", () => {
    render(
      <ItemEditDialog
        open={true}
        item={null}
        products={products}
        activities={[{ id: "a1", name: "Jira triage duty" }]}
        week="current"
        defaultProductId="stale-id"
        stagesForProduct={() => ["Dev"] as const}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    // The stale product seed must not fall through to the first activity.
    expect(screen.getByLabelText("Parent")).toHaveValue("unresolved:");
  });

  it("saves the product explicitly chosen after a stale seed", () => {
    const onSave = vi.fn();
    render(
      <ItemEditDialog
        open={true}
        item={null}
        products={products}
        activities={[{ id: "a1", name: "Jira triage duty" }]}
        week="current"
        defaultProductId="stale-id"
        stagesForProduct={() => ["Dev"] as const}
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText("Parent"), {
      target: { value: "product:p1" },
    });
    fireEvent.change(screen.getByLabelText(/Description \*/i), {
      target: { value: "Choose the current product" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save item/i }));

    expect(onSave).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        parent: { kind: "product", id: "p1" },
        productId: "p1",
      }),
    );
  });

  it("leaves the parent explicitly unresolved when no product exists", () => {
    render(
      <ItemEditDialog
        open={true}
        item={null}
        products={[]}
        week="current"
        stagesForProduct={() => ["Dev"] as const}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Product")).toHaveValue("unresolved:");
    expect(screen.getByLabelText("Product")).toBeDisabled();
  });

  it("attaches a missing-product save error to the parent picker and focuses it", () => {
    render(
      <ItemEditDialog
        open={true}
        item={{
          id: "item-missing-parent",
          parent: { kind: "unresolved" },
          productId: null,
          productName: "",
          activityId: null,
          stageNames: ["Dev"],
          text: "Existing item text",
          status: "in-progress",
          author: "Test Lead",
        }}
        products={products}
        week="current"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Save item/i }));

    const parentPicker = screen.getByLabelText("Product");
    expect(screen.getByText("No product available")).toBeInTheDocument();
    expect(parentPicker).toHaveAttribute("aria-invalid", "true");
    expect(parentPicker).toHaveAttribute(
      "aria-describedby",
      "item-product-error",
    );
    expect(
      screen.queryByText("Description is required"),
    ).not.toBeInTheDocument();
    expect(document.activeElement).toBe(parentPicker);
  });

  it("preselects the exact requested product when it exists", () => {
    render(
      <ItemEditDialog
        open={true}
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        stagesForProduct={() => ["Dev"] as const}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Product")).toHaveValue("product:p1");
  });
});

describe("ItemEditDialog — reopen reset", () => {
  it("resets draft text, status, stageNames and errors when reopened", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const item: KanbanItem = {
      id: "item-1",
      parent: { kind: "product", id: "p1" },
      productId: "p1",
      productName: "DevOps Tools",
      activityId: null,
      text: "Persisted item text",
      status: "completed",
      author: "Test Lead",
      stageNames: ["Dev"],
    };

    const { rerender } = render(
      <ItemEditDialog
        open={true}
        item={item}
        products={products}
        week="current"
        stagesForProduct={() => ["Dev", "Testing"]}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Description \*/i), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: /In Progress/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Testing" }));
    fireEvent.click(screen.getByRole("button", { name: /Save item/i }));

    expect(screen.getByText("Description is required")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /In Progress/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("checkbox", { name: "Testing" })).toBeChecked();

    rerender(
      <ItemEditDialog
        open={false}
        item={item}
        products={products}
        week="current"
        stagesForProduct={() => ["Dev", "Testing"]}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );
    rerender(
      <ItemEditDialog
        open={true}
        item={item}
        products={products}
        week="current"
        stagesForProduct={() => ["Dev", "Testing"]}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByLabelText(/Description \*/i)).toHaveValue(
      "Persisted item text",
    );
    expect(screen.getByRole("button", { name: /Done/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("checkbox", { name: "Dev" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Testing" })).not.toBeChecked();
    expect(
      screen.queryByText("Description is required"),
    ).not.toBeInTheDocument();
  });
});

describe("ItemEditDialog — save and reopen status reset", () => {
  it("shows updated item.status on reopen after save, not the previously-edited draft status", () => {
    const onSave = vi.fn<(item: KanbanItem) => void>();
    const onCancel = vi.fn();
    const baseItem: KanbanItem = {
      id: "item-d12",
      parent: { kind: "product", id: "p1" },
      productId: "p1",
      productName: "DevOps Tools",
      activityId: null,
      text: "Deploy pipeline",
      status: "completed",
      author: "Test Lead",
      stageNames: ["Dev"],
    };

    const { rerender } = render(
      <ItemEditDialog
        open={true}
        item={baseItem}
        products={products}
        week="current"
        stagesForProduct={() => ["Dev"]}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole("button", { name: /Done/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: /In Progress/i }));
    expect(
      screen.getByRole("button", { name: /In Progress/i }),
    ).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByRole("textbox", { name: /Next step/i }), {
      target: { value: "Watch the deployment" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save item/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      status: "in-progress",
      nextStepText: "Watch the deployment",
    });
    const savedItem = onSave.mock.calls[0]?.[0];
    if (!savedItem) {
      throw new Error("expected onSave to emit the item used for reopen");
    }

    rerender(
      <ItemEditDialog
        open={false}
        item={savedItem}
        products={products}
        week="current"
        stagesForProduct={() => ["Dev"]}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    rerender(
      <ItemEditDialog
        open={true}
        item={savedItem}
        products={products}
        week="current"
        stagesForProduct={() => ["Dev"]}
        onSave={onSave}
        onCancel={onCancel}
      />,
    );

    // Reopen must use the updated item, not a stale draft from the prior open.
    expect(
      screen.getByRole("button", { name: /In Progress/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Done/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

describe("ItemEditDialog — unique rank picker", () => {
  it("keeps the editor usable when different products reuse a rank", () => {
    const item: KanbanItem = {
      id: "item-rank-duplicate",
      parent: { kind: "product", id: "p1" },
      productId: "p1",
      productName: "DevOps Tools",
      activityId: null,
      text: "Deploy pipeline",
      status: "in-progress",
      author: "Test Lead",
      priorityRank: 1,
      stageNames: [],
    };

    render(
      <ItemEditDialog
        open={true}
        item={item}
        products={products}
        week="current"
        ownPeriodRanks={[1, 1, 2]}
        onSave={vi.fn()}
        onCancel={() => undefined}
      />,
    );

    expect(
      screen.getByLabelText<HTMLSelectElement>(/Priority rank/i),
    ).toHaveValue("1");
  });

  it("disables taken ranks in the select while keeping the own current rank selectable", () => {
    const item: KanbanItem = {
      id: "item-rank",
      parent: { kind: "product", id: "p1" },
      productId: "p1",
      productName: "DevOps Tools",
      activityId: null,
      text: "Deploy pipeline",
      status: "in-progress",
      author: "Test Lead",
      priorityRank: 2,
      stageNames: [],
    };
    // ownPeriodRanks includes item's own rank (2) plus a foreign taken rank (3).
    // The dialog must NOT disable rank 2 (own item's rank) but MUST disable rank 3.
    render(
      <ItemEditDialog
        open={true}
        item={item}
        products={products}
        week="current"
        ownPeriodRanks={[2, 3]}
        onSave={vi.fn()}
        onCancel={() => undefined}
      />,
    );

    const select = screen.getByLabelText<HTMLSelectElement>(/Priority rank/i);
    const opt2 = Array.from(select.options).find((o) => o.value === "2");
    const opt3 = Array.from(select.options).find((o) => o.value === "3");
    const opt1 = Array.from(select.options).find((o) => o.value === "1");

    expect(opt2?.disabled).toBe(false); // own rank — selectable
    expect(opt3?.disabled).toBe(true); // taken by another item — disabled
    expect(opt1?.disabled).toBe(false); // free rank — selectable
  });

  it("allows creating an item with a free rank when other ranks are taken", () => {
    const onSave = vi.fn();
    render(
      <ItemEditDialog
        open={true}
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        ownPeriodRanks={[1, 2]}
        // A single owned stage auto-applies so the save is not blocked by the
        // zero-owned-stage guard.
        stagesForProduct={() => ["Dev"]}
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Description \*/i), {
      target: { value: "New priority item" },
    });
    fireEvent.change(screen.getByLabelText(/Priority rank/i), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save item/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ priorityRank: 3 });
  });
});

describe("ItemEditDialog — stageNames", () => {
  it("saves selected stageNames from the create dialog", () => {
    const onSave = vi.fn();
    render(
      <ItemEditDialog
        open={true}
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        stagesForProduct={() => ["Dev", "Testing"]}
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Description \*/i), {
      target: { value: "Implement OAuth callback" },
    });
    // Nothing is pre-selected on create, so clicking "Testing" selects it.
    fireEvent.click(screen.getByRole("checkbox", { name: "Testing" }));
    fireEvent.click(screen.getByRole("button", { name: /Save item/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({
      text: "Implement OAuth callback",
      stageNames: ["Testing"],
    });
  });
});

describe("ItemEditDialog — typing immediately on open", () => {
  it("preserves text typed immediately after the dialog opens (create mode)", () => {
    const onSave = vi.fn();
    render(
      <ItemEditDialog
        open={true}
        item={null}
        products={products}
        week="current"
        defaultProductId="p1"
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );

    // Simulate typing before any async effects could run
    const textField = screen.getByLabelText(/Description \*/i);
    fireEvent.change(textField, { target: { value: "typed immediately" } });

    // No re-renders or async ops — text must be exactly what was typed
    expect(textField).toHaveValue("typed immediately");
  });

  it("preserves text typed immediately after the dialog opens (edit mode)", () => {
    const onSave = vi.fn();
    const item: KanbanItem = {
      id: "item-imm",
      parent: { kind: "product", id: "p1" },
      productId: "p1",
      productName: "DevOps Tools",
      activityId: null,
      text: "existing text",
      status: "in-progress",
      author: "Test Lead",
      stageNames: [],
    };

    render(
      <ItemEditDialog
        open={true}
        item={item}
        products={products}
        week="current"
        onSave={onSave}
        onCancel={() => undefined}
      />,
    );

    const textField = screen.getByLabelText(/Description \*/i);
    fireEvent.change(textField, {
      target: { value: "existing text — amended" },
    });

    expect(textField).toHaveValue("existing text — amended");
  });
});

describe("ItemEditDialog — shared next-step and pause boundaries", () => {
  const unicodeProductId = "11111111-1111-4111-8111-111111111111";
  const currentProducts: Product[] = [
    {
      id: unicodeProductId,
      name: "Synthetic product",
      overallStatus: "on-track",
      stages: [],
    },
  ];

  it.each([
    ["next step", "non-BMP boundary", "😀".repeat(500), true],
    ["next step", "non-BMP overflow", "😀".repeat(501), false],
    ["next step", "ASCII boundary", "A".repeat(500), true],
    ["pause reason", "non-BMP boundary", "😀".repeat(500), true],
    ["pause reason", "non-BMP overflow", "😀".repeat(501), false],
    ["pause reason", "ASCII boundary", "A".repeat(500), true],
  ] as const)(
    "saves %s using the shared metric for %s",
    async (kind, _name, value, accepted) => {
      const user = userEvent.setup();
      expect(safeText().safeParse(value).success).toBe(accepted);
      const onSave = vi.fn<(next: KanbanItem) => void>();
      render(
        <ItemEditDialog
          open
          item={null}
          products={currentProducts}
          week="current"
          currentUserName="Synthetic lead"
          defaultProductId={unicodeProductId}
          stagesForProduct={() => ["Development"]}
          onSave={onSave}
          onCancel={vi.fn()}
        />,
      );
      await user.type(
        screen.getByLabelText("Description *"),
        "Ship this update",
      );
      const paused = kind === "pause reason";
      if (paused)
        await user.click(screen.getByRole("button", { name: /Paused/ }));
      const field = screen.getByRole("textbox", {
        name: paused ? /Pause reason/ : /Next step/,
      });
      await user.click(field);
      await user.paste(value);
      await user.click(screen.getByRole("button", { name: "Save item" }));
      if (accepted) {
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave.mock.calls[0]?.[0]).toMatchObject({
          [paused ? "pausedReason" : "nextStepText"]: value,
          status: paused ? "paused" : "in-progress",
          productId: unicodeProductId,
        });
      } else {
        expect(onSave).not.toHaveBeenCalled();
        expect(field).toHaveValue(value);
        expect(field).toHaveAttribute("aria-invalid", "true");
        expect(field).toHaveFocus();
      }
    },
  );
});

it("validates an unresolved requested parent and recovers through the public picker", () => {
  const onSave = vi.fn();
  const available: Product[] = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      name: "CRM",
      overallStatus: "on-track",
      stages: [],
    },
  ];
  render(
    <ItemEditDialog
      open
      item={null}
      week="current"
      products={available}
      defaultProductId="22222222-2222-4222-8222-222222222222"
      stagesForProduct={() => ["Development"]}
      onSave={onSave}
      onCancel={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByLabelText(/Description \*/i), {
    target: { value: "Deliver the pipeline" },
  });
  const save = screen.getByRole("button", { name: "Save item" });
  expect(save).toBeEnabled();
  expect(screen.queryByText(/contact.*admin/i)).toBeNull();
  fireEvent.click(save);
  expect(onSave).not.toHaveBeenCalled();
  const picker = screen.getByLabelText("Product");
  expect(picker).toHaveAttribute("aria-invalid", "true");
  expect(picker).toHaveFocus();
  fireEvent.change(picker, {
    target: { value: "product:11111111-1111-4111-8111-111111111111" },
  });
  expect(picker).toHaveAttribute("aria-invalid", "false");
  fireEvent.click(save);
  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onSave.mock.calls[0]?.[0]).toMatchObject({
    productId: "11111111-1111-4111-8111-111111111111",
    stageNames: ["Development"],
    text: "Deliver the pipeline",
  });
});

describe("ItemEditDialog — reported status-dependent validation", () => {
  const productId = "11111111-1111-4111-8111-111111111111";
  const currentProducts: Product[] = [
    { id: productId, name: "Platform", overallStatus: "on-track", stages: [] },
  ];
  it.each([
    {
      label: "valid retained next step",
      plan: "Watch the deployment",
      description: "Ship this update",
      remaining: undefined,
    },
    {
      label: "over-limit retained next step",
      plan: "x".repeat(501),
      description: "Ship this update",
      remaining: "Next step must be 500 characters or fewer.",
    },
    {
      label: "unrelated description error",
      plan: "Watch the deployment",
      description: "",
      remaining: undefined,
    },
  ])(
    "refreshes reported validation on Resume: $label",
    async ({ plan, description, remaining }) => {
      const user = userEvent.setup();
      const onSave = vi.fn<(item: KanbanItem) => void>();
      render(
        <ItemEditDialog
          open
          item={null}
          products={currentProducts}
          week="current"
          currentUserName="Synthetic lead"
          defaultProductId={productId}
          stagesForProduct={() => ["Development"]}
          onSave={onSave}
          onCancel={vi.fn()}
        />,
      );
      const text = screen.getByLabelText("Description *");
      if (description) await user.type(text, description);
      const field = screen.getByRole("textbox", { name: /Next step/ });
      await user.click(field);
      await user.paste(plan);
      await user.click(screen.getByRole("button", { name: /Done/ }));
      await user.click(screen.getByRole("button", { name: "Save item" }));
      expect(
        screen.getByText(
          "A completed item cannot have a next step. Resume it or clear the plan.",
        ),
      ).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: /In Progress/i }));
      expect(
        screen.queryByText(
          "A completed item cannot have a next step. Resume it or clear the plan.",
        ),
      ).not.toBeInTheDocument();
      expect(field).toHaveValue(plan);
      if (remaining) expect(screen.getByText(remaining)).toBeInTheDocument();
      else expect(field).toHaveAttribute("aria-invalid", "false");
      if (!description)
        expect(screen.getByText("Description is required")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Save item" }));
      if (remaining || !description) expect(onSave).not.toHaveBeenCalled();
      else {
        expect(onSave).toHaveBeenCalledTimes(1);
        expect(onSave.mock.calls[0]?.[0]).toMatchObject({
          text: description,
          nextStepText: plan,
          status: "in-progress",
          productId,
          stageNames: ["Development"],
        });
      }
    },
  );
});
