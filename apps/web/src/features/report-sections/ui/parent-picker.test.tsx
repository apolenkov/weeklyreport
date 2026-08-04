// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ParentPicker } from "./parent-picker";

const PRODUCT = {
  id: "p1",
  name: "CRM",
  overallStatus: "on-track",
  stages: [],
} as const;

describe("ParentPicker", () => {
  it("omits the Products group when only activities are available", () => {
    render(
      <ParentPicker
        id="parent"
        value={{ kind: "activity", id: "activity-1" }}
        products={[]}
        activities={[{ id: "activity-1", name: "Jira triage duty" }]}
        onChange={vi.fn()}
      />,
    );

    expect(
      document.querySelector('optgroup[label="Products"]'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Activities" }),
    ).toBeInTheDocument();
  });

  it("renders an explicit selectable placeholder for an unresolved parent", () => {
    render(
      <ParentPicker
        id="parent"
        value={{ kind: "unresolved" }}
        products={[PRODUCT]}
        activities={[{ id: "a1", name: "Jira triage duty" }]}
        onChange={vi.fn()}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Parent" });
    expect(select).toBeEnabled();
    expect(
      screen.getByRole("option", { name: "Select parent…" }),
    ).toBeDisabled();
    expect(select).toHaveValue("unresolved:");
  });

  it("disables the picker when an unresolved parent has no options at all", () => {
    render(
      <ParentPicker
        id="parent"
        value={{ kind: "unresolved" }}
        products={[]}
        activities={[]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Product" })).toBeDisabled();
    expect(
      screen.getByRole("option", { name: "Select parent…" }),
    ).toBeDisabled();
  });

  it("does not coerce a malformed option value into a product parent", () => {
    const onChange = vi.fn();
    render(
      <ParentPicker
        id="parent"
        value={{ kind: "product", id: PRODUCT.id }}
        products={[PRODUCT]}
        activities={[{ id: "a1", name: "Jira triage duty" }]}
        onChange={onChange}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Parent" });
    // A value whose id is not in the option list must not fabricate a parent.
    fireEvent.change(select, { target: { value: "product:no-such-product" } });
    expect(onChange).toHaveBeenCalledWith({ kind: "unresolved" });

    fireEvent.change(select, { target: { value: "bogus:value" } });
    expect(onChange).toHaveBeenLastCalledWith({ kind: "unresolved" });
  });
});
