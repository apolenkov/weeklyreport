/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ParentPicker } from "./parent-picker";

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
});
