/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BoardColumnHeader } from "./board-column-header";
import type { ItemColumn } from "./next-week-columns";

const PRODUCT_COLUMN: ItemColumn = {
  key: "CRM",
  productId: "p1",
  productName: "CRM",
  items: [],
};

const ACTIVITY_LANE: ItemColumn = {
  key: "activity:act-1",
  productId: "",
  productName: "Jira triage duty",
  activityId: "act-1",
  items: [],
};

describe("BoardColumnHeader", () => {
  it("a product column's + Add seeds the product", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(
      <BoardColumnHeader
        col={PRODUCT_COLUMN}
        readOnly={false}
        showProductAdd={true}
        onAdd={onAdd}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add item to CRM" }));
    expect(onAdd).toHaveBeenCalledWith({ productId: "p1" });
  });

  it("an activity lane's + Add seeds the activity", async () => {
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(
      <BoardColumnHeader
        col={ACTIVITY_LANE}
        readOnly={false}
        showProductAdd={false}
        onAdd={onAdd}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Add item to Jira triage duty" }),
    );
    expect(onAdd).toHaveBeenCalledWith({ activityId: "act-1" });
  });

  it("an activity lane offers + Add even under the single-product gate", () => {
    render(
      <BoardColumnHeader
        col={ACTIVITY_LANE}
        readOnly={false}
        showProductAdd={false}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /add item/i })).toBeVisible();
  });

  it("a product column hides + Add under the single-product gate", () => {
    render(
      <BoardColumnHeader
        col={PRODUCT_COLUMN}
        readOnly={false}
        showProductAdd={false}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("read-only renders no + Add anywhere", () => {
    render(
      <BoardColumnHeader
        col={ACTIVITY_LANE}
        readOnly={true}
        showProductAdd={true}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
