// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AdminProductView, AdminUserView } from "../model/admin-types";
import { ActiveProductRow } from "./active-product-row";

vi.mock("./product-group-chips", () => ({
  ProductGroupChips: () => <div data-testid="product-group-chips-stub" />,
}));

vi.mock("./stage-assignments/stage-assignment-editor", () => ({
  StageAssignmentEditor: () => (
    <div data-testid="stage-assignment-editor-stub" />
  ),
}));

const PRODUCT_ID = "product-1";
const LEAD_ID = "lead-1";

const product: AdminProductView = {
  id: PRODUCT_ID,
  name: "Test Product",
  leadOwnerId: LEAD_ID,
  stages: [],
  status: "active",
};

const owner: AdminUserView = {
  id: LEAD_ID,
  name: "Alice Lead",
  lastName: "Lead",
  firstName: "Alice",
  middleName: null,
  position: null,
  email: "alice@example.com",
  role: "lead",
  groupId: "group-1",
  department: "Engineering",
  isActive: true,
};

interface RenderRowOptions {
  readonly isExpanded?: boolean;
  readonly isArchiving?: boolean;
  readonly onToggleExpand?: (id: string) => void;
  readonly onEdit?: (value: AdminProductView) => void;
  readonly onArchive?: (value: AdminProductView) => void;
}

function renderRow(options: RenderRowOptions = {}) {
  const handlers = {
    onToggleExpand: options.onToggleExpand ?? vi.fn<(id: string) => void>(),
    onEdit: options.onEdit ?? vi.fn<(value: AdminProductView) => void>(),
    onArchive: options.onArchive ?? vi.fn<(value: AdminProductView) => void>(),
  };

  render(
    <ActiveProductRow
      product={product}
      owner={owner}
      assignedCount={3}
      countsError={false}
      isExpanded={options.isExpanded ?? false}
      leads={[]}
      onToggleExpand={handlers.onToggleExpand}
      onEdit={handlers.onEdit}
      onArchive={handlers.onArchive}
      isArchiving={options.isArchiving ?? false}
    />,
  );

  return handlers;
}

describe("ActiveProductRow controls", () => {
  it("uses the mobile touch-target token while retaining compact desktop classes", () => {
    renderRow();

    const expand = screen.getByRole("button", {
      name: `Expand stage assignments for ${product.name}`,
    });
    const edit = screen.getByRole("button", {
      name: `Edit ${product.name}`,
    });
    const archive = screen.getByRole("button", {
      name: `Archive ${product.name}`,
    });

    for (const control of [expand, edit, archive]) {
      expect(control).toHaveClass(
        "max-md:min-h-[var(--touch-target-min)]",
        "max-md:min-w-[var(--touch-target-min)]",
      );
    }

    expect(expand).toHaveClass("h-7", "w-7");
    expect(edit).toHaveClass("min-h-[34px]");
    expect(archive).toHaveClass("min-h-[34px]");
  });

  it("preserves accessible names and expanded-state semantics", () => {
    const onToggleExpand = vi.fn<(id: string) => void>();
    const { rerender } = render(
      <ActiveProductRow
        product={product}
        owner={owner}
        assignedCount={3}
        countsError={false}
        isExpanded={false}
        leads={[]}
        onToggleExpand={onToggleExpand}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        isArchiving={false}
      />,
    );

    const expand = screen.getByRole("button", {
      name: `Expand stage assignments for ${product.name}`,
    });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(expand);
    expect(onToggleExpand).toHaveBeenCalledWith(PRODUCT_ID);

    rerender(
      <ActiveProductRow
        product={product}
        owner={owner}
        assignedCount={3}
        countsError={false}
        isExpanded
        leads={[]}
        onToggleExpand={onToggleExpand}
        onEdit={vi.fn()}
        onArchive={vi.fn()}
        isArchiving={false}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: `Collapse stage assignments for ${product.name}`,
      }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", { name: `Edit ${product.name}` }),
    ).toBeEnabled();
  });

  it("keeps edit and archive handlers wired and blocks archive while saving", () => {
    const onEdit = vi.fn<(value: AdminProductView) => void>();
    const onArchive = vi.fn<(value: AdminProductView) => void>();
    renderRow({ onEdit, onArchive });

    fireEvent.click(
      screen.getByRole("button", { name: `Edit ${product.name}` }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: `Archive ${product.name}` }),
    );

    expect(onEdit).toHaveBeenCalledWith(product);
    expect(onArchive).toHaveBeenCalledWith(product);

    cleanup();
    const savingArchive = vi.fn<(value: AdminProductView) => void>();
    renderRow({ isArchiving: true, onArchive: savingArchive });

    const disabledArchive = screen.getByRole("button", {
      name: `Archive ${product.name}`,
    });
    expect(disabledArchive).toBeDisabled();
    fireEvent.click(disabledArchive);
    expect(savingArchive).not.toHaveBeenCalled();
  });
});
